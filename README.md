# Paperly

A semantic news discovery and recommendation platform built to surface related stories using dense vector embeddings and in-database similarity search.

<div align="center">
  <img src="https://github.com/user-attachments/assets/baad4b85-0830-49d6-ad25-afb1c33aa3da" width="48%" />
  <img src="https://github.com/user-attachments/assets/6bd20101-c2bb-4ef4-92e7-03a5fd7c0722" width="48%" />
</div>

## Background & Motivation

When reading an article or researching a topic, we often look for related content to supplement what we are learning—seeking deeper context, alternative perspectives, or parallel developments.

At the same time, traditional recommendation systems struggle with the cold-start problem. When a user profile is established, systems can predict what that user might prefer; however, for new readers without prior browsing histories or tracking profiles, there are few reliable starting points. Most platforms fall back to generic popularity metrics rather than meaningful topic relevance.

Paperly was built to address both challenges by shifting the recommendation paradigm from user tracking to content semantics:

1. **Contextual Discovery**: Readers can explore stories connected by conceptual relevance rather than simple keyword matches or category tags.
2. **Zero Cold Start**: Recommendations are calculated directly from article content rather than user history, making related stories immediately available from the very first click.

Articles ingested into Paperly are converted into 384-dimensional dense vector embeddings using a sentence-transformer model (`all-MiniLM-L6-v2`) and indexed directly in PostgreSQL using the `pgvector` extension. When a reader opens a story, related articles are retrieved by computing cosine distance against the article's embedding, providing immediate recommendations without requiring user tracking.

---

## System Architecture

Paperly is designed as a decoupled, microservices-ready architecture prioritizing fault-tolerant data ingestion, low-latency vector retrieval, and stateless client interactions.

```
                    ┌────────────────────────┐
                    │   External Sources     │
                    │ (FreeNewsAPI / RSS)    │
                    └───────────┬────────────┘
                                │
                    ┌───────────▼────────────┐
                    │ Ingestion & Resiliency │
                    │ • Batch Processing     │
                    │ • URL Normalization    │
                    │ • Multi-Feed Fallback  │
                    └───────────┬────────────┘
                                │
                    ┌───────────▼────────────┐
                    │ Dense Vector Pipeline  │
                    │ • SentenceTransformers │
                    │ • 384-d Dense Vectors  │
                    └───────────┬────────────┘
                                │
                    ┌───────────▼────────────┐
                    │  PostgreSQL + pgvector │
                    │ • HNSW Vector Index    │
                    │ • Relational Store     │
                    │ • User & Bookmark DB   │
                    └───────────┬────────────┘
                                │
       ┌────────────────────────┴────────────────────────┐
       │                                                 │
┌──────▼──────────────────────────┐    ┌─────────────────▼──────────────┐
│       FastAPI Serving Layer     │    │       Security & User Layer    │
│ • Two-Stage Retrieval (ANN)     │    │ • Stateless JWT Bearer Tokens  │
│ • Cosine Distance Cutoff        │    │ • Salted bcrypt (12 rounds)    │
│ • In-Memory Response Caching    │    │ • Cascading Relational Bookmarks│
│ • Connection Pool (psycopg)     │    └─────────────────┬──────────────┘
└──────────────┬──────────────────┘                      │
               │                                         │
               └────────────────────┬────────────────────┘
                                    │ JSON REST API
                         ┌──────────▼──────────┐
                         │   React 18 Client   │
                         │ • Editorial Layout  │
                         │ • Optimistic Saves  │
                         │ • Semantic Search   │
                         └─────────────────────┘
```

---

## Technical Highlights & System Design

### 1. Fault-Tolerant Multi-Source Ingestion Pipeline
- **Dual-Tier Ingestion**: Fetches live articles across international and regional categories via primary news APIs. If upstream API quotas are exceeded or rate-limited, the system automatically falls back to curated RSS streams (BBC, Reuters, The Hindu, Times of India).
- **Idempotency & Deduplication**: Canonicalizes URLs and executes batch upserts (`ON CONFLICT (url) DO UPDATE/NOTHING`), ensuring zero duplicate entries while maintaining feed freshness.
- **Batched Vectorization**: Converts raw content chunks through transformer inference in batch slices, eliminating memory thrashing and keeping ingestion runtime predictable.

### 2. High-Dimensional Embedding Engine
- Generates 384-dimensional dense semantic vectors using PyTorch and Hugging Face's `sentence-transformers/all-MiniLM-L6-v2`.
- Encodes combined headline, summary, and contextual body tokens into a unified embedding space, capturing cross-topic conceptual nuances that traditional lexical search (TF-IDF, BM25) fails to identify.

### 3. Sub-Millisecond Vector Retrieval via pgvector HNSW
- Replaces expensive $O(N)$ brute-force table scans with **Hierarchical Navigable Small World (HNSW)** graph indexing inside PostgreSQL (`vector_cosine_ops` with `m = 16`, `ef_construction = 64`).
- Enables sub-millisecond Approximate Nearest Neighbor (ANN) search directly at the storage layer without requiring dedicated external vector databases.

