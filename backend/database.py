import os
from pathlib import Path
from dotenv import load_dotenv
import psycopg
from psycopg_pool import ConnectionPool
from pgvector.psycopg import register_vector
from datetime import datetime

# Automatically search and load .env from backend/ or repo root
load_dotenv(Path(__file__).resolve().parent / ".env")
load_dotenv(Path(__file__).resolve().parent.parent / ".env")
load_dotenv()

DATABASE_URL = os.getenv(
    "DATABASE_URL", 
    "postgresql://postgres:postgres@localhost:5432/paperly"
)

# Global pool instance
pool = None

def configure_connection(conn):
    """Callback triggered whenever a new connection is spawned in the pool."""
    register_vector(conn)

def get_pool():
    global pool
    if pool is None:
        # Check if DATABASE_URL is Neon and needs sslmode
        db_url = os.getenv("DATABASE_URL", DATABASE_URL)
        pool = ConnectionPool(
            db_url,
            min_size=1,
            max_size=10,
            configure=configure_connection,
            open=True
        )
    return pool

def init_db():
    """Initializes tables, extensions, and seeds initial data if database is empty."""
    p = get_pool()
    with p.connection() as conn:
        with conn.cursor() as cur:
            # 1. Enable pgvector
            cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")
            
            # 2. Create articles table
            cur.execute("""
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
            """)
            
            # 3. Create indices
            cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_articles_category ON articles (category);
            """)
            cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_articles_published ON articles (published_at DESC);
            """)
            
            # 4. Check if we need to seed initial articles
            cur.execute("SELECT COUNT(*) FROM articles;")
            count = cur.fetchone()[0]
            
        conn.commit()
        register_vector(conn)

        if count == 0:
            print("Database is empty. Seeding initial stories with semantic embeddings...")
            seed_initial_articles()

