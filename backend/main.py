from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import psycopg
import os
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
    with conn.cursor() as cur:
        # First get the embedding of the target article
        cur.execute("SELECT embedding FROM articles WHERE id = %s", (article_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Article not found")
        
        target_embedding = row[0]
        
        # Then find nearest neighbors (exclude itself)
        # Using vector_cosine_ops (<=>) for cosine distance. Similarity = 1 - distance.
        if category:
            cur.execute(
                """
                SELECT id, title, description, url, image_url, source_name, category, published_at,
                       1 - (embedding <=> %s::vector) AS similarity
                FROM articles
                WHERE id != %s AND category = %s
                ORDER BY (embedding <=> %s::vector) + (0.001 * EXTRACT(DAY FROM now() - published_at))
                LIMIT %s
                """,
                (target_embedding, article_id, category, target_embedding, limit)
            )
        else:
            cur.execute(
                """
                SELECT id, title, description, url, image_url, source_name, category, published_at,
                       1 - (embedding <=> %s::vector) AS similarity
                FROM articles
                WHERE id != %s
                ORDER BY (embedding <=> %s::vector) + (0.001 * EXTRACT(DAY FROM now() - published_at))
                LIMIT %s
                """,
                (target_embedding, article_id, target_embedding, limit)
            )
            
        rows = cur.fetchall()
        return [
            SimilarArticle(
                id=row[0], title=row[1], description=row[2], url=row[3],
                image_url=row[4], source_name=row[5], category=row[6], published_at=row[7], similarity=row[8]
            ) for row in rows
        ]

@app.post("/api/ingest/run")
def trigger_ingestion():
    result = ingest_articles()
    return result

@app.post("/api/seed")
def trigger_seed():
    seed_initial_articles()
    return {"status": "success", "message": "Initial articles seeded successfully"}
