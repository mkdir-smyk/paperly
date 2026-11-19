import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")
load_dotenv(Path(__file__).resolve().parent.parent / ".env")
load_dotenv()

import requests
from datetime import datetime
import psycopg
import time
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime
import re

from database import get_pool, init_db
from embedder import get_embedding, get_embeddings_batch

NEWS_API_KEY = os.getenv("NEWS_API_KEY")

def clean_html(raw_html: str) -> str:
    """Removes HTML tags and decodes common entities."""
    if not raw_html:
        return ""
    clean_text = re.sub(r'<[^>]+>', '', raw_html)
    return clean_text.strip()

RSS_FEEDS = {
    'world': [
        {
            'url': 'https://feeds.bbci.co.uk/news/world/rss.xml',
            'source_name': 'BBC World News'
        },
        {
            'url': 'https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx1YlY4U0FtVnVHZ0pWVXlnQVAB?hl=en-US&gl=US&ceid=US:en',
            'source_name': 'Google News'
        }
    ],
    'india': [
        {
            'url': 'https://www.thehindu.com/news/national/feeder/default.rss',
            'source_name': 'The Hindu'
        },
        {
            'url': 'https://news.google.com/rss/topics/CAAqIQgKIhtDQkFTRGdvSUwyMHZNRE55YXpBU0FtVnVLQUFQAQ?hl=en-IN&gl=IN&ceid=IN:en',
            'source_name': 'Google News India'
        }
    ]
}

def fetch_rss_articles(category: str) -> list:
    """Fetches articles from public RSS feeds without requiring external API keys."""
    articles = []
    feeds = RSS_FEEDS.get(category, [])
    headers = {
        'User-Agent': 'Paperly-Bot/1.0 (+https://paperly.news)'
    }
    
    for feed in feeds:
        try:
            resp = requests.get(feed['url'], headers=headers, timeout=10)
            if resp.status_code != 200:
                continue
            
            root = ET.fromstring(resp.content)
            items = root.findall('.//item')[:15]
            
            for item in items:
                title = item.findtext('title') or ''
                link = item.findtext('link') or ''
                desc = clean_html(item.findtext('description') or '')
                pub_date_str = item.findtext('pubDate')
                
                if not title.strip() or not link.strip():
                    continue
                    
                published_at = datetime.utcnow()
                if pub_date_str:
                    try:
                        published_at = parsedate_to_datetime(pub_date_str)
                    except Exception:
                        published_at = datetime.utcnow()
                        
                image_url = None
                enclosure = item.find('enclosure')
                if enclosure is not None and 'image' in enclosure.attrib.get('type', ''):
                    image_url = enclosure.attrib.get('url')
                
                if not image_url:
                    for child in item:
                        if child.tag.endswith('thumbnail') or child.tag.endswith('content'):
                            if 'url' in child.attrib:
                                image_url = child.attrib['url']
                                break
                                
                articles.append({
                    'title': title.strip(),
                    'description': desc.strip(),
                    'content': desc.strip(),
                    'url': link.strip(),
                    'image_url': image_url,
                    'source_name': feed['source_name'],
                    'category': category,
                    'country_code': 'in' if category == 'india' else None,
                    'published_at': published_at
                })
        except Exception as e:
            print(f"Notice: RSS fetch for {feed['url']} encountered {e}")
            
    return articles

