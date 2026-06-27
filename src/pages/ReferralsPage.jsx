/**
 * Referrals — share your referral code/link and track the businesses that signed
 * up through it. referralsApi.code() gives the code + share link (Copy button);
 * referralsApi.list() gives totals (count, credits) + the referred-business table.
 * Read-only REST: fetch-on-mount + manual refresh (no realtime).
 */
import { useEffect, useState } from 'react';
import { referralsApi } from '../services/api';
import { useT } from '../i18n/LanguageContext';
import { showToast } from '../components/common/toast';

const S = {
  title:    { en: '🎁 Referrals', hi: '🎁 रेफरल', hinglish: '🎁 Referrals', gu: '🎁 રેફરલ', mr: '🎁 रेफरल', mwr: '🎁 रेफरल' },
  refresh:  { en: 'Refresh', hi: 'रिफ्रेश', hinglish: 'Refresh', gu: 'રિફ્રેશ', mr: 'रिफ्रेश', mwr: 'रिफ्रेश' },
  intro:    { en: 'Share MeraDhanda with other printing businesses. When they sign up with your code, you earn credits.', hi: 'अन्य प्रिंटिंग बिज़नेस के साथ मेराधंधा शेयर करें। आपके कोड से साइनअप करने पर आपको क्रेडिट मिलते हैं।', hinglish: 'Apne code se doosre printing business ko MeraDhanda refer karein. Wo sign up karein toh aapko credits milte hain.', gu: 'અન્ય પ્રિન્ટિંગ બિઝનેસ સાથે મેરાધંધા શેર કરો. તેઓ તમારા કોડથી સાઇન અપ કરે ત્યારે તમને ક્રેડિટ મળે છે.', mr: 'इतर प्रिंटिंग व्यवसायांसोबत मेराधंदा शेअर करा. ते तुमच्या कोडने साइन अप केल्यावर तुम्हाला क्रेडिट मिळतात.', mwr: 'दूजा प्रिंटिंग बिज़नेस ने मेराधंधा बताओ। वे थारे कोड सूं साइन अप करै तो थाने क्रेडिट मिलै।' },
  yourCode: { en: 'Your referral code', hi: 'आपका रेफरल कोड', hinglish: 'Aapka referral code', gu: 'તમારો રેફરલ કોડ', mr: 'तुमचा रेफरल कोड', mwr: 'थारो रेफरल कोड' },
  shareLink:{ en: 'Share link', hi: 'शेयर लिंक', hinglish: 'Share link', gu: 'શેર લિંક', mr: 'शेअर लिंक', mwr: 'शेयर लिंक' },
  copy:     { en: 'Copy', hi: 'कॉपी', hinglish: 'Copy', gu: 'કૉપિ', mr: 'कॉपी', mwr: 'कॉपी' },
  copyLink: { en: 'Copy link', hi: 'लिंक कॉपी', hinglish: 'Copy link', gu: 'લિંક કૉપિ', mr: 'लिंक कॉपी', mwr: 'लिंक कॉपी' },
  copied:   { en: 'Copied!', hi: 'कॉपी हो गया!', hinglish: 'Copy ho gaya!', gu: 'કૉપિ થયું!', mr: 'कॉपी झाले!', mwr: 'कॉपी हो ग्यो!' },
  referred: { en: 'Businesses referred', hi: 'रेफर किए बिज़नेस', hinglish: 'Referred businesses', gu: 'રેફર કરેલ બિઝનેસ', mr: 'रेफर केलेले व्यवसाय', mwr: 'रेफर कर्या बिज़नेस' },
  credits:  { en: 'Credits earned', hi: 'कमाए क्रेडिट', hinglish: 'Credits earned', gu: 'મેળવેલ ક્રેડિટ', mr: 'मिळवलेले क्रेडिट', mwr: 'कमाया क्रेडिट' },
  business: { en: 'Business', hi: 'बिज़नेस', hinglish: 'Business', gu: 'બિઝનેસ', mr: 'व्यवसाय', mwr: 'बिज़नेस' },
  signedUp: { en: 'Signed up', hi: 'साइनअप', hinglish: 'Signed up', gu: 'સાઇન અપ', mr: 'साइन अप', mwr: 'साइन अप' },
  status:   { en: 'Status', hi: 'स्टेटस', hinglish: 'Status', gu: 'સ્ટેટસ', mr: 'स्थिती', mwr: 'स्टेटस' },
  empty:    { en: 'No referrals yet — share your code to start earning credits!', hi: 'अभी कोई रेफरल नहीं — क्रेडिट कमाने के लिए अपना कोड शेयर करें!', hinglish: 'Abhi koi referral nahi — credits kamane ke liye apna code share karein!', gu: 'હજુ કોઈ રેફરલ નથી — ક્રેડિટ કમાવા તમારો કોડ શેર કરો!', mr: 'अद्याप रेफरल नाही — क्रेडिट मिळवण्यासाठी तुमचा कोड शेअर करा!', mwr: 'अजे कोई रेफरल कोनी — क्रेडिट कमावण खातर थारो कोड शेयर करो!' },
  signed_up:{ en: 'Signed up', hi: 'साइनअप', hinglish: 'Signed up', gu: 'સાઇન અપ', mr: 'साइन अप', mwr: 'साइन अप' },
  failed:   { en: 'Could not load referrals', hi: 'रेफरल लोड नहीं हुए', hinglish: 'Referrals load nahi hue', gu: 'રેફરલ લોડ ન થયા', mr: 'रेफरल लोड झाले नाहीत', mwr: 'रेफरल लोड कोनी हुया' },
};

