import React, { useState, useEffect } from 'react';
import { Search, X, Loader2, Clock } from 'lucide-react';

export default function FeedHeader({
  category,
  searchQuery,
  onSearchChange,
  searching = false,
}) {
  const [userTime, setUserTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setUserTime(
        now.toLocaleTimeString(undefined, {
          hour: 'numeric',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

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
        {userTime && (
          <div className="edition-time">
            <Clock size={12} />
            <span>{userTime} Local Time</span>
          </div>
        )}
      </div>

      <div className="feed-header-main">
        <div>
          <div className="feed-title-row">
            <h2 className="feed-title">{getCategoryTitle(category)}</h2>
            {userTime && (
              <span className="feed-title-time">
                <Clock size={13} />
                <span>{userTime}</span>
              </span>
            )}
          </div>
          <p className="feed-subtitle">
            Curated coverage and in-depth reporting from around the world
          </p>
        </div>

        <div className="feed-actions">
          {/* Quick semantic search input */}
          <div className="search-box">
            {searching ? (
              <Loader2 size={15} className="search-icon spin" />
            ) : (
              <Search size={15} className="search-icon" />
            )}
            <input
              type="text"
              placeholder="Search concepts or topics..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              aria-label="Search stories"
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
        </div>
      </div>
    </section>
  );
}
