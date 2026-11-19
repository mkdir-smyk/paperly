import React from 'react';
import { ArrowLeft, Bookmark } from 'lucide-react';

export default function Header({
  currentCategory,
  onSelectCategory,
  viewingArticle,
  onBackToFeed,
  user,
  onOpenAuth,
  onLogout,
}) {
  return (
    <header className="site-header">
      <div className="container">
        <h1 className="logo">
          <a href="#" onClick={(e) => { e.preventDefault(); onBackToFeed(); }}>
            Paperly.
          </a>
        </h1>
        <div className="header-right-group">
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
                  <span>Top Stories</span>
                </button>
                <button
                  className={`nav-btn ${currentCategory === 'world' ? 'active' : ''}`}
                  onClick={() => onSelectCategory('world')}
                >
                  <span>World</span>
                </button>
                <button
                  className={`nav-btn ${currentCategory === 'india' ? 'active' : ''}`}
                  onClick={() => onSelectCategory('india')}
                >
                  <span>India</span>
                </button>
                {user && (
                  <button
                    className={`nav-btn ${currentCategory === 'saved' ? 'active' : ''}`}
                    onClick={() => onSelectCategory('saved')}
                  >
                    <span>Saved</span>
                  </button>
                )}
              </>
            )}
          </nav>

          <div className="auth-nav-section">
            {user ? (
              <div className="user-pill">
                <span className="user-pill-name">{user.name.split(' ')[0]}</span>
                <span className="user-pill-divider">&middot;</span>
                <button className="sign-out-btn" onClick={onLogout} title="Sign Out">
                  Sign Out
                </button>
              </div>
            ) : (
              <button className="sign-in-btn" onClick={onOpenAuth}>
                Sign In
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
