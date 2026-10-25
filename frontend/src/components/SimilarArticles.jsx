import React, { useMemo } from 'react';
import { Sparkles, Clock } from 'lucide-react';
import { formatDate, formatSimilarity, calculateFreshnessScore, getFreshnessInfo } from '../api';

export default function SimilarArticles({ articles, loading, onSelectArticle }) {
  // Rank recommendations by blending semantic similarity and publication date freshness
  const rankedArticles = useMemo(() => {
    if (!articles || !articles.length) return [];
    return [...articles].sort((a, b) => {
      const scoreA = calculateFreshnessScore(a.similarity, a.published_at);
      const scoreB = calculateFreshnessScore(b.similarity, b.published_at);
      return scoreB - scoreA;
    });
  }, [articles]);

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

        {!loading && rankedArticles.length === 0 && (
          <p className="loading">No related stories found.</p>
        )}

        {!loading &&
          rankedArticles.map((item) => {
            const freshness = getFreshnessInfo(item.published_at);
            return (
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
                  {item.source_name || 'Source'} &middot;{' '}
                  <span className="meta-time">
                    <Clock size={10} />
                    <span>{freshness.label || formatDate(item.published_at)}</span>
                  </span>
                </div>
                <div className="similarity-badge-container">
                  <div className="similarity-score">
                    {formatSimilarity(item.similarity)}
                  </div>
                  {freshness.isFresh && (
                    <span className="fresh-pill">Fresh</span>
                  )}
                </div>
              </div>
            );
          })}
      </div>
    </aside>
  );
}
