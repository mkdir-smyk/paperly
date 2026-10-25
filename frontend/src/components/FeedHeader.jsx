import React from 'react';
import { RefreshCw, Search, X, Sparkles, Globe, MapPin } from 'lucide-react';

export default function FeedHeader({
  category,
  onSelectCategory,
  onTriggerIngest,
  isIngesting,
  searchQuery,
  onSearchChange,
  articleCount,
  hasMore = false,
}) {
  const getCategoryTitle = (cat) => {
    switch (cat) {
      case 'world':
        return 'World News';
      case 'india':
        return 'India News';
      default:
        return 'Top Stories';
    }
  };

  // Formatted date string for authentic editorial edition banner
  const todayDate = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date());

  return (
    <section className="feed-header-section">
      {/* Newspaper edition bar */}
      <div className="edition-bar">
        <div className="edition-date">{todayDate}</div>
        <div className="edition-badge">
          <span>Daily Edition</span>
        </div>
        <div className="edition-stats">
          <span>{articleCount}{hasMore ? '+' : ''} {articleCount === 1 ? 'Story' : 'Stories'} Available</span>
        </div>
      </div>

      <div className="feed-header-main">
        <div>
          <h2 className="feed-title">{getCategoryTitle(category)}</h2>
          <p className="feed-subtitle">
            Curated coverage and in-depth reporting from around the world
          </p>
        </div>

        <div className="feed-actions">
          {/* Quick search input */}
          <div className="search-box">
            <Search size={15} className="search-icon" />
            <input
              type="text"
              placeholder="Filter stories..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              aria-label="Filter stories"
            />
            {searchQuery && (
              <button
                className="search-clear-btn"
                onClick={() => onSearchChange('')}
                aria-label="Clear filter"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <button
            className="action-btn"
            onClick={onTriggerIngest}
            disabled={isIngesting}
            aria-label="Fetch latest news articles"
          >
            <RefreshCw size={14} className={isIngesting ? 'spin' : ''} />
            <span>{isIngesting ? 'Ingesting...' : 'Fetch Latest News'}</span>
          </button>
        </div>
      </div>
    </section>
  );
}
