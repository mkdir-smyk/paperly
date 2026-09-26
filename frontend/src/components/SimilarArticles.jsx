import React from 'react';
import { Sparkles } from 'lucide-react';
import { formatDate, formatSimilarity } from '../api';

export default function SimilarArticles({ articles, loading, onSelectArticle }) {
  return (
    <aside className="recommendations-sidebar">
      <h3 className="section-heading">
        <Sparkles size={16} />
        <span>Related Stories</span>
      </h3>
      <div className="similar-list">
        {loading && (
          <div className="loading">Finding related stories...</div>
        )}

        {!loading && articles.length === 0 && (
          <p className="loading">No related stories found.</p>
        )}

        {!loading &&
          articles.map((item) => (
            <div
              key={item.id}
              className="similar-item"
              onClick={() => onSelectArticle(item.id)}
            >
              <h4>
                <a
                  href={`#article-${item.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    onSelectArticle(item.id);
                  }}
                >
                  {item.title}
                </a>
              </h4>
              <div className="meta">
                {item.source_name || 'Source'} &middot; {formatDate(item.published_at)}
              </div>
              <div className="similarity-score">
                {formatSimilarity(item.similarity)}
              </div>
            </div>
          ))}
      </div>
    </aside>
  );
}
