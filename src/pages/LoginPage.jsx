// Email + password login. Accounts are created by an admin (no self-signup).

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { showToast } from '../components/common/toast';

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) nav('/admin', { replace: true });
  }, [loading, user, nav]);

  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      return showToast('Enter your email and password', 'error');
    }
    setBusy(true);
    try {
      const { token, profile, tenant } = await authApi.login(email.trim(), password);
      login(token, profile, tenant);
      nav('/admin', { replace: true });
    } catch (err) {
      showToast(err.response?.data?.error || 'Login failed', 'error');
    } finally { setBusy(false); }
  };

  return (
    <div className="center-screen" style={{ background: 'var(--bg)' }}>
      <div className="card" style={{ maxWidth: 380, width: '92%' }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <img src="/logo.png" alt="MeraDhanda" style={{ height: 46, margin: '0 auto 10px', display: 'block' }} />
          <p style={{ color: 'var(--text2)', fontSize: 13 }}>Sign in to your account</p>
        </div>

        <form onSubmit={submit}>
          <div className="form-group">
            <label>Email</label>
            <input
              className="input"
              type="email"
              autoComplete="username"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
              required
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              className="input"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button className="btn btn-primary w-full" type="submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 16, textAlign: 'center' }}>
          New company?{' '}
          <a href="/signup" style={{ color: 'var(--blue)', fontWeight: 600 }}>Start your 30-day free trial</a>
        </div>
      </div>
    </div>
  );
}
