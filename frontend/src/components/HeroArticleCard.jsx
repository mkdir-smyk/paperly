import React from 'react';
import { ArrowRight, Clock, Sparkles } from 'lucide-react';
import { formatDateShort } from '../api';

export default function HeroArticleCard({ article, onSelectArticle }) {
  if (!article) return null;

  return (
    <section className="hero-story-container" onClick={() => onSelectArticle(article.id)}>
      <div className="hero-story-card">
        {article.image_url && (
          <div className="hero-image-wrapper">
            <img
              src={article.image_url}
              className="hero-image"
              alt={article.title}
              onError={(e) => {
                e.target.parentElement.style.display = 'none';
              }}
            />
            <div className="hero-badge">
              <Sparkles size={13} />
              <span>Lead Story</span>
            </div>
          </div>
        )}

        <div className="hero-content">
          <div className="article-meta">
            <span className="category-tag">{article.category}</span>
            <span>{article.source_name || 'Associated Press'}</span>
            <span>&middot;</span>
            <span className="meta-time">
              <Clock size={12} />
              <span>{formatDateShort(article.published_at)}</span>
            </span>
          </div>

          <h2 className="hero-title">
            <a
              href={`#article-${article.id}`}
              onClick={(e) => {
                e.preventDefault();
                onSelectArticle(article.id);
              }}
            >
              {article.title}
            </a>
          </h2>

          <p className="hero-description">{article.description}</p>

          <div className="hero-cta">
            <span className="read-more-btn">
              <span>Read Full Story</span>
              <ArrowRight size={15} />
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
