# Paperly

A semantic news recommendation platform built to surface related stories using vector embeddings and cosine similarity.

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

Articles ingested into Paperly are converted into 384-dimensional dense vector embeddings using a sentence-transformer model (`all-MiniLM-L6-v2`) and stored in PostgreSQL using the `pgvector` extension. When a reader opens a story, related articles are retrieved by computing cosine distance against the article's embedding, providing immediate recommendations without requiring user tracking.

## Tech Stack

- **Backend**: FastAPI, Sentence-Transformers (`all-MiniLM-L6-v2`)
- **Database**: PostgreSQL with `pgvector`
- **Frontend**: React 18, Vite

## Repository Structure

```
paperly/
├── backend/          # FastAPI application and embedding pipeline
├── frontend/         # React SPA
├── docker-compose.yml# Local multi-container orchestration
├── init.sql          # Database schema and vector index definitions
└── render.yaml       # Render service blueprint
```

## Setup

### Environment Variables

Create `.env` in `backend/` or the repository root:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/paperly
NEWS_API_KEY=your_freenewsapi_key
CORS_ORIGINS=*
```

### Option 1: Docker Compose

```bash
docker compose up --build
```

- Frontend: http://localhost:3000
- API: http://localhost:8000
- API Docs: http://localhost:8000/docs

### Option 2: Local Development

#### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

#### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend dev server runs on http://localhost:5173 and proxies `/api` calls to `http://localhost:8000`.

## Database Schema

```sql
CREATE EXTENSION IF NOT EXISTS vector;

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

CREATE INDEX IF NOT EXISTS idx_articles_embedding
    ON articles USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_articles_category ON articles (category);
CREATE INDEX IF NOT EXISTS idx_articles_published ON articles (published_at DESC);
```

## Ingestion Pipeline

The backend schedules an hourly job to fetch and embed articles from FreeNewsApi.io. Ingestion can also be manually invoked:

```bash
curl -X POST http://localhost:8000/api/ingest/run
```

When the frontend is accessed, it triggers a non-blocking background ingestion check for fresh articles.
