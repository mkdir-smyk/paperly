import React, { useState, useEffect } from 'react';
import { ArrowLeft, Globe, MapPin, Sparkles, Clock } from 'lucide-react';

export default function Header({ currentCategory, onSelectCategory, viewingArticle, onBackToFeed }) {
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

  return (
    <header className="site-header">
      <div className="container">
        <div className="brand-header-area">
          <h1 className="logo">
            <a href="#" onClick={(e) => { e.preventDefault(); onBackToFeed(); }}>
              Paperly.
            </a>
          </h1>
          {userTime && (
            <div className="header-local-time" title="Your local time">
              <Clock size={12} />
              <span>{userTime}</span>
            </div>
          )}
        </div>
        <nav className="main-nav">
          {viewingArticle ? (
            <button className="nav-link" onClick={onBackToFeed}>
              <ArrowLeft size={16} />
              <span>Back to Feed</span>
            </button>
          ) : (
            <>
              <button
                className={`nav-btn ${currentCategory === '' ? 'active' : ''}`}
                onClick={() => onSelectCategory('')}
              >
                <Sparkles size={14} />
                <span>Top Stories</span>
              </button>
              <button
                className={`nav-btn ${currentCategory === 'world' ? 'active' : ''}`}
                onClick={() => onSelectCategory('world')}
              >
                <Globe size={14} />
                <span>World</span>
              </button>
              <button
                className={`nav-btn ${currentCategory === 'india' ? 'active' : ''}`}
                onClick={() => onSelectCategory('india')}
              >
                <MapPin size={14} />
                <span>India</span>
              </button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