def fetch_freenewsapi_articles(category: str) -> list:
    """
    Fetches articles from FreeNewsApi.io.
    category: 'india' or 'world'
    """
    if not NEWS_API_KEY:
        print("NEWS_API_KEY is not set. Skipping ingestion.")
        return []

    articles = []
    base_news_url = "https://api.freenewsapi.io/v1/news"
    base_details_url = "https://api.freenewsapi.io/v1/details"
    
    headers = {
        "x-api-key": NEWS_API_KEY
    }
    
    # India news uses country=in, World news skips the country parameter
    params = {'language': 'en'}
    if category == 'india':
        params['country'] = 'in'

    try:
        response = requests.get(base_news_url, params=params, headers=headers)
        response.raise_for_status()
        data = response.json()
        
        # Get up to 10 articles to avoid hitting rate limits too hard (2 req/sec)
        items = data.get('data', [])[:10]
        
        for item in items:
            uuid = item.get('uuid')
            if not uuid:
                continue
                
            # Fetch details for each article to get content and URL
            # Sleeping to respect the 2 req/sec limit
            time.sleep(0.5)
            
            try:
                detail_resp = requests.get(base_details_url, params={'uuid': uuid}, headers=headers)
                if detail_resp.status_code != 200:
                    continue
                
                detail_data = detail_resp.json().get('data', {})
                if not detail_data:
                    continue
                
                published_at = None
                try:
                    published_at = datetime.strptime(detail_data.get('published_at', ''), "%Y-%m-%dT%H:%M:%S.%fZ")
                except ValueError:
                    try:
                        published_at = datetime.strptime(detail_data.get('published_at', ''), "%Y-%m-%dT%H:%M:%SZ")
                    except ValueError:
                        published_at = datetime.now()
                    
                articles.append({
                    'title': detail_data.get('title', ''),
                    'description': detail_data.get('incipit', ''),
                    'content': detail_data.get('body', ''),
                    'url': detail_data.get('original_url', uuid), # Fallback to uuid if no url
                    'image_url': detail_data.get('thumbnail', ''),
                    'source_name': detail_data.get('publisher', ''),
                    'category': category,
                    'country_code': 'in' if category == 'india' else None,
                    'published_at': published_at
                })
            except Exception as e:
                print(f"Error fetching details for {uuid}: {e}")
                
    except Exception as e:
        print(f"Error fetching {category} news: {e}")

    return articles


def ingest_articles():
    """Fetches articles from API and RSS feeds, generates batched embeddings, and inserts them cleanly."""
    print("Starting ingestion cycle...")
    
    # 1. Fetch from FreeNewsAPI if key is available
    india_articles = fetch_freenewsapi_articles('india')
    world_articles = fetch_freenewsapi_articles('world')
    
    # 2. Fall back to / supplement with standard RSS feeds (guarantees zero-cost, reliable ingestion)
    if not india_articles:
        india_articles = fetch_rss_articles('india')
    if not world_articles:
        world_articles = fetch_rss_articles('world')
    
    raw_articles = india_articles + world_articles
    
    if not raw_articles:
        print("No articles fetched from any source.")
        return {"status": "no articles fetched, check network or source endpoints"}

    # In-memory deduplication by URL
    seen_urls = set()
    candidate_articles = []
    for art in raw_articles:
        url = art.get('url')
        if url and url not in seen_urls:
            seen_urls.add(url)
            candidate_articles.append(art)

    inserted_count = 0
    pool = get_pool()
    
    with pool.connection() as conn:
        with conn.cursor() as cur:
            # Efficiently filter out articles that already exist in the database
            all_urls = [a['url'] for a in candidate_articles]
            cur.execute("SELECT url FROM articles WHERE url = ANY(%s)", (all_urls,))
            existing_db_urls = {row[0] for row in cur.fetchall()}
            
            fresh_articles = [a for a in candidate_articles if a['url'] not in existing_db_urls]
            
            if not fresh_articles:
                print("All fetched articles already exist in database.")
                return {"status": "success", "inserted": 0, "message": "Feed is up to date"}

            # Prepare text for batched tensor encoding
            texts_to_embed = []
            for art in fresh_articles:
                t = f"{art['title']}. {art.get('description', '')}".strip()
                if not t or len(t) < 5:
                    t = art.get('content', '') or art['title']
                texts_to_embed.append(t)

            # Batched embedding generation (leveraging PyTorch SIMD / batch acceleration)
            print(f"Generating batched embeddings for {len(fresh_articles)} fresh articles...")
            embeddings = get_embeddings_batch(texts_to_embed, batch_size=32)

            for art, emb in zip(fresh_articles, embeddings):
                try:
                    cur.execute(
                        """
                        INSERT INTO articles 
                        (title, description, content, url, image_url, source_name, category, country_code, published_at, embedding)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (url) DO NOTHING
                        """,
                        (
                            art['title'], art['description'], art['content'],
                            art['url'], art['image_url'], art['source_name'], art['category'],
                            art['country_code'], art['published_at'], emb
                        )
                    )
                    inserted_count += cur.rowcount
                except Exception as e:
                    print(f"Error inserting article {art.get('title')}: {e}")
                    continue
                
            conn.commit()

    print(f"Ingestion complete. Inserted {inserted_count} new articles.")
    return {"status": "success", "inserted": inserted_count}

if __name__ == "__main__":
    init_db()
    ingest_articles()
