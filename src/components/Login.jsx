import React, { useState } from 'react';
import api from '../api';

export default function Login({ setSession, t, theme, setTheme, lang, setLang }) {
  const [tenantId, setTenantId] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api.login(tenantId, username, password);
      setSession(data);
    } catch (err) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };



  return (
    <div className="login-container" style={{ position: 'relative' }}>
      <div className="no-print" style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center', zIndex: 10 }}>
        <button className="language-btn" onClick={() => setLang(lang === 'en' ? 'ta' : 'en')}>
          🌐 {lang === 'en' ? 'தமிழ்' : 'English'}
        </button>
        <button className="theme-toggle-btn" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} title="Toggle Theme">
          {theme === 'light' ? '🌙' : '☀️'}
        </button>
      </div>

      <div className="glass-card login-card">
        <div className="login-header">
          <h1>{t('title')}</h1>
          <p>{t('login')}</p>
        </div>

        {error && (
          <div style={{ color: 'var(--danger)', marginBottom: '1rem', textAlign: 'center', fontWeight: 'bold' }}>
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="form-group">
            <label>Company Code / Tenant ID</label>
            <input
              type="text"
              className="form-input"
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              required
              placeholder="e.g. COMPANY_123"
            />
          </div>
          <div className="form-group">
            <label>{t('username')}</label>
            <input
              type="text"
              className="form-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              placeholder="e.g. admin"
            />
          </div>
          <div className="form-group">
            <label>{t('password')}</label>
            <input
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? '...' : t('login')}
          </button>
        </form>


      </div>
    </div>
  );
}
