const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

export async function fetchArticles(category = '', limit = 12, skip = 0) {
  const params = new URLSearchParams({ limit, skip });
  if (category) {
    params.append('category', category);
  }
  const res = await fetch(`${API_BASE}/articles?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch articles: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchArticle(id) {
  const res = await fetch(`${API_BASE}/articles/${id}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch article #${id}: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchSimilarArticles(id, category = null, limit = 5) {
  const query = category ? `?category=${encodeURIComponent(category)}&limit=${limit}` : `?limit=${limit}`;
  const res = await fetch(`${API_BASE}/articles/${id}/similar${query}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch similar articles: ${res.statusText}`);
  }
  return res.json();
}

export async function triggerIngestion() {
  const res = await fetch(`${API_BASE}/ingest/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`Ingestion failed with status ${res.status}`);
  }
  return res.json();
}

export function formatDate(dateString) {
  if (!dateString) return '';
  const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
  try {
    return new Date(dateString).toLocaleDateString('en-US', options);
  } catch {
    return dateString;
  }
}

export function formatDateShort(dateString) {
  if (!dateString) return '';
  const options = { year: 'numeric', month: 'short', day: 'numeric' };
  try {
    return new Date(dateString).toLocaleDateString('en-US', options);
  } catch {
    return dateString;
  }
}

export function formatSimilarity(score) {
  if (typeof score !== 'number') return '';
  return (score * 100).toFixed(1) + '% match';
}

/**
 * Calculates a composite relevance/freshness score based on semantic similarity and date difference.
 * 
 * Function points:
 * 1. Semantic Similarity: Cosine similarity vector score (0.0 to 1.0)
 * 2. Date Difference: Elapsed duration between current date and publication date (freshness decay)
 * 
 * @param {number|null|undefined} similarity - Semantic similarity (0.0 to 1.0) or null
 * @param {string|Date} publishedAt - Article publication timestamp
 * @param {Date} [currentDate=new Date()] - Reference date (defaults to current date)
 * @returns {number} Normalized score from 0.0 to 1.0
 */
export function calculateFreshnessScore(similarity, publishedAt, currentDate = new Date()) {
  const pubDate = publishedAt ? new Date(publishedAt) : currentDate;
  const diffMs = Math.max(0, currentDate.getTime() - pubDate.getTime());
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  // Recency decay factor using exponential decay
  // Recent stories (today) ~ 0.95 - 1.0; 7 days old ~ 0.70; 30 days old ~ 0.22
  const freshness = Math.exp(-0.05 * diffDays);

  if (typeof similarity === 'number' && !isNaN(similarity)) {
    // Blends semantic similarity (70% weight) and date freshness (30% weight)
    return Math.min(1, Math.max(0, (similarity * 0.7) + (freshness * 0.3)));
  }

  return freshness;
}

/**
 * Returns human-readable relative time and freshness indicators for an article based on current date.
 * @param {string|Date} publishedAt
 * @param {Date} [currentDate=new Date()]
 * @returns {{ label: string, isFresh: boolean, score: number }}
 */
export function getFreshnessInfo(publishedAt, currentDate = new Date()) {
  if (!publishedAt) {
    return { label: '', isFresh: false, score: 0 };
  }
  const pubDate = new Date(publishedAt);
  const diffMs = currentDate.getTime() - pubDate.getTime();

  if (isNaN(diffMs)) {
    return { label: '', isFresh: false, score: 0 };
  }

  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const score = calculateFreshnessScore(null, publishedAt, currentDate);

  if (diffMinutes < 1) {
    return { label: 'Just now', isFresh: true, score };
  }
  if (diffMinutes < 60) {
    return { label: `${diffMinutes}m ago`, isFresh: true, score };
  }
  if (diffHours < 24) {
    return { label: `${diffHours}h ago`, isFresh: true, score };
  }
  if (diffDays === 1) {
    return { label: 'Yesterday', isFresh: false, score };
  }
  if (diffDays < 7) {
    return { label: `${diffDays}d ago`, isFresh: false, score };
  }
  return { label: formatDateShort(publishedAt), isFresh: false, score };
}
