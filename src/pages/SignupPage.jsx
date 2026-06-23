// Public self-serve signup — creates a company (tenant) + owner + 30-day trial.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useT } from '../i18n/LanguageContext';
import LanguageSwitcher from '../components/common/LanguageSwitcher';
import { showToast } from '../components/common/toast';

const S = {
  title: { en: 'Start your free trial', hi: 'अपना फ़्री ट्रायल शुरू करें', hinglish: 'Apna free trial shuru karein', gu: 'તમારું ફ્રી ટ્રાયલ શરૂ કરો', mr: 'तुमची मोफत चाचणी सुरू करा', mwr: 'थारो फ्री ट्रायल चालू करो' },
  subtitle: { en: 'Production & manufacturing CRM · 30 days free · no card required', hi: 'प्रोडक्शन और मैन्युफैक्चरिंग CRM · 30 दिन फ्री · कार्ड की ज़रूरत नहीं', hinglish: 'Production & manufacturing CRM · 30 din free · card ki zaroorat nahi', gu: 'પ્રોડક્શન અને મેન્યુફેક્ચરિંગ CRM · 30 દિવસ ફ્રી · કાર્ડ નહીં', mr: 'प्रोडक्शन व मॅन्युफॅक्चरिंग CRM · 30 दिवस मोफत · कार्ड नको', mwr: 'प्रोडक्शन अर मैन्युफैक्चरिंग CRM · 30 दिन फ्री · कार्ड कोनी' },
  company: { en: 'Company / factory name', hi: 'कंपनी / फैक्ट्री का नाम', hinglish: 'Company / factory ka naam', gu: 'કંપની / ફેક્ટરીનું નામ', mr: 'कंपनी / कारखान्याचे नाव', mwr: 'कंपनी / फैक्ट्री रो नाम' },
  yourName: { en: 'Your name', hi: 'आपका नाम', hinglish: 'Aapka naam', gu: 'તમારું નામ', mr: 'तुमचे नाव', mwr: 'थारो नाम' },
  namePh: { en: 'Full name', hi: 'पूरा नाम', hinglish: 'Pura naam', gu: 'પૂરું નામ', mr: 'पूर्ण नाव', mwr: 'पूरो नाम' },
  email: { en: 'Work email', hi: 'वर्क ईमेल', hinglish: 'Work email', gu: 'વર્ક ઈમેલ', mr: 'वर्क ईमेल', mwr: 'वर्क ईमेल' },
  password: { en: 'Password (min 6 chars)', hi: 'पासवर्ड (कम से कम 6 अक्षर)', hinglish: 'Password (min 6 chars)', gu: 'પાસવર્ડ (ઓછામાં ઓછા 6)', mr: 'पासवर्ड (किमान 6)', mwr: 'पासवर्ड (कम सूं कम 6)' },
  submit: { en: 'Create account & start free trial', hi: 'अकाउंट बनाएं और फ्री ट्रायल शुरू करें', hinglish: 'Account banayein & free trial shuru karein', gu: 'એકાઉન્ટ બનાવો અને ફ્રી ટ્રાયલ શરૂ કરો', mr: 'खाते तयार करा व मोफत ट्रायल सुरू करा', mwr: 'अकाउंट बणावो अर फ्री ट्रायल चालू करो' },
  submitting: { en: 'Creating your account…', hi: 'आपका अकाउंट बन रहा है…', hinglish: 'Aapka account ban raha hai…', gu: 'તમારું એકાઉન્ટ બની રહ્યું છે…', mr: 'तुमचे खाते तयार होत आहे…', mwr: 'थारो अकाउंट बण रियो है…' },
  haveAccount: { en: 'Already have an account?', hi: 'पहले से अकाउंट है?', hinglish: 'Pehle se account hai?', gu: 'પહેલેથી એકાઉન્ટ છે?', mr: 'आधीच खाते आहे?', mwr: 'पैलां सूं अकाउंट है?' },
  signIn: { en: 'Sign in', hi: 'साइन इन करें', hinglish: 'Sign in karein', gu: 'સાઇન ઇન કરો', mr: 'साइन इन करा', mwr: 'साइन इन करो' },
  errCompany: { en: 'Enter your company name', hi: 'कंपनी का नाम डालें', hinglish: 'Company ka naam daalein', gu: 'કંપનીનું નામ દાખલ કરો', mr: 'कंपनीचे नाव टाका', mwr: 'कंपनी रो नाम घालो' },
  errEmail: { en: 'Enter a valid email', hi: 'सही ईमेल डालें', hinglish: 'Sahi email daalein', gu: 'માન્ય ઈમેલ દાખલ કરો', mr: 'वैध ईमेल टाका', mwr: 'सही ईमेल घालो' },
  errPass: { en: 'Password must be at least 6 characters', hi: 'पासवर्ड कम से कम 6 अक्षर का हो', hinglish: 'Password kam se kam 6 characters ka ho', gu: 'પાસવર્ડ ઓછામાં ઓછા 6 અક્ષર', mr: 'पासवर्ड किमान 6 अक्षरांचा', mwr: 'पासवर्ड कम सूं कम 6 अक्षर रो हो' },
  welcome: { en: 'Welcome! Your 30-day free trial has started.', hi: 'स्वागत है! आपका 30 दिन का फ्री ट्रायल शुरू हो गया।', hinglish: 'Welcome! Aapka 30-din ka free trial shuru ho gaya.', gu: 'સ્વાગત છે! તમારું 30 દિવસનું ફ્રી ટ્રાયલ શરૂ થયું.', mr: 'स्वागत आहे! तुमची 30 दिवसांची मोफत चाचणी सुरू झाली.', mwr: 'स्वागत है! थारो 30 दिन रो फ्री ट्रायल चालू हो ग्यो.' },
  failed: { en: 'Signup failed', hi: 'साइनअप नहीं हुआ', hinglish: 'Signup nahi hua', gu: 'સાઇનઅપ નિષ્ફળ', mr: 'साइनअप अयशस्वी', mwr: 'साइनअप कोनी हुयो' },
};

