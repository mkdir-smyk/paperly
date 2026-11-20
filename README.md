# Paperly

A semantic news discovery and recommendation platform built to surface contextually related stories using dense vector embeddings and in-database similarity search.

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

Paperly is structured as a decoupled, multi-tier system designed for resilient real-time news ingestion, sub-millisecond semantic retrieval, and stateless client interactions.

```
                    ┌────────────────────────┐
                    │   External Sources     │
                    │ (FreeNewsAPI / RSS)    │
                    └───────────┬────────────┘
                                │
                    ┌───────────▼────────────┐
                    │ Ingestion & Resiliency │
                    │ • Multi-Feed Failover  │
                    │ • Batch Processing     │
                    │ • URL Normalization    │
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
                    │ • HNSW Vector Graph    │
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

## Core System Modules

### 1. Data Ingestion & Resiliency Subsystem
- **Multi-Source Ingestion**: Aggregates live news across domestic and international categories using structured REST APIs paired with automated RSS syndication fallbacks (BBC, Reuters, The Hindu, Times of India) to maintain high availability during upstream rate-limiting or provider downtime.
- **Idempotency & Deduplication**: Canonicalizes article URLs and executes atomic batch upserts (`ON CONFLICT (url) DO UPDATE/NOTHING`), guaranteeing database integrity and eliminating duplicate content.
- **Batch Processing**: Groups un-embedded articles into configurable batch slices for model vectorization, maintaining predictable memory footprints and stable ingestion cycles.

### 2. Dense Semantic Vector Pipeline
- **Embedding Generation**: Leverages PyTorch and Hugging Face's `sentence-transformers/all-MiniLM-L6-v2` to map article titles, summaries, and content excerpts into 384-dimensional dense vector representations.
- **Conceptual Affinity Mapping**: Encodes semantic relationships into a shared vector space, allowing the engine to associate related stories across distinct vocabularies, regions, and journalistic styles.

### 3. In-Database Vector Storage & HNSW Indexing
- **Native Vector Engine**: Houses article metadata and high-dimensional embeddings within PostgreSQL using the `pgvector` extension.
- **HNSW Graph Search**: Deploys **Hierarchical Navigable Small World (HNSW)** index graphs (`vector_cosine_ops`, `m = 16`, `ef_construction = 64`), enabling sub-millisecond Approximate Nearest Neighbor (ANN) cosine distance queries directly within the primary relational database.

### 4. Two-Stage Retrieval & Serving Subsystem
- **Stage 1 (Pre-filtering & Candidate Traversal)**: Traverses the HNSW index graph under specified category and recency filters to retrieve the closest semantic neighbors.
- **Stage 2 (Relevance Cutoff & Ranking)**: Applies a strict cosine distance threshold (`distance < 0.45` / similarity $> 0.55$) to eliminate non-relevant stories and automatically filters out the source article.
- **High-Throughput Caching**: Combines an in-memory TTL cache for popular story recommendations with `psycopg` database connection pooling to handle concurrent query spikes with low latency.

### 5. Identity & Personalization Subsystem
- **Stateless Authentication**: Uses standard JSON Web Tokens (JWT) signed via HS256 for secure, stateless request authorization across protected routes.
- **Credential Protection**: Hashes user passwords using `bcrypt` with unique per-user salt generation across 12 work factor rounds; sensitive credentials are never stored in plaintext or exposed in API payloads.
- **Personalized Reading Lists**: Persists saved articles via relational schemas with foreign key cascading (`ON DELETE CASCADE`), ensuring consistent user reading lists across sessions.

### 6. Editorial Client Interface
- **Print-Inspired Aesthetic**: Custom React 18 interface styled with classic newspaper typography, clean hairline borders, and zero-emoji visual hierarchy.
- **Interactive Capabilities**: Features dynamic local-time header editions, interactive semantic search, optimistic bookmark toggles, and animated reading drawers.

---

## Tech Stack

| Domain | Technologies |
| :--- | :--- |
| **Backend & ML** | Python 3.11+, FastAPI, PyTorch, Sentence-Transformers (`all-MiniLM-L6-v2`), PyJWT, Bcrypt, Feedparser |
| **Database & Vector** | PostgreSQL 16+, `pgvector` (HNSW indexing), `psycopg` Connection Pool |
| **Frontend** | React 18, Vite, Lucide React, Modern CSS3 |
| **DevOps & Containerization** | Docker, Docker Compose, Multi-stage builds |

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

## REST API Reference

### Discovery & Recommendations
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/feed?category=india&page=1` | Paginated article feed ordered by publication date |
| `GET` | `/api/articles/{id}` | Detailed article metadata and content body |
| `GET` | `/api/articles/{id}/recommendations` | Contextually related stories retrieved via HNSW cosine distance |
| `GET` | `/api/search/semantic?q={query}` | Semantic search ranking articles against free-text query embeddings |
| `POST`| `/api/ingest/run` | Triggers background ingestion and embedding pipeline |

### Authentication & Bookmarks
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST`| `/api/auth/register` | Register new user account with email, name, and password |
| `POST`| `/api/auth/login` | Authenticate credentials and return signed JWT bearer token |
| `GET` | `/api/auth/me` | Fetch profile for authenticated user session |
| `GET` | `/api/bookmarks` | Retrieve complete reading list for authenticated user |
| `POST`| `/api/bookmarks/{article_id}` | Bookmark an article to user reading list |
| `DELETE`| `/api/bookmarks/{article_id}` | Remove an article from user reading list |

---

## Setup & Deployment

### Environment Configuration

Create a `.env` file in `backend/` or the repository root:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/paperly
NEWS_API_KEY=your_freenewsapi_key
JWT_SECRET_KEY=your_secure_random_jwt_secret_key
CORS_ORIGINS=*
```

### Option 1: Docker Compose (Recommended)

Spins up the FastAPI backend, PostgreSQL with `pgvector`, and the React frontend in unified containers:

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
