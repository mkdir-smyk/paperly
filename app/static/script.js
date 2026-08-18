const API_BASE = '/api';

// Format date helper (Full)
function formatDate(dateString) {
    if (!dateString) return '';
    const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(dateString).toLocaleDateString('en-US', options);
}

// Format date helper (Short - without time)
function formatDateShort(dateString) {
    if (!dateString) return '';
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('en-US', options);
}

// Format similarity score to percentage
function formatSimilarity(score) {
    return (score * 100).toFixed(1) + '% match';
}

// Render a single article card for the grid
function renderArticleCard(article) {
    const imageHtml = article.image_url ? `<div class="article-image-wrapper"><img src="${article.image_url}" class="article-image" alt="Article image"></div>` : '';
    return `
        <article class="article-card">
            ${imageHtml}
            <div class="article-meta">
                <span class="category-tag">${article.category}</span>
                <span>${article.source_name || 'Unknown Source'}</span>
                <span>${formatDateShort(article.published_at)}</span>
            </div>
            <h3><a href="article.html?id=${article.id}">${article.title}</a></h3>
            <p>${article.description || ''}</p>
        </article>
    `;
}

// Render similar article item for sidebar
function renderSimilarItem(article) {
    return `
        <div class="similar-item">
            <h4><a href="article.html?id=${article.id}">${article.title}</a></h4>
            <div class="meta">
                ${article.source_name || 'Unknown'} &middot; ${formatDate(article.published_at)}
            </div>
            <div class="similarity-score">${formatSimilarity(article.similarity)}</div>
        </div>
    `;
}

// Fetch and display articles on the home page
async function loadFeed(category = '') {
    const grid = document.getElementById('articles-grid');
    if (!grid) return; // Not on home page

    grid.innerHTML = '<div class="loading">Loading stories...</div>';
    
    try {
        const url = category ? `${API_BASE}/articles?category=${category}` : `${API_BASE}/articles`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Network response was not ok');
        
        const articles = await response.json();
        
        if (articles.length === 0) {
            grid.innerHTML = '<p>No articles found. Try fetching latest news.</p>';
            return;
        }

        grid.innerHTML = articles.map(renderArticleCard).join('');
    } catch (error) {
        console.error('Error fetching articles:', error);
        grid.innerHTML = '<p>Error loading articles. Please try again later.</p>';
    }
}

// Load full article details and related stories
async function loadArticle(id) {
    const contentDiv = document.getElementById('article-content');
    if (!contentDiv) return;

    try {
        // Fetch article details
        const response = await fetch(`${API_BASE}/articles/${id}`);
        if (!response.ok) throw new Error('Article not found');
        const article = await response.json();

        document.title = `${article.title} - Paperly`;

        const imageHtml = article.image_url ? `<img src="${article.image_url}" class="article-full-image" alt="Article image">` : '';

        contentDiv.innerHTML = `
            <div class="article-meta">
                <span class="category-tag">${article.category}</span>
                <span>By <strong>${article.source_name || 'Unknown Source'}</strong></span>
                <span>${formatDate(article.published_at)}</span>
            </div>
            <h1>${article.title}</h1>
            ${imageHtml}
            <div class="article-body">
                ${article.content ? `<p>${article.content}</p>` : ''}
                ${!article.content && article.description ? `<p>${article.description}</p>` : ''}
            </div>
            ${article.url ? `<a href="${article.url}" target="_blank" rel="noopener" class="source-link">Read full story on original site &rarr;</a>` : ''}
        `;

        // Fetch similar articles
        loadSimilarArticles(id, article.category);

    } catch (error) {
        console.error('Error loading article:', error);
        contentDiv.innerHTML = '<h2>Article not found</h2><p>The article you are looking for does not exist or has been removed.</p>';
        document.getElementById('similar-articles').innerHTML = '';
    }
}

async function loadSimilarArticles(id, category) {
    const similarDiv = document.getElementById('similar-articles');
    try {
        // We can optionally filter by the same category
        const response = await fetch(`${API_BASE}/articles/${id}/similar`);
        if (!response.ok) throw new Error('Error fetching similar');
        
        const articles = await response.json();
        
        if (articles.length === 0) {
            similarDiv.innerHTML = '<p>No related stories found.</p>';
            return;
        }

        similarDiv.innerHTML = articles.map(renderSimilarItem).join('');
    } catch (error) {
        console.error('Error loading similar articles:', error);
        similarDiv.innerHTML = '<p>Failed to load recommendations.</p>';
    }
}

// Event Listeners for Home Page
document.addEventListener('DOMContentLoaded', () => {
    // Nav buttons
    const navButtons = document.querySelectorAll('.nav-btn');
    const feedTitle = document.getElementById('feed-title');
    
    if (navButtons.length > 0 && document.getElementById('articles-grid')) {
        // Initial load
        loadFeed('');

        navButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                navButtons.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                
                const category = e.target.dataset.category;
                feedTitle.textContent = e.target.textContent;
                loadFeed(category);
            });
        });
    }

    // Manual ingest button
    const ingestBtn = document.getElementById('trigger-ingest');
    if (ingestBtn) {
        ingestBtn.addEventListener('click', async () => {
            ingestBtn.disabled = true;
            const originalText = ingestBtn.textContent;
            ingestBtn.textContent = 'Fetching...';
            
            try {
                const response = await fetch(`${API_BASE}/ingest/run`, { method: 'POST' });
                const result = await response.json();
                alert(`Ingestion complete! Inserted ${result.inserted || 0} new articles.`);
                
                // Reload current category
                const activeCategory = document.querySelector('.nav-btn.active').dataset.category;
                loadFeed(activeCategory);
            } catch (error) {
                console.error('Ingestion failed:', error);
                alert('Failed to trigger ingestion.');
            } finally {
                ingestBtn.disabled = false;
                ingestBtn.textContent = originalText;
            }
        });
    }
});
