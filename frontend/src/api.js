const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

export async function fetchArticles(category = '', limit = 30) {
  const url = category
    ? `${API_BASE}/articles?category=${encodeURIComponent(category)}&limit=${limit}`
    : `${API_BASE}/articles?limit=${limit}`;
  const res = await fetch(url);
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