export default function SignupPage() {
  const { user, loading, login } = useAuth();
  const t = useT(S);
  const nav = useNavigate();
  const [form, setForm] = useState({ companyName: '', name: '', email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => { if (!loading && user) nav('/admin', { replace: true }); }, [loading, user, nav]);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.companyName.trim()) return showToast(t('errCompany'), 'error');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) return showToast(t('errEmail'), 'error');
    if (form.password.length < 6) return showToast(t('errPass'), 'error');
    setBusy(true);
    try {
      const { token, profile, tenant } = await authApi.signup({
        companyName: form.companyName.trim(), name: form.name.trim(),
        email: form.email.trim(), password: form.password,
      });
      login(token, profile, tenant);
      showToast(t('welcome'), 'success');
      nav('/admin', { replace: true });
    } catch (err) {
      showToast(err.response?.data?.error || t('failed'), 'error');
    } finally { setBusy(false); }
  };

  return (
    <div className="center-screen" style={{ background: 'var(--bg)', position: 'relative' }}>
      <div style={{ position: 'absolute', top: 16, right: 16 }}><LanguageSwitcher /></div>
      <div className="card" style={{ maxWidth: 420, width: '92%' }}>
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <img src="/logo.png" alt="MeraDhanda" style={{ height: 44, margin: '0 auto 10px', display: 'block' }} />
          <h2 style={{ marginTop: 6 }}>{t('title')}</h2>
          <p style={{ color: 'var(--text2)', fontSize: 13, marginTop: 4 }}>{t('subtitle')}</p>
        </div>

        <form onSubmit={submit}>
          <div className="form-group">
            <label>{t('company')}</label>
            <input className="input" value={form.companyName} onChange={(e) => set('companyName', e.target.value)} autoFocus required />
          </div>
          <div className="form-group">
            <label>{t('yourName')}</label>
            <input className="input" placeholder={t('namePh')} value={form.name} onChange={(e) => set('name', e.target.value)} />
          </div>
          <div className="form-group">
            <label>{t('email')}</label>
            <input className="input" type="email" autoComplete="username" placeholder="you@company.com" value={form.email} onChange={(e) => set('email', e.target.value)} required />
          </div>
          <div className="form-group">
            <label>{t('password')}</label>
            <input className="input" type="password" autoComplete="new-password" placeholder="••••••••" value={form.password} onChange={(e) => set('password', e.target.value)} required />
          </div>
          <button className="btn btn-primary w-full" type="submit" disabled={busy}>
            {busy ? t('submitting') : t('submit')}
          </button>
        </form>

        <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 16, textAlign: 'center' }}>
          {t('haveAccount')}{' '}
          <a href="/login" style={{ color: 'var(--blue)', fontWeight: 600 }}>{t('signIn')}</a>
        </div>
      </div>
    </div>
  );
}