def seed_initial_articles():
    """Seeds a rich set of articles across 'world' and 'india' so the UI immediately has content."""
    from embedder import get_embedding

    sample_articles = [
        {
            "title": "James Webb Space Telescope Discovers Ancient Galaxy Forming in Early Universe",
            "description": "Astronomers using the James Webb Space Telescope have identified a remarkably massive galaxy from the cosmic dawn, challenging existing cosmological models.",
            "content": "Using near-infrared spectroscopy, astronomers analyzed light that has traveled for over 13 billion years. The newly uncovered cosmic structure shows unexpected stellar density and rapid star formation that suggests early galaxies matured much faster than previously hypothesized by astrophysics models.",
            "url": "https://paperly.news/science/jwst-early-galaxy-discovery",
            "image_url": "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=800&q=80",
            "source_name": "Cosmic Science Review",
            "category": "world",
            "published_at": datetime.utcnow()
        },
        {
            "title": "Global Renewable Energy Capacity Surpasses Forecasts with Massive Solar Expansion",
            "description": "The International Energy Agency reports unprecedented additions in global solar and wind generation as battery storage technology becomes cheaper.",
            "content": "Global clean energy deployment hit another record high this year, led by massive solar photovoltaic installations and rapid investments in utility-scale battery storage. Analysts report that the transition toward decentralized power grids is accelerating across Asia, Europe, and the Americas.",
            "url": "https://paperly.news/energy/global-solar-surge",
            "image_url": "https://images.unsplash.com/photo-1509391365360-2e959784a276?auto=format&fit=crop&w=800&q=80",
            "source_name": "Global Energy Outlook",
            "category": "world",
            "published_at": datetime.utcnow()
        },
        {
            "title": "European Union Enacts Landmark Comprehensive Artificial Intelligence Governance Act",
            "description": "European regulators have finalized the world's first comprehensive legal framework regulating high-risk artificial intelligence systems and foundation models.",
            "content": "The legislation introduces tiered risk obligations for AI developers, placing stringent transparency and testing mandates on frontier foundation models and prohibitive bans on biometric categorization systems.",
            "url": "https://paperly.news/tech/eu-ai-act-passed",
            "image_url": "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80",
            "source_name": "Tech Policy Journal",
            "category": "world",
            "published_at": datetime.utcnow()
        },
        {
            "title": "Scientists Develop Ultra-Fast Quantum Processor Capable of Error-Corrected Qubits",
            "description": "A consortium of quantum physicists has achieved high-fidelity logical qubits, marking a critical leap toward fault-tolerant commercial quantum computing.",
            "content": "By implementing real-time surface-code error correction across superconducting circuits, researchers maintained quantum coherence for orders of magnitude longer than previous records, demonstrating feasible scaling pathways for cryptographic and material simulation workloads.",
            "url": "https://paperly.news/tech/fault-tolerant-quantum-milestone",
            "image_url": "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&w=800&q=80",
            "source_name": "Quantum Computing Digest",
            "category": "world",
            "published_at": datetime.utcnow()
        },
        {
            "title": "ISRO Announces Upcoming Lunar Exploration Fleet and Deep Space Communication Network",
            "description": "The Indian Space Research Organisation has unveiled plans for subsequent lunar sample-return missions and a dedicated planetary telemetry relay satellite.",
            "content": "Building on the triumph of Chandrayaan-3, ISRO Chairman outlined the blueprint for Chandrayaan-4, designed to collect and return regolith samples from the Moon's South Pole. The mission will also deploy advanced deep-space navigation beacons developed in partnership with domestic aerospace startups.",
            "url": "https://paperly.news/india/isro-chandrayaan4-deep-space",
            "image_url": "https://images.unsplash.com/photo-1517976487502-598f98ec436d?auto=format&fit=crop&w=800&q=80",
            "source_name": "Space India Daily",
            "category": "india",
            "published_at": datetime.utcnow()
        },
        {
            "title": "India's Semiconductor Ecosystem Expands with Multi-Billion Dollar Fabrication Facilities",
            "description": "Major international silicon consortiums break ground on semiconductor packaging and fabrication plants in Gujarat and Karnataka under the India Semiconductor Mission.",
            "content": "The initiative marks India's entry into high-tech silicon manufacturing. The new facilities will manufacture power electronics, microcontrollers, and compound semiconductors for automotive and telecommunications hardware worldwide.",
            "url": "https://paperly.news/india/semiconductor-fabrication-mission",
            "image_url": "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80",
            "source_name": "Economic Standard",
            "category": "india",
            "published_at": datetime.utcnow()
        },
        {
            "title": "National Green Hydrogen and Solar Corridors Commissioned Across Western India",
            "description": "India expands its renewable energy grid with hybrid wind-solar transmission infrastructure connected to coastal green hydrogen electrolysis hubs.",
            "content": "The new 10-gigawatt interstate transmission corridor will transport electricity from high-yield solar parks directly to coastal industrial clusters, accelerating decarbonization goals and green ammonia export capabilities.",
            "url": "https://paperly.news/india/green-hydrogen-solar-corridor",
            "image_url": "https://images.unsplash.com/photo-1466611653911-95081537e5b7?auto=format&fit=crop&w=800&q=80",
            "source_name": "India Energy Times",
            "category": "india",
            "published_at": datetime.utcnow()
        },
        {
            "title": "AI in Indian Agriculture: Satellite Imagery and Predictive Models Transform Crop Yields",
            "description": "Agritech startups in partnership with state universities deploy generative algorithms to forecast pest outbreaks and optimize drip irrigation for smallholders.",
            "content": "By combining regional multispectral satellite imagery with local soil moisture sensor readings, farmers across Maharashtra and Punjab receive micro-advisories on their mobile phones in regional languages, mitigating drought risks and raising yields by up to 25 percent.",
            "url": "https://paperly.news/india/ai-agriculture-agritech-revolution",
            "image_url": "https://images.unsplash.com/photo-1574943320219-553eb213f72d?auto=format&fit=crop&w=800&q=80",
            "source_name": "Hindustan Tech Journal",
            "category": "india",
            "published_at": datetime.utcnow()
        }
    ]

    p = get_pool()
    with p.connection() as conn:
        with conn.cursor() as cur:
            for item in sample_articles:
                text_to_embed = f"{item['title']}. {item['description']}"
                embedding = get_embedding(text_to_embed)
                try:
                    cur.execute(
                        """
                        INSERT INTO articles 
                        (title, description, content, url, image_url, source_name, category, published_at, embedding)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (url) DO NOTHING
                        """,
                        (
                            item['title'], item['description'], item['content'],
                            item['url'], item['image_url'], item['source_name'],
                            item['category'], item['published_at'], embedding
                        )
                    )
                except Exception as e:
                    print(f"Error seeding article {item['title']}: {e}")
            conn.commit()
    print("Seeding complete. Initial stories with vector embeddings are ready!")

def get_db_connection():
    p = get_pool()
    with p.connection() as conn:
        yield conn
