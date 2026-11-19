import React from 'react';
import { ArrowRight, Clock, Bookmark } from 'lucide-react';
import { formatDateShort, getFreshnessInfo } from '../api';

export default function ArticleCard({
  article,
  index,
  onSelectArticle,
  isBookmarked = false,
  onToggleBookmark,
}) {
  const staggerDelay = `${Math.min(index * 45, 500)}ms`;
  const freshness = getFreshnessInfo(article.published_at);

  return (
    <article
      className="article-card"
      style={{ animationDelay: staggerDelay }}
      onClick={() => onSelectArticle(article.id)}
    >
      {article.image_url && (
        <div className="article-image-wrapper">
          <img
            src={article.image_url}
            className="article-image"
            alt={article.title}
            loading="lazy"
            onError={(e) => {
              e.target.parentElement.style.display = 'none';
            }}
          />
        </div>
      )}
      <div className="article-meta">
        <span className="category-tag">{article.category}</span>
        <span>{article.source_name || 'News Source'}</span>
        <span>&middot;</span>
        <span className="meta-time">
          <Clock size={11} />
          <span>{freshness.label || formatDateShort(article.published_at)}</span>
        </span>
        {freshness.isFresh && (
          <span className="fresh-pill">Fresh</span>
        )}
      </div>
      <h3>
        <a
          href={`#article-${article.id}`}
          onClick={(e) => {
            e.preventDefault();
            onSelectArticle(article.id);
          }}
        >
          {article.title}
        </a>
      </h3>
      {article.description && <p>{article.description}</p>}
      
      <div className="card-footer-cta">
        <div className="card-link-group">
          <span className="card-link-text">Read story</span>
          <ArrowRight size={13} className="arrow-icon" />
        </div>
        {onToggleBookmark && (
          <button
            className={`bookmark-icon-btn ${isBookmarked ? 'active' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              onToggleBookmark(article.id);
            }}
            aria-label={isBookmarked ? 'Remove from saved' : 'Save for later'}
            title={isBookmarked ? 'Remove from saved' : 'Save for later'}
          >
            <Bookmark size={14} fill={isBookmarked ? 'currentColor' : 'none'} />
          </button>
        )}
      </div>
    </article>
  );
}
