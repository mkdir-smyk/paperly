# Paperly — Frontend

## System Architecture

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
