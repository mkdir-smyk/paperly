from fastapi import FastAPI, Depends, HTTPException, Query, BackgroundTasks, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
import psycopg
import os
import re
import contextlib
from pathlib import Path
from dotenv import load_dotenv
from apscheduler.schedulers.background import BackgroundScheduler

# Load .env
load_dotenv(Path(__file__).resolve().parent / ".env")
load_dotenv(Path(__file__).resolve().parent.parent / ".env")
load_dotenv()

from database import get_pool, init_db, get_db_connection, seed_initial_articles
from ingestor import ingest_articles
from embedder import get_embedding
from auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
    get_current_user_optional,
)

@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB (creates extension, table, indices, and seeds sample data if empty)
    try:
        init_db()
    except Exception as e:
        print(f"Warning: Database initialization failed during startup ({e}). It will retry on first request.")
    
    # Start scheduler
    scheduler = BackgroundScheduler()
    scheduler.add_job(ingest_articles, 'interval', minutes=60)
    scheduler.start()
    
    yield
    
    scheduler.shutdown()

app = FastAPI(title="Paperly News Feed API", lifespan=lifespan)

# Setup CORS for decoupled frontend deployment
allowed_origins_env = os.getenv("CORS_ORIGINS", "*")
origins = [origin.strip() for origin in allowed_origins_env.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins != ["*"] else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models
class ArticleBase(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    url: Optional[str] = None
    image_url: Optional[str] = None
    source_name: Optional[str] = None
    category: Optional[str] = 'world'
    published_at: Optional[datetime] = None

class ArticleDetail(ArticleBase):
    content: Optional[str] = None

class SimilarArticle(ArticleBase):
    similarity: float

class SearchResult(ArticleBase):
    similarity: float

# Authentication & User models
class UserRegisterRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=100)
    password: str = Field(..., min_length=6, max_length=72)
    name: str = Field(..., min_length=1, max_length=60)

class UserLoginRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=100)
    password: str = Field(..., min_length=1, max_length=72)

class UserResponse(BaseModel):
    id: int
    email: str
    name: str
    created_at: Optional[datetime] = None

class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class BookmarkResponse(BaseModel):
    article_id: int
    bookmarked: bool

# Health Check Endpoint
@app.get("/api/health")
def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}

# API Endpoints
@app.get("/api/articles", response_model=List[ArticleBase])
def get_articles(category: Optional[str] = None, skip: int = 0, limit: int = 20, conn: psycopg.Connection = Depends(get_db_connection)):
    with conn.cursor() as cur:
        if category:
            cur.execute(
                "SELECT id, title, description, url, image_url, source_name, category, published_at FROM articles WHERE category = %s ORDER BY published_at DESC LIMIT %s OFFSET %s",
                (category, limit, skip)
            )
        else:
            cur.execute(
                "SELECT id, title, description, url, image_url, source_name, category, published_at FROM articles ORDER BY published_at DESC LIMIT %s OFFSET %s",
                (limit, skip)
            )
        
        rows = cur.fetchall()
        return [
            ArticleBase(
                id=row[0], title=row[1], description=row[2], url=row[3],
                image_url=row[4], source_name=row[5], category=row[6], published_at=row[7]
            ) for row in rows
        ]

@app.get("/api/articles/{article_id}", response_model=ArticleDetail)
def get_article(article_id: int, conn: psycopg.Connection = Depends(get_db_connection)):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id, title, description, url, image_url, source_name, category, published_at, content FROM articles WHERE id = %s",
            (article_id,)
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Article not found")
        
        return ArticleDetail(
            id=row[0], title=row[1], description=row[2], url=row[3],
            image_url=row[4], source_name=row[5], category=row[6], published_at=row[7], content=row[8]
        )

