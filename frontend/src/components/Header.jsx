import React from 'react';
import { ArrowLeft, Globe, MapPin, Sparkles } from 'lucide-react';

export default function Header({ currentCategory, onSelectCategory, viewingArticle, onBackToFeed }) {
  return (
    <header className="site-header">
      <div className="container">
        <h1 className="logo">
          <a href="#" onClick={(e) => { e.preventDefault(); onBackToFeed(); }}>
            Paperly.
          </a>
        </h1>
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
