# Paperly: Semantic News Recommendation Engine

A purely content-based news feed that finds non-obvious connections between stories across topics. 

Unlike traditional platforms that rely on user tracking and collaborative filtering to build recommendations, Paperly bypasses the "cold-start" problem by relying entirely on **mathematical semantic similarity**. It surfaces related articles by understanding the *meaning* of the text, giving readers a chance to explore interconnected topics without being trapped in an algorithmic echo chamber.

## How it Works
1. **Ingestion:** A background service fetches live articles from external sources (FreeNewsApi) every hour.
2. **Inference:** A Python inference engine extracts the title, description, and content of each story and passes it through `all-MiniLM-L6-v2` (PyTorch) to create a 384-dimensional dense vector embedding.
3. **Storage:** The articles and their embeddings are stored in PostgreSQL utilizing the `pgvector` extension.
4. **Recommendation:** When a reader opens a story, the FastAPI backend queries the database for the nearest vector neighbors using cosine distance. It serves the most contextually relevant matches in under 50ms.

## Tech Stack
* **Backend:** FastAPI (Python)
* **Database:** PostgreSQL with `pgvector`
* **Machine Learning:** PyTorch (`sentence-transformers`)
* **Frontend:** Vanilla JavaScript, HTML5, CSS3
* **DevOps:** Docker & Docker Compose

---

## Running Locally

To run this project locally, you will need [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed.

### 1. Clone the repository
```bash
git clone https://github.com/yourusername/paperly.git
cd paperly
```

### 2. Set up environment variables
Create a `.env` file in the root directory and add your FreeNewsApi key:
```env
NEWS_API_KEY=your_api_key_here
```

### 3. Build and run with Docker
Spin up the PostgreSQL database and FastAPI backend:
```bash
docker-compose up -d --build
```
*(Note: The initial build may take 1-2 minutes as Docker downloads the NLP embedding model.)*

### 4. Ingest your first articles
Once the containers are running, you need to populate the database. Trigger the manual ingestion endpoint to fetch the latest news and generate embeddings:
```bash
curl -X POST http://localhost:8000/api/ingest/run
```

### 5. Open the app
Visit [http://localhost:8000](http://localhost:8000) in your browser to view the news feed.

## System Architecture Highlights
* **Cold-Start Elimination:** By measuring semantic distance, the engine can recommend brand new articles that have zero clicks or user history.
* **Database-Level Analytics:** Similarity calculations (`<=>` operator) are offloaded to PostgreSQL's C implementation, ensuring lighting-fast response times.
* **Dependency-Free Frontend:** A lightweight, vanilla JS frontend ensures security and speed without heavy framework overhead.
