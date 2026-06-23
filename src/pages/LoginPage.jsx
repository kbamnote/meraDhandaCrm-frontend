// Email + password login. Accounts are created by signup or by an admin.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useT } from '../i18n/LanguageContext';
import LanguageSwitcher from '../components/common/LanguageSwitcher';
import { showToast } from '../components/common/toast';

const S = {
  subtitle: { en: 'Sign in to your account', hi: 'अपने अकाउंट में साइन इन करें', hinglish: 'Apne account mein sign in karein', gu: 'તમારા એકાઉન્ટમાં સાઇન ઇન કરો', mr: 'तुमच्या खात्यात साइन इन करा', mwr: 'थारे अकाउंट में साइन इन करो' },
  email: { en: 'Email', hi: 'ईमेल', hinglish: 'Email', gu: 'ઈમેલ', mr: 'ईमेल', mwr: 'ईमेल' },
  password: { en: 'Password', hi: 'पासवर्ड', hinglish: 'Password', gu: 'પાસવર્ડ', mr: 'पासवर्ड', mwr: 'पासवर्ड' },
  submit: { en: 'Sign in', hi: 'साइन इन करें', hinglish: 'Sign in karein', gu: 'સાઇન ઇન કરો', mr: 'साइन इन करा', mwr: 'साइन इन करो' },
  submitting: { en: 'Signing in…', hi: 'साइन इन हो रहा है…', hinglish: 'Sign in ho raha hai…', gu: 'સાઇન ઇન થઈ રહ્યું છે…', mr: 'साइन इन होत आहे…', mwr: 'साइन इन हो रियो है…' },
  newCompany: { en: 'New company?', hi: 'नई कंपनी?', hinglish: 'Nayi company?', gu: 'નવી કંપની?', mr: 'नवीन कंपनी?', mwr: 'नई कंपनी?' },
  startTrial: { en: 'Start your 30-day free trial', hi: '30 दिन का फ्री ट्रायल शुरू करें', hinglish: '30-din ka free trial shuru karein', gu: '30 દિવસનું ફ્રી ટ્રાયલ શરૂ કરો', mr: '30 दिवसांची मोफत चाचणी सुरू करा', mwr: '30 दिन रो फ्री ट्रायल चालू करो' },
  errFill: { en: 'Enter your email and password', hi: 'अपना ईमेल और पासवर्ड डालें', hinglish: 'Apna email aur password daalein', gu: 'તમારો ઈમેલ અને પાસવર્ડ દાખલ કરો', mr: 'तुमचा ईमेल व पासवर्ड टाका', mwr: 'थारो ईमेल अर पासवर्ड घालो' },
  failed: { en: 'Login failed', hi: 'लॉगिन नहीं हुआ', hinglish: 'Login nahi hua', gu: 'લૉગિન નિષ્ફળ', mr: 'लॉगिन अयशस्वी', mwr: 'लॉगिन कोनी हुयो' },
};

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const t = useT(S);
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!loading && user) nav('/admin', { replace: true }); }, [loading, user, nav]);

  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) return showToast(t('errFill'), 'error');
    setBusy(true);
    try {
      const { token, profile, tenant } = await authApi.login(email.trim(), password);
      login(token, profile, tenant);
      nav('/admin', { replace: true });
    } catch (err) {
      showToast(err.response?.data?.error || t('failed'), 'error');
    } finally { setBusy(false); }
  };

  return (
    <div className="center-screen" style={{ background: 'var(--bg)', position: 'relative' }}>
      <div style={{ position: 'absolute', top: 16, right: 16 }}><LanguageSwitcher /></div>
      <div className="card" style={{ maxWidth: 380, width: '92%' }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <img src="/logo.png" alt="MeraDhanda" style={{ height: 46, margin: '0 auto 10px', display: 'block' }} />
          <p style={{ color: 'var(--text2)', fontSize: 13 }}>{t('subtitle')}</p>
        </div>

        <form onSubmit={submit}>
          <div className="form-group">
            <label>{t('email')}</label>
            <input className="input" type="email" autoComplete="username" placeholder="you@company.com"
              value={email} onChange={(e) => setEmail(e.target.value)} autoFocus required />
          </div>
          <div className="form-group">
            <label>{t('password')}</label>
            <input className="input" type="password" autoComplete="current-password" placeholder="••••••••"
              value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button className="btn btn-primary w-full" type="submit" disabled={busy}>
            {busy ? t('submitting') : t('submit')}
          </button>
        </form>

        <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 16, textAlign: 'center' }}>
          {t('newCompany')}{' '}
          <a href="/signup" style={{ color: 'var(--blue)', fontWeight: 600 }}>{t('startTrial')}</a>
        </div>
      </div>
    </div>
  );
}
