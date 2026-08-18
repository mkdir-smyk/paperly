import os
import requests
from datetime import datetime
import psycopg

from database import get_pool, init_db
from embedder import get_embedding

NEWS_API_KEY = os.getenv("NEWS_API_KEY")

import time

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
    """Fetches articles, generates embeddings, and inserts them into the database."""
    print("Starting ingestion cycle...")
    
    india_articles = fetch_freenewsapi_articles('india')
    world_articles = fetch_freenewsapi_articles('world')
    
    all_articles = india_articles + world_articles
    
    if not all_articles:
        print("No articles fetched.")
        return {"status": "no articles fetched, check API key or limits"}

    inserted_count = 0
    pool = get_pool()
    
    with pool.connection() as conn:
        with conn.cursor() as cur:
            for article in all_articles:
                # Deduplicate by URL
                cur.execute("SELECT id FROM articles WHERE url = %s", (article['url'],))
                if cur.fetchone():
                    continue
                
                # Combine title and description for embedding
                text_to_embed = f"{article['title']}. {article['description']}"
                if not text_to_embed.strip() or len(text_to_embed.strip()) < 5:
                    text_to_embed = article['content']
                
                embedding = get_embedding(text_to_embed)
                
                try:
                    cur.execute(
                        """
                        INSERT INTO articles 
                        (title, description, content, url, image_url, source_name, category, country_code, published_at, embedding)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        """,
                        (
                            article['title'], article['description'], article['content'],
                            article['url'], article['image_url'], article['source_name'], article['category'],
                            article['country_code'], article['published_at'], embedding
                        )
                    )
                    inserted_count += 1
                except psycopg.IntegrityError:
                    conn.rollback() # URL might have been inserted concurrently
                    continue
                
            conn.commit()

    print(f"Ingestion complete. Inserted {inserted_count} new articles.")
    return {"status": "success", "inserted": inserted_count}

if __name__ == "__main__":
    init_db()
    ingest_articles()
