import React, { useState } from 'react';
import { X, Lock, Mail, User, ArrowRight } from 'lucide-react';
import { loginUser, registerUser } from '../api';

export default function AuthModal({ isOpen, onClose, onAuthSuccess }) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let data;
      if (isRegister) {
        if (!name.trim()) throw new Error('Please enter your name.');
        if (password.length < 6) throw new Error('Password must be at least 6 characters.');
        data = await registerUser(name.trim(), email.trim(), password);
      } else {
        data = await loginUser(email.trim(), password);
      }
      onAuthSuccess(data.user);
      onClose();
    } catch (err) {
      setError(err.message || 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setError('');
    setLoading(true);
    try {
      // Automatic quick login using demo account (or registers if not yet seeded)
      try {
        const data = await loginUser('demo@paperly.news', 'demo12345');
        onAuthSuccess(data.user);
        onClose();
      } catch {
        const data = await registerUser('Editorial Reader', 'demo@paperly.news', 'demo12345');
        onAuthSuccess(data.user);
        onClose();
      }
    } catch (err) {
      setError('Could not connect to demo authentication.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
        <div className="auth-modal-header">
          <div>
            <h3 className="auth-modal-title">
              {isRegister ? 'Join Paperly' : 'Sign In to Paperly'}
            </h3>
            <p className="auth-modal-subtitle">
              {isRegister
                ? 'Save your favorite stories and access curated reading lists'
                : 'Access your saved stories and reading preferences'}
            </p>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        {error && <div className="auth-error-alert">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          {isRegister && (
            <div className="form-group">
              <label>Full Name</label>
              <div className="input-wrap">
                <User size={15} className="input-icon" />
                <input
                  type="text"
                  placeholder="e.g. Eleanor Vance"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
            </div>
          )}

          <div className="form-group">
            <label>Email Address</label>
            <div className="input-wrap">
              <Mail size={15} className="input-icon" />
              <input
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>Password</label>
            <div className="input-wrap">
              <Lock size={15} className="input-icon" />
              <input
                type="password"
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button type="submit" className="action-btn auth-submit-btn" disabled={loading}>
            <span>{loading ? 'Authenticating...' : isRegister ? 'Create Account' : 'Sign In'}</span>
            <ArrowRight size={15} />
          </button>
        </form>

        <div className="auth-divider">
          <span>or for testing</span>
        </div>

        <button
          type="button"
          className="demo-auth-btn"
          onClick={handleDemoLogin}
          disabled={loading}
        >
          <span>Quick Demo Login (1-Click)</span>
        </button>

        <div className="auth-modal-footer">
          {isRegister ? (
            <p>
              Already have an account?{' '}
              <button
                type="button"
                className="auth-switch-link"
                onClick={() => {
                  setIsRegister(false);
                  setError('');
                }}
              >
                Sign In
              </button>
            </p>
          ) : (
            <p>
              Don't have an account?{' '}
              <button
                type="button"
                className="auth-switch-link"
                onClick={() => {
                  setIsRegister(true);
                  setError('');
                }}
              >
                Create One
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
