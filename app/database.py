import os
import psycopg
from psycopg_pool import ConnectionPool
from pgvector.psycopg import register_vector

DATABASE_URL = os.getenv(
    "DATABASE_URL", 
    "postgresql://postgres:postgres@localhost:5432/paperly"
)

# Global pool instance
pool = None

def get_pool():
    global pool
    if pool is None:
        pool = ConnectionPool(DATABASE_URL, min_size=1, max_size=10)
    return pool

def init_db():
    p = get_pool()
    with p.connection() as conn:
        register_vector(conn)
        
def get_db_connection():
    p = get_pool()
    conn = p.getconn()
    try:
        register_vector(conn)
        yield conn
    finally:
        p.putconn(conn)
