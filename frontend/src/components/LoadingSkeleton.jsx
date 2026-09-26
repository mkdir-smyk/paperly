import React from 'react';

export default function LoadingSkeleton({ count = 6 }) {
  return (
    <div className="articles-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton-card">
          <div className="skeleton skeleton-image" />
          <div className="skeleton skeleton-meta" />
          <div className="skeleton skeleton-title" />
          <div className="skeleton skeleton-text" />
          <div className="skeleton skeleton-text-short" />
        </div>
      ))}
    </div>
  );
}
