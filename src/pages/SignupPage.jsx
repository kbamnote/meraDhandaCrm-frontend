// Public self-serve signup — creates a new company (tenant) + its owner account,
// starts a 30-day free trial, and logs the owner straight in.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { showToast } from '../components/common/toast';

export default function SignupPage() {
  const { user, loading, login } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ companyName: '', name: '', email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!loading && user) nav('/admin', { replace: true });
  }, [loading, user, nav]);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.companyName.trim()) return showToast('Enter your company name', 'error');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) return showToast('Enter a valid email', 'error');
    if (form.password.length < 6) return showToast('Password must be at least 6 characters', 'error');
    setBusy(true);
    try {
      const { token, profile, tenant } = await authApi.signup({
        companyName: form.companyName.trim(),
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
      });
      login(token, profile, tenant);
      showToast('Welcome! Your 30-day free trial has started.', 'success');
      nav('/admin', { replace: true });
    } catch (err) {
      showToast(err.response?.data?.error || 'Signup failed', 'error');
    } finally { setBusy(false); }
  };

  return (
    <div className="center-screen" style={{ background: 'var(--bg)' }}>
      <div className="card" style={{ maxWidth: 420, width: '92%' }}>
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <img src="/logo.png" alt="MeraDhanda" style={{ height: 44, margin: '0 auto 10px', display: 'block' }} />
          <h2 style={{ marginTop: 6 }}>Start your free trial</h2>
          <p style={{ color: 'var(--text2)', fontSize: 13, marginTop: 4 }}>
            Production &amp; manufacturing CRM · 30 days free · no card required
          </p>
        </div>

        <form onSubmit={submit}>
          <div className="form-group">
            <label>Company / factory name</label>
            <input className="input" placeholder="e.g. Sharma Industries" value={form.companyName}
              onChange={(e) => set('companyName', e.target.value)} autoFocus required />
          </div>
          <div className="form-group">
            <label>Your name</label>
            <input className="input" placeholder="Full name" value={form.name}
              onChange={(e) => set('name', e.target.value)} />
          </div>
          <div className="form-group">
            <label>Work email</label>
            <input className="input" type="email" autoComplete="username" placeholder="you@company.com"
              value={form.email} onChange={(e) => set('email', e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Password (min 6 chars)</label>
            <input className="input" type="password" autoComplete="new-password" placeholder="••••••••"
              value={form.password} onChange={(e) => set('password', e.target.value)} required />
          </div>
          <button className="btn btn-primary w-full" type="submit" disabled={busy}>
            {busy ? 'Creating your account…' : 'Create account & start free trial'}
          </button>
        </form>

        <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 16, textAlign: 'center' }}>
          Already have an account?{' '}
          <a href="/login" style={{ color: 'var(--blue)', fontWeight: 600 }}>Sign in</a>
        </div>
      </div>
    </div>
  );
}
