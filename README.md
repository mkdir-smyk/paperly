# Paperly: Semantic News Recommendation Engine

A content-based news platform that surfaces non-obvious connections between stories across categories using mathematical semantic similarity.

Unlike traditional platforms that rely on user tracking and collaborative filtering, Paperly bypasses the cold-start problem by analyzing article semantics with **PyTorch sentence embeddings** and **PostgreSQL `pgvector`**.

<div align="center">
  <img src="https://github.com/user-attachments/assets/baad4b85-0830-49d6-ad25-afb1c33aa3da" width="48%" />
  <img src="https://github.com/user-attachments/assets/6bd20101-c2bb-4ef4-92e7-03a5fd7c0722" width="48%" />
</div>

---

## Architecture & Tech Stack

```
paperly/
├── backend/          # FastAPI API service + sentence-transformers (PyTorch) + pgvector
├── frontend/         # React 18 SPA (JavaScript, HTML, CSS, Vite)
├── docker-compose.yml# Local full-stack orchestration
├── init.sql          # PostgreSQL schema + pgvector cosine index
└── render.yaml       # 1-click backend deployment blueprint
```

* **Frontend:** React 18, Vite, JavaScript, CSS3 (modern newspaper editorial design, staggered card reveal animations, skeleton loading shimmer, feedback toasts)
* **Backend:** FastAPI (Python), Sentence-Transformers (`all-MiniLM-L6-v2`), APScheduler
* **Database:** PostgreSQL with `pgvector` cosine similarity (`<=>`)
* **Deployment Ready:** 100% Free-Tier compatible (Neon Postgres + Render + Vercel)

---

## 🚀 Free-Tier Deployment Guide (Zero Cost)

Deploy this full-stack application for **$0/month** using free tier services:

### Step 1: Database (Free PostgreSQL with `pgvector`)
We recommend **[Neon](https://neon.tech)** (free serverless Postgres with native `pgvector` support) or **[Supabase](https://supabase.com)**:

1. Sign up for free at [neon.tech](https://neon.tech) and create a project.
2. In your Neon Dashboard, open the **SQL Editor**.
3. Copy and run the contents of [`init.sql`](./init.sql):
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
4. Copy your database connection string (e.g. `postgresql://user:pass@ep-xyz.us-east-2.aws.neon.tech/neondb?sslmode=require`).

---

### Step 2: Backend (Free on [Render](https://render.com))

Deploy the FastAPI service on Render's free tier:

#### Option A: 1-Click with Blueprint
1. Push your repository to GitHub.
2. In Render, click **New +** -> **Blueprint**.
3. Select your repository. Render will automatically detect [`render.yaml`](./render.yaml).
4. Set the environment variables:
   * `DATABASE_URL`: Your Neon database URL from Step 1.
   * `NEWS_API_KEY`: Your FreeNewsApi.io key (optional, for fetching new articles).
5. Click **Apply**. Render will build and deploy the container.

#### Option B: Manual Web Service
1. Click **New +** -> **Web Service** -> Connect your GitHub repository.
2. Configure:
   * **Root Directory:** `backend`
   * **Runtime:** `Docker`
   * **Instance Type:** `Free`
3. Add Environment Variables:
   * `DATABASE_URL`: Your database connection string.
   * `NEWS_API_KEY`: Your API key.
   * `CORS_ORIGINS`: `*`
4. Deploy! Note down your backend URL (e.g. `https://paperly-api.onrender.com`).

---

### Step 3: Frontend (Free on [Vercel](https://vercel.com))

Deploy the React frontend on Vercel's edge network:

1. Sign in to [vercel.com](https://vercel.com) and click **Add New...** -> **Project**.
2. Import your GitHub repository.
3. In the project configuration:
   * **Root Directory:** Click Edit and select `frontend`.
   * **Framework Preset:** `Vite` (auto-detected).
4. In **Environment Variables**, add:
   * `VITE_API_BASE_URL`: `https://<your-backend-app>.onrender.com/api` (the Render URL from Step 2 with `/api`).
5. Click **Deploy**. Vercel will build and serve your app globally in seconds!

*(Routing fallback is preconfigured in `frontend/vercel.json` so direct links and page reloads work out of the box.)*

---

## 💻 Local Development

### Option A: Using Docker Compose (Recommended)

Run everything locally with a single command:

```bash
# 1. Clone repository
git clone https://github.com/yourusername/paperly.git
cd paperly

# 2. Configure environment (optional API key)
echo "NEWS_API_KEY=your_key_here" > .env

# 3. Start containers
docker compose up --build
```

- **Frontend:** [http://localhost:3000](http://localhost:3000)
- **Backend API Docs:** [http://localhost:8000/docs](http://localhost:8000/docs)
- **Postgres Database:** `localhost:5432`

---

### Option B: Running Manually

#### Backend:
```bash
cd backend
python -m venv .venv
# Windows:
.venv\Scripts\activate
# Linux/macOS:
source .venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

#### Frontend:
```bash
cd frontend
npm install
npm run dev
```

The frontend dev server will launch at [http://localhost:5173](http://localhost:5173) and automatically proxies `/api` calls to `http://localhost:8000`.

---

## 📰 Populating Articles

Once the application is running, click the **"Fetch Latest News"** button in the top right of the feed, or send a request to the ingest endpoint:

```bash
curl -X POST http://localhost:8000/api/ingest/run
```

*(Requires `NEWS_API_KEY` from [FreeNewsApi.io](https://api.freenewsapi.io/).)*

---

## Features

- **Semantic Similarity Search:** Finds non-obvious connections between articles using cosine similarity of PyTorch vector embeddings (`all-MiniLM-L6-v2`).
- **Interactive Editorial UI:** Crisp serif headlines, category switching (Top Stories, World, India), high-resolution media handling, and semantic similarity match indicators.
- **Micro-Interactions & Animations:** Staggered card entry reveals, shimmer skeleton loading screens, button spinner feedback, and non-blocking toast notifications.
- **Decoupled Architecture:** Clean separation of concerns between `backend/` and `frontend/` with CORS support and flexible environment variables.