### 4. Two-Stage Hybrid Retrieval & Caching
- **Stage 1 (Pre-filtering & ANN Traversal)**: Prunes candidate space by target category and publication recency, traversing the HNSW graph to collect top candidates based on vector cosine distance.
- **Stage 2 (Relevance Cutoff & Deduplication)**: Enforces a strict cosine distance threshold (`distance < 0.45` / similarity $> 0.55$) to filter out spurious matches and exclude the root story.
- **Serving Optimization**: In-memory response caching with a time-to-live (TTL) cache minimizes redundant vector calculations for hot stories, backed by `psycopg` connection pooling.

### 5. Stateless Security & Personalization
- **JWT Bearer Authentication**: Issues cryptographically signed HS256 tokens for stateless user sessions.
- **Secure Password Hashing**: Utilizes `bcrypt` with automatic salt generation across 12 work factor rounds; passwords and hashes are strictly excluded from API responses and database logs.
- **Relational Bookmark Persistence**: Stores user-saved stories with database-level cascading integrity (`ON DELETE CASCADE`) and parameterized SQL queries to prevent injection attacks.

---

## Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Backend & ML** | Python 3.11+, FastAPI, PyTorch, Sentence-Transformers (`all-MiniLM-L6-v2`), PyJWT, Bcrypt, Feedparser |
| **Database & Vector** | PostgreSQL 16+, `pgvector` (HNSW indexing), `psycopg` Connection Pool |
| **Frontend** | React 18, Vite, Lucide Icons, CSS3 (Editorial / Print Typography) |
| **Infrastructure** | Docker, Docker Compose, Multi-stage builds |

---

## Repository Structure

```
paperly/
├── backend/
│   ├── auth.py           # JWT token generation, verification, and bcrypt hashing
│   ├── database.py       # Connection pooling, DDL schemas, and queries
│   ├── embedder.py       # SentenceTransformer vectorization pipeline
│   ├── ingestor.py       # Multi-source API & RSS ingestion engine
│   ├── main.py           # FastAPI endpoints, caching, and middleware
│   └── requirements.txt  # Python runtime dependencies
├── frontend/
│   ├── src/
│   │   ├── components/   # Editorial UI cards, modals, headers, and views
│   │   ├── api.js        # REST client with JWT interceptor & storage helpers
│   │   ├── App.jsx       # Application state, routing, and feed loading
│   │   └── index.css     # Clean newspaper styling and responsive design
│   ├── Dockerfile        # Production multi-stage Nginx container
│   └── package.json      # Frontend package configuration
├── docker-compose.yml    # Multi-container orchestration (App, DB, Web)
├── init.sql              # Database schema, HNSW vector index, and tables
└── render.yaml           # Deployment blueprint
```

---

## Database Schema

```sql
CREATE EXTENSION IF NOT EXISTS vector;

-- Articles table with dense vector embeddings
CREATE TABLE IF NOT EXISTS articles (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    content TEXT,
    url TEXT UNIQUE NOT NULL,
    image_url TEXT,
    source_name TEXT,
    category TEXT CHECK (category IN ('india', 'world')),
    country_code TEXT,
    published_at TIMESTAMP,
    embedding vector(384),
    created_at TIMESTAMP DEFAULT now()
);

-- Sub-millisecond ANN search via HNSW graph indexing
CREATE INDEX IF NOT EXISTS idx_articles_embedding_hnsw
    ON articles USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS idx_articles_category ON articles (category);
CREATE INDEX IF NOT EXISTS idx_articles_published ON articles (published_at DESC);

-- User accounts with secure password hashing
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    hashed_password TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT now()
);

-- Relational reading bookmarks with cascading integrity
CREATE TABLE IF NOT EXISTS user_bookmarks (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    article_id INT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT now(),
    UNIQUE(user_id, article_id)
);
CREATE INDEX IF NOT EXISTS idx_user_bookmarks_user ON user_bookmarks (user_id);
```

---

## API Endpoints

### Discovery & Content
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/feed?category=india&page=1` | Paginated feed sorted by recency |
| `GET` | `/api/articles/{id}` | Full article metadata and content |
| `GET` | `/api/articles/{id}/recommendations` | Vector similarity recommendations ($k$-NN via HNSW) |
| `GET` | `/api/search/semantic?q={query}` | Dense semantic query search against articles |
| `POST`| `/api/ingest/run` | Triggers background ingestion & embedding job |

### Authentication & Bookmarks
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST`| `/api/auth/register` | Register user account with email & password |
| `POST`| `/api/auth/login` | Authenticate user credentials and return JWT bearer token |
| `GET` | `/api/auth/me` | Fetch authenticated user profile |
| `GET` | `/api/bookmarks` | Retrieve user's saved reading list |
| `POST`| `/api/bookmarks/{article_id}` | Add article to bookmarks |
| `DELETE`| `/api/bookmarks/{article_id}` | Remove article from bookmarks |

---

## Setup & Deployment

### Environment Configuration

Create a `.env` file in `backend/` or the root directory:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/paperly
NEWS_API_KEY=your_freenewsapi_key
JWT_SECRET_KEY=your_secure_random_jwt_secret_key
CORS_ORIGINS=*
```

### Option 1: Docker Compose (Recommended)

Orchestrates the FastAPI backend, PostgreSQL with `pgvector`, and the frontend in unified containers:

```bash
docker compose up --build
```

- **Frontend**: http://localhost:3000
- **API Backend**: http://localhost:8000
- **Interactive Swagger Docs**: http://localhost:8000/docs

### Option 2: Local Development

#### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

#### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend development server runs on `http://localhost:5173` and proxies API requests to `http://localhost:8000`.
