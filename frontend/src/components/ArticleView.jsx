import React, { useEffect } from 'react';
import { ExternalLink } from 'lucide-react';
import { formatDate } from '../api';
import SimilarArticles from './SimilarArticles';

export default function ArticleView({
  article,
  loading,
  similarArticles,
  loadingSimilar,
  onSelectArticle,
}) {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [article?.id]);

  if (loading) {
    return (
      <div className="container article-container">
        <div className="article-full">
          <div className="skeleton skeleton-meta" style={{ width: '25%', height: '16px', marginBottom: '1rem' }} />
          <div className="skeleton skeleton-title" style={{ height: '48px', marginBottom: '1.5rem' }} />
          <div className="skeleton skeleton-image" style={{ height: '350px', marginBottom: '2rem' }} />
          <div className="skeleton skeleton-text" style={{ marginBottom: '1rem' }} />
          <div className="skeleton skeleton-text" style={{ marginBottom: '1rem' }} />
          <div className="skeleton skeleton-text-short" />
        </div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="container article-container">
        <div className="article-full empty-state">
          <h3>Article Not Found</h3>
          <p>The story you are looking for may have been moved or is no longer available.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container article-container">
      <article className="article-full">
        <div className="article-meta">
          <span className="category-tag">{article.category}</span>
          <span>By <strong>{article.source_name || 'Associated Press'}</strong></span>
          <span>&middot;</span>
          <span>{formatDate(article.published_at)}</span>
        </div>

        <h1>{article.title}</h1>

        {article.image_url && (
          <img
            src={article.image_url}
            className="article-full-image"
            alt={article.title}
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />
        )}

        <div className="article-body">
          {article.content ? (
            <p>{article.content}</p>
          ) : article.description ? (
            <p>{article.description}</p>
          ) : (
            <p>No full text preview available for this story.</p>
          )}
        </div>

        {article.url && (
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="source-link"
          >
            <span>Read full story on original publisher</span>
            <ExternalLink size={16} />
          </a>
        )}
      </article>

      <SimilarArticles
        articles={similarArticles}
        loading={loadingSimilar}
        onSelectArticle={onSelectArticle}
      />
    </div>
  );
}
