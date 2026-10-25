import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronDown } from 'lucide-react';
import Header from './components/Header';
import FeedHeader from './components/FeedHeader';
import HeroArticleCard from './components/HeroArticleCard';
import ArticleCard from './components/ArticleCard';
import ArticleView from './components/ArticleView';
import LoadingSkeleton from './components/LoadingSkeleton';
import Toast from './components/Toast';
import {
  fetchArticles,
  fetchArticle,
  fetchSimilarArticles,
  triggerIngestion,
  calculateFreshnessScore,
} from './api';

const PAGE_SIZE = 12;

export default function App() {
  const [currentCategory, setCurrentCategory] = useState('');
  const [articles, setArticles] = useState([]);
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeArticleId, setActiveArticleId] = useState(null);
  const [currentArticle, setCurrentArticle] = useState(null);
  const [loadingArticle, setLoadingArticle] = useState(false);
  const [similarArticles, setSimilarArticles] = useState([]);
  const [loadingSimilar, setLoadingSimilar] = useState(false);
  const [isIngesting, setIsIngesting] = useState(false);
  const [toast, setToast] = useState(null);

  // Check URL params on initial load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const idParam = params.get('id');
    const categoryParam = params.get('category');

    if (idParam) {
      setActiveArticleId(parseInt(idParam, 10));
    } else if (categoryParam) {
      setCurrentCategory(categoryParam);
    }
  }, []);

  // Listen to browser popstate (back/forward navigation)
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const idParam = params.get('id');
      const categoryParam = params.get('category') || '';
      
      if (idParam) {
        setActiveArticleId(parseInt(idParam, 10));
      } else {
        setActiveArticleId(null);
        setCurrentCategory(categoryParam);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Load initial feed whenever category changes or when navigating back to feed view
  const loadFeed = useCallback(async (category = currentCategory) => {
    setLoadingFeed(true);
    setHasMore(true);
    try {
      const data = await fetchArticles(category, PAGE_SIZE, 0);
      const items = data || [];
      setArticles(items);
      setHasMore(items.length === PAGE_SIZE);
    } catch (err) {
      console.error('Failed to load feed:', err);
      setToast({
        type: 'error',
        message: 'Could not connect to news feed. Check API/database connection.',
      });
    } finally {
      setLoadingFeed(false);
    }
  }, [currentCategory]);

  useEffect(() => {
    if (!activeArticleId) {
      loadFeed(currentCategory);
    }
  }, [currentCategory, activeArticleId, loadFeed]);

  // Load next batch of articles without delay
  const handleLoadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const skip = articles.length;
      const nextBatch = await fetchArticles(currentCategory, PAGE_SIZE, skip);
      if (nextBatch && nextBatch.length > 0) {
        setArticles((prev) => {
          const existingIds = new Set(prev.map((a) => a.id));
          const newItems = nextBatch.filter((a) => !existingIds.has(a.id));
          return [...prev, ...newItems];
        });
        setHasMore(nextBatch.length === PAGE_SIZE);
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error('Failed to load more articles:', err);
      setToast({
        type: 'error',
        message: 'Failed to load more stories.',
      });
    } finally {
      setLoadingMore(false);
    }
  };

  // Load article & similar recommendations
  useEffect(() => {
    if (!activeArticleId) {
      setCurrentArticle(null);
      setSimilarArticles([]);
      return;
    }

    let isMounted = true;
    setLoadingArticle(true);
    setLoadingSimilar(true);

    fetchArticle(activeArticleId)
      .then((articleData) => {
        if (!isMounted) return;
        setCurrentArticle(articleData);
        setLoadingArticle(false);
        document.title = `${articleData.title} - Paperly`;

        return fetchSimilarArticles(articleData.id, articleData.category);
      })
      .then((similarData) => {
        if (!isMounted || !similarData) return;
        setSimilarArticles(similarData);
        setLoadingSimilar(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('Error fetching article details:', err);
        setLoadingArticle(false);
        setLoadingSimilar(false);
        setToast({
          type: 'error',
          message: 'Failed to load article content or recommendations.',
        });
      });

    return () => {
      isMounted = false;
    };
  }, [activeArticleId]);

  // Rank articles based on current date and freshness score
  const freshnessRankedArticles = useMemo(() => {
    return [...articles].sort((a, b) => {
      const scoreA = calculateFreshnessScore(null, a.published_at);
      const scoreB = calculateFreshnessScore(null, b.published_at);
      return scoreB - scoreA;
    });
  }, [articles]);

  // Filter articles based on search query
  const filteredArticles = useMemo(() => {
    if (!searchQuery.trim()) return freshnessRankedArticles;
    const query = searchQuery.toLowerCase();
    return freshnessRankedArticles.filter((art) => {
      const titleMatch = art.title?.toLowerCase().includes(query);
      const descMatch = art.description?.toLowerCase().includes(query);
      const sourceMatch = art.source_name?.toLowerCase().includes(query);
      return titleMatch || descMatch || sourceMatch;
    });
  }, [freshnessRankedArticles, searchQuery]);

  // Navigate to an article
  const handleSelectArticle = (id) => {
    setActiveArticleId(id);
    const newUrl = `${window.location.pathname}?id=${id}`;
    window.history.pushState({ id }, '', newUrl);
  };

  // Back to feed
  const handleBackToFeed = () => {
    setActiveArticleId(null);
    setCurrentArticle(null);
    document.title = 'Paperly - The Global News Feed';
    const newUrl = currentCategory
      ? `${window.location.pathname}?category=${currentCategory}`
      : window.location.pathname;
    window.history.pushState({}, '', newUrl);
  };

  // Switch category
  const handleSelectCategory = (cat) => {
    setCurrentCategory(cat);
    setSearchQuery('');
    setArticles([]);
    setHasMore(true);
    if (activeArticleId) {
      setActiveArticleId(null);
      setCurrentArticle(null);
    }
    const newUrl = cat
      ? `${window.location.pathname}?category=${cat}`
      : window.location.pathname;
    window.history.pushState({}, '', newUrl);
  };

  // Trigger Ingestion
  const handleTriggerIngest = async () => {
    setIsIngesting(true);
    try {
      const res = await triggerIngestion();
      const count = res.inserted ?? 0;
      setToast({
        type: 'success',
        message: `Ingestion complete! Added ${count} new stories.`,
      });
      loadFeed(currentCategory);
    } catch (err) {
      console.error('Ingestion error:', err);
      setToast({
        type: 'error',
        message: 'Ingestion failed. Ensure NEWS_API_KEY is configured.',
      });
    } finally {
      setIsIngesting(false);
    }
  };

  const hasSearch = searchQuery.trim().length > 0;
  const leadArticle = !hasSearch && filteredArticles.length > 0 ? filteredArticles[0] : null;
  const remainingArticles = !hasSearch && filteredArticles.length > 0
    ? filteredArticles.slice(1)
    : filteredArticles;

  return (
    <>
      <Header
        currentCategory={currentCategory}
        onSelectCategory={handleSelectCategory}
        viewingArticle={!!activeArticleId}
        onBackToFeed={handleBackToFeed}
      />

      <main className="main-content">
        {activeArticleId ? (
          <ArticleView
            article={currentArticle}
            loading={loadingArticle}
            similarArticles={similarArticles}
            loadingSimilar={loadingSimilar}
            onSelectArticle={handleSelectArticle}
            onBackToFeed={handleBackToFeed}
          />
        ) : (
          <div className="container">
            <FeedHeader
              category={currentCategory}
              onSelectCategory={handleSelectCategory}
              onTriggerIngest={handleTriggerIngest}
              isIngesting={isIngesting}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              articleCount={articles.length}
              hasMore={hasMore}
            />

            {loadingFeed ? (
              <LoadingSkeleton count={6} />
            ) : filteredArticles.length === 0 ? (
              <div className="empty-state">
                {hasSearch ? (
                  <>
                    <h3>No stories match your search</h3>
                    <p>No articles found for "{searchQuery}".</p>
                    <button
                      className="action-btn"
                      style={{ marginTop: '1rem' }}
                      onClick={() => setSearchQuery('')}
                    >
                      Clear Search Filter
                    </button>
                  </>
                ) : (
                  <>
                    <h3>No articles found</h3>
                    <p>Click "Fetch Latest News" above to populate the feed with stories.</p>
                  </>
                )}
              </div>
            ) : (
              <>
                {/* Hero Lead Story (when not searching) */}
                {leadArticle && (
                  <HeroArticleCard
                    article={leadArticle}
                    onSelectArticle={handleSelectArticle}
                  />
                )}

                {/* Remaining Stories Grid */}
                {remainingArticles.length > 0 && (
                  <div className="articles-grid">
                    {remainingArticles.map((article, idx) => (
                      <ArticleCard
                        key={article.id}
                        article={article}
                        index={idx}
                        onSelectArticle={handleSelectArticle}
                      />
                    ))}
                  </div>
                )}

                {/* Loading skeleton animation to fill the void time when loading more */}
                {loadingMore && (
                  <div className="loading-more-container">
                    <LoadingSkeleton count={3} />
                  </div>
                )}

                {/* Load More Button or End of Edition Marker */}
                {!hasSearch && hasMore && !loadingFeed && (
                  <div className="load-more-section">
                    <button
                      className="action-btn load-more-btn"
                      onClick={handleLoadMore}
                      disabled={loadingMore}
                      aria-label="Load more articles"
                    >
                      <ChevronDown size={16} className={loadingMore ? 'spin' : ''} />
                      <span>{loadingMore ? 'Loading More Stories...' : 'Load More Stories'}</span>
                    </button>
                  </div>
                )}

                {!hasSearch && !hasMore && articles.length > 0 && !loadingFeed && (
                  <div className="end-of-feed">
                    <div className="end-of-feed-line" />
                    <span>All {articles.length} stories loaded for this edition</span>
                    <div className="end-of-feed-line" />
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </main>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </>
  );
}