@app.get("/api/articles/{article_id}/similar", response_model=List[SimilarArticle])
def get_similar_articles(article_id: int, category: Optional[str] = None, limit: int = 5, conn: psycopg.Connection = Depends(get_db_connection)):
    candidate_limit = max(limit * 8, 40)
    with conn.cursor() as cur:
        # First get the embedding of the target article
        cur.execute("SELECT embedding FROM articles WHERE id = %s", (article_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Article not found")
        
        target_embedding = row[0]
        
        # Two-Stage Retrieval:
        # Stage 1: Candidate retrieval using indexed HNSW vector search (embedding <=> target_vector)
        # Stage 2: Re-ranking candidates by blending cosine similarity and temporal recency decay
        if category:
            cur.execute(
                """
                WITH candidates AS (
                    SELECT id, title, description, url, image_url, source_name, category, published_at,
                           (embedding <=> %s::vector) AS cosine_dist
                    FROM articles
                    WHERE id != %s AND category = %s
                    ORDER BY embedding <=> %s::vector
                    LIMIT %s
                )
                SELECT id, title, description, url, image_url, source_name, category, published_at,
                       (1 - cosine_dist) AS similarity
                FROM candidates
                ORDER BY ((1 - cosine_dist) * 0.75 + EXP(-0.05 * GREATEST(0.0, EXTRACT(EPOCH FROM (now() - COALESCE(published_at, now()))) / 86400.0)) * 0.25) DESC
                LIMIT %s
                """,
                (target_embedding, article_id, category, target_embedding, candidate_limit, limit)
            )
        else:
            cur.execute(
                """
                WITH candidates AS (
                    SELECT id, title, description, url, image_url, source_name, category, published_at,
                           (embedding <=> %s::vector) AS cosine_dist
                    FROM articles
                    WHERE id != %s
                    ORDER BY embedding <=> %s::vector
                    LIMIT %s
                )
                SELECT id, title, description, url, image_url, source_name, category, published_at,
                       (1 - cosine_dist) AS similarity
                FROM candidates
                ORDER BY ((1 - cosine_dist) * 0.75 + EXP(-0.05 * GREATEST(0.0, EXTRACT(EPOCH FROM (now() - COALESCE(published_at, now()))) / 86400.0)) * 0.25) DESC
                LIMIT %s
                """,
                (target_embedding, article_id, target_embedding, candidate_limit, limit)
            )
            
        rows = cur.fetchall()
        return [
            SimilarArticle(
                id=row[0], title=row[1], description=row[2], url=row[3],
                image_url=row[4], source_name=row[5], category=row[6], published_at=row[7], similarity=row[8]
            ) for row in rows
        ]

@app.get("/api/search", response_model=List[SearchResult])
def search_articles(
    q: str = Query(..., min_length=1, max_length=200, description="Semantic concept query"),
    category: Optional[str] = None,
    limit: int = 15,
    conn: psycopg.Connection = Depends(get_db_connection)
):
    query_embedding = get_embedding(q)
    with conn.cursor() as cur:
        # Utilize HNSW index to find closest conceptual matches to user's query
        if category:
            cur.execute(
                """
                SELECT id, title, description, url, image_url, source_name, category, published_at,
                       1 - (embedding <=> %s::vector) AS similarity
                FROM articles
                WHERE category = %s
                ORDER BY embedding <=> %s::vector
                LIMIT %s
                """,
                (query_embedding, category, query_embedding, limit)
            )
        else:
            cur.execute(
                """
                SELECT id, title, description, url, image_url, source_name, category, published_at,
                       1 - (embedding <=> %s::vector) AS similarity
                FROM articles
                ORDER BY embedding <=> %s::vector
                LIMIT %s
                """,
                (query_embedding, query_embedding, limit)
            )
            
        rows = cur.fetchall()
        return [
            SearchResult(
                id=row[0], title=row[1], description=row[2], url=row[3],
                image_url=row[4], source_name=row[5], category=row[6], published_at=row[7], similarity=row[8]
            ) for row in rows
        ]

@app.post("/api/ingest/run")
def trigger_ingestion(background_tasks: BackgroundTasks):
    background_tasks.add_task(ingest_articles)
    return {"status": "queued", "message": "Ingestion job dispatched in background"}

@app.post("/api/seed")
def trigger_seed():
    seed_initial_articles()
    return {"status": "success", "message": "Initial articles seeded successfully"}

# ---------------------------------------------------------
# Authentication & User Management Endpoints
# ---------------------------------------------------------

@app.post("/api/auth/register", response_model=AuthResponse)
def register_user(req: UserRegisterRequest, conn: psycopg.Connection = Depends(get_db_connection)):
    cleaned_email = req.email.strip().lower()
    cleaned_name = req.name.strip()
    
    # Format and safety validations
    if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", cleaned_email):
        raise HTTPException(status_code=400, detail="Invalid email format.")
    
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters long.")
    
    with conn.cursor() as cur:
        # Check if user already exists
        cur.execute("SELECT id FROM users WHERE email = %s", (cleaned_email,))
        if cur.fetchone():
            raise HTTPException(status_code=400, detail="An account with this email already exists.")
        
        hashed = hash_password(req.password)
        cur.execute(
            """
            INSERT INTO users (email, name, hashed_password)
            VALUES (%s, %s, %s)
            RETURNING id, email, name, created_at
            """,
            (cleaned_email, cleaned_name, hashed)
        )
        row = cur.fetchone()
        conn.commit()

        user = UserResponse(id=row[0], email=row[1], name=row[2], created_at=row[3])
        token = create_access_token(user.id, user.email)
        return AuthResponse(access_token=token, user=user)

@app.post("/api/auth/login", response_model=AuthResponse)
def login_user(req: UserLoginRequest, conn: psycopg.Connection = Depends(get_db_connection)):
    cleaned_email = req.email.strip().lower()
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id, email, name, hashed_password, created_at FROM users WHERE email = %s",
            (cleaned_email,)
        )
        row = cur.fetchone()
        # Uniform error message prevents email enumeration attacks
        if not row or not verify_password(req.password, row[3]):
            raise HTTPException(status_code=401, detail="Invalid email or password.")
        
        user = UserResponse(id=row[0], email=row[1], name=row[2], created_at=row[4])
        token = create_access_token(user.id, user.email)
        return AuthResponse(access_token=token, user=user)

@app.get("/api/auth/me", response_model=UserResponse)
def get_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(**current_user)

# ---------------------------------------------------------
# Bookmarks / Saved Stories Endpoints
# ---------------------------------------------------------

@app.get("/api/bookmarks", response_model=List[ArticleBase])
def get_user_bookmarks(current_user: dict = Depends(get_current_user), conn: psycopg.Connection = Depends(get_db_connection)):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT a.id, a.title, a.description, a.url, a.image_url, a.source_name, a.category, a.published_at
            FROM articles a
            JOIN user_bookmarks b ON a.id = b.article_id
            WHERE b.user_id = %s
            ORDER BY b.created_at DESC
            """,
            (current_user["id"],)
        )
        rows = cur.fetchall()
        return [
            ArticleBase(
                id=r[0], title=r[1], description=r[2], url=r[3],
                image_url=r[4], source_name=r[5], category=r[6], published_at=r[7]
            ) for r in rows
        ]

@app.get("/api/bookmarks/ids", response_model=List[int])
def get_user_bookmark_ids(current_user: dict = Depends(get_current_user), conn: psycopg.Connection = Depends(get_db_connection)):
    with conn.cursor() as cur:
        cur.execute("SELECT article_id FROM user_bookmarks WHERE user_id = %s", (current_user["id"],))
        rows = cur.fetchall()
        return [r[0] for r in rows]

@app.post("/api/bookmarks/{article_id}", response_model=BookmarkResponse)
def add_bookmark(article_id: int, current_user: dict = Depends(get_current_user), conn: psycopg.Connection = Depends(get_db_connection)):
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM articles WHERE id = %s", (article_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Article not found.")
        
        cur.execute(
            """
            INSERT INTO user_bookmarks (user_id, article_id)
            VALUES (%s, %s)
            ON CONFLICT (user_id, article_id) DO NOTHING
            """,
            (current_user["id"], article_id)
        )
        conn.commit()
        return BookmarkResponse(article_id=article_id, bookmarked=True)

@app.delete("/api/bookmarks/{article_id}", response_model=BookmarkResponse)
def remove_bookmark(article_id: int, current_user: dict = Depends(get_current_user), conn: psycopg.Connection = Depends(get_db_connection)):
    with conn.cursor() as cur:
        cur.execute(
            "DELETE FROM user_bookmarks WHERE user_id = %s AND article_id = %s",
            (current_user["id"], article_id)
        )
        conn.commit()
        return BookmarkResponse(article_id=article_id, bookmarked=False)