const STATUS_TONE = { signed_up: 'badge-green', pending: 'badge-amber' };

const fmtDate = (ts) => (ts ? new Date(ts).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

export default function ReferralsPage() {
  const t = useT(S);
  const [code, setCode] = useState(null);   // { code, link }
  const [data, setData] = useState(null);   // { referrals, totals }
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    Promise.all([
      referralsApi.code().then(setCode).catch(() => setCode(null)),
      referralsApi.list().then(setData).catch(() => { setData(null); showToast(t('failed'), 'error'); }),
    ]).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []); // eslint-disable-line

  const copy = async (text, label) => {
    if (!text) return;
    try { await navigator.clipboard.writeText(text); showToast(label || t('copied'), 'success'); }
    catch { showToast(text, 'info'); }
  };

  const referrals = data?.referrals || [];
  const totals = data?.totals || { count: 0, credits: 0 };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>{t('title')}</h2>
        <button className="btn btn-ghost btn-sm" onClick={load} disabled={loading}>{loading ? '…' : t('refresh')}</button>
      </div>

      <div className="card" style={{ marginBottom: 16, fontSize: 13, color: 'var(--text2)' }}>{t('intro')}</div>

      {/* Code + share link */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>{t('yourCode')}</div>
        <div className="flex items-center gap-2" style={{ flexWrap: 'wrap', marginBottom: 14 }}>
          <span style={{ fontSize: 28, fontWeight: 800, letterSpacing: '.06em', color: 'var(--text)', fontFamily: 'monospace' }}>{code?.code || '…'}</span>
          <button className="btn btn-primary btn-sm" onClick={() => copy(code?.code)} disabled={!code?.code}>{t('copy')}</button>
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>{t('shareLink')}</label>
          <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
            <input className="input" style={{ flex: 1, minWidth: 220 }} value={code?.link || ''} readOnly onFocus={(e) => e.target.select()} />
            <button className="btn btn-ghost btn-sm" onClick={() => copy(code?.link)} disabled={!code?.link}>{t('copyLink')}</button>
          </div>
        </div>
      </div>

      {/* Totals */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10, marginBottom: 16 }}>
        <div className="card" style={{ padding: 14 }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)' }}>{totals.count}</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>{t('referred')}</div>
        </div>
        <div className="card" style={{ padding: 14 }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--green)' }}>{totals.credits}</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>{t('credits')}</div>
        </div>
      </div>

      {/* Referred businesses */}
      {!referrals.length ? (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>
          {loading ? '…' : t('empty')}
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="crm-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>{t('business')}</th>
                <th>{t('signedUp')}</th>
                <th>{t('status')}</th>
                <th style={{ textAlign: 'right' }}>{t('credits')}</th>
              </tr>
            </thead>
            <tbody>
              {referrals.map((r) => (
                <tr key={r._id || r.referredTenantId}>
                  <td style={{ fontWeight: 600 }}>{r.referredName || '—'}</td>
                  <td style={{ color: 'var(--text2)' }}>{fmtDate(r.signedUpAt)}</td>
                  <td><span className={`badge ${STATUS_TONE[r.status] || 'badge-blue'}`}>{S[r.status] ? t(r.status) : (r.status || '—')}</span></td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--green)' }}>+{r.credits || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
