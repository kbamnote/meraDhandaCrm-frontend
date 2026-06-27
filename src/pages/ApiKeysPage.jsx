/**
 * API Keys — issue and manage server-to-server keys for the external MeraDhanda
 * API (e.g. GET /api/v1/jobs). Keys are tenant-scoped and admin-only. The full
 * plaintext key is returned ONCE on creation (apiKeysApi.create) and shown in a
 * highlighted box with a copy button — afterwards only a masked prefix…last4 is
 * ever displayed. Revoking (apiKeysApi.revoke) is soft (revokedAt) and greys the
 * row. Data is fetched on mount via apiKeysApi.list() (REST, no realtime).
 */
import { useEffect, useState } from 'react';
import { apiKeysApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useT } from '../i18n/LanguageContext';
import { showToast } from '../components/common/toast';

const S = {
  title:    { en: '🔑 API Keys', hi: '🔑 API कीज़', hinglish: '🔑 API Keys', gu: '🔑 API કીઝ', mr: '🔑 API कीज', mwr: '🔑 API कीज़' },
  subtitle: { en: 'Server-to-server keys for the MeraDhanda API.', hi: 'MeraDhanda API के लिए सर्वर-टू-सर्वर कीज़।', hinglish: 'MeraDhanda API ke liye server-to-server keys.', gu: 'MeraDhanda API માટે સર્વર-ટુ-સર્વર કીઝ.', mr: 'MeraDhanda API साठी सर्व्हर-टू-सर्व्हर कीज.', mwr: 'MeraDhanda API वास्ते सर्वर-टू-सर्वर कीज़।' },
  generate: { en: '+ Generate key', hi: '+ की बनाएं', hinglish: '+ Generate key', gu: '+ કી બનાવો', mr: '+ की तयार करा', mwr: '+ की बणावो' },
  none:     { en: 'No API keys yet.', hi: 'अभी कोई API की नहीं।', hinglish: 'Abhi koi API key nahi.', gu: 'હજુ કોઈ API કી નથી.', mr: 'अद्याप API की नाही.', mwr: 'अजे कोई API की कोनी।' },
  label:    { en: 'Label', hi: 'लेबल', hinglish: 'Label', gu: 'લેબલ', mr: 'लेबल', mwr: 'लेबल' },
  key:      { en: 'Key', hi: 'की', hinglish: 'Key', gu: 'કી', mr: 'की', mwr: 'की' },
  created:  { en: 'Created', hi: 'बनाया', hinglish: 'Created', gu: 'બનાવ્યું', mr: 'तयार केले', mwr: 'बणायो' },
  lastUsed: { en: 'Last used', hi: 'आखिरी उपयोग', hinglish: 'Last used', gu: 'છેલ્લે વપરાયું', mr: 'शेवटचा वापर', mwr: 'आखिरी उपयोग' },
  status:   { en: 'Status', hi: 'स्थिति', hinglish: 'Status', gu: 'સ્થિતિ', mr: 'स्थिती', mwr: 'स्थिति' },
  active:   { en: 'Active', hi: 'सक्रिय', hinglish: 'Active', gu: 'સક્રિય', mr: 'सक्रिय', mwr: 'चालू' },
  revoked:  { en: 'Revoked', hi: 'रद्द', hinglish: 'Revoked', gu: 'રદ', mr: 'रद्द', mwr: 'रद्द' },
  revoke:   { en: 'Revoke', hi: 'रद्द करें', hinglish: 'Revoke', gu: 'રદ કરો', mr: 'रद्द करा', mwr: 'रद्द करो' },
  never:    { en: 'Never', hi: 'कभी नहीं', hinglish: 'Never', gu: 'ક્યારેય નહીં', mr: 'कधीही नाही', mwr: 'कदे कोनी' },
  adminOnly:{ en: 'Only admins can manage API keys.', hi: 'केवल एडमिन API कीज़ मैनेज कर सकते हैं।', hinglish: 'Sirf admins API keys manage kar sakte hain.', gu: 'ફક્ત એડમિન API કીઝ મેનેજ કરી શકે છે.', mr: 'फक्त अॅडमिन API कीज व्यवस्थापित करू शकतात.', mwr: 'सिरफ एडमिन API कीज़ मैनेज कर सके।' },
  newLabel: { en: 'Label (e.g. "Zapier integration")', hi: 'लेबल (जैसे "Zapier इंटीग्रेशन")', hinglish: 'Label (jaise "Zapier integration")', gu: 'લેબલ (દા.ત. "Zapier integration")', mr: 'लेबल (उदा. "Zapier integration")', mwr: 'लेबल (जियां "Zapier integration")' },
  create:   { en: 'Create', hi: 'बनाएं', hinglish: 'Create', gu: 'બનાવો', mr: 'तयार करा', mwr: 'बणावो' },
  cancel:   { en: 'Cancel', hi: 'रद्द करें', hinglish: 'Cancel', gu: 'રદ કરો', mr: 'रद्द करा', mwr: 'रद्द करो' },
  close:    { en: 'Close', hi: 'बंद करें', hinglish: 'Close', gu: 'બંધ કરો', mr: 'बंद करा', mwr: 'बंद करो' },
  copy:     { en: 'Copy', hi: 'कॉपी', hinglish: 'Copy', gu: 'કૉપિ', mr: 'कॉपी', mwr: 'कॉपी' },
  copied:   { en: 'Copied', hi: 'कॉपी हो गया', hinglish: 'Copied', gu: 'કૉપિ થયું', mr: 'कॉपी झाले', mwr: 'कॉपी हो ग्यो' },
  keyOnce:  { en: 'Copy this key now — it will NOT be shown again.', hi: 'यह की अभी कॉपी कर लें — यह दोबारा नहीं दिखाई जाएगी।', hinglish: 'Yeh key abhi copy kar lein — yeh dobara nahi dikhegi.', gu: 'આ કી હમણાં કૉપિ કરો — તે ફરી દેખાશે નહીં.', mr: 'ही की आता कॉपी करा — ती पुन्हा दाखवली जाणार नाही.', mwr: 'यो की अबे कॉपी कर ल्यो — यो दुबारा कोनी दिखे।' },
  keyReady: { en: 'Your new API key', hi: 'आपकी नई API की', hinglish: 'Aapki nayi API key', gu: 'તમારી નવી API કી', mr: 'तुमची नवीन API की', mwr: 'थारी नई API की' },
  confirmRevoke:{ en: 'Revoke this key? Apps using it will stop working immediately.', hi: 'यह की रद्द करें? इसे उपयोग करने वाले ऐप तुरंत बंद हो जाएंगे।', hinglish: 'Yeh key revoke karein? Ise use karne wale apps turant band ho jayenge.', gu: 'આ કી રદ કરો? તેનો ઉપયોગ કરતી એપ્સ તરત જ બંધ થઈ જશે.', mr: 'ही की रद्द करा? ती वापरणारे अॅप्स लगेच बंद होतील.', mwr: 'यो की रद्द करो? इणनै काम मांय लेवण वाळा ऐप तुरंत बंद हो जासी।' },
  usage:    { en: 'Usage', hi: 'उपयोग', hinglish: 'Usage', gu: 'ઉપયોગ', mr: 'वापर', mwr: 'उपयोग' },
  usageHint:{ en: 'Send the key as a Bearer token (or X-API-Key header) to authenticate:', hi: 'प्रमाणीकरण के लिए की को Bearer टोकन (या X-API-Key हेडर) के रूप में भेजें:', hinglish: 'Authenticate karne ke liye key ko Bearer token (ya X-API-Key header) ke roop mein bhejein:', gu: 'પ્રમાણીકરણ માટે કીને Bearer ટોકન (અથવા X-API-Key હેડર) તરીકે મોકલો:', mr: 'प्रमाणीकरणासाठी की Bearer टोकन (किंवा X-API-Key हेडर) म्हणून पाठवा:', mwr: 'प्रमाणीकरण वास्ते की नै Bearer टोकन (या X-API-Key हेडर) रूप मांय भेजो:' },
  failed:   { en: 'Failed', hi: 'नहीं हुआ', hinglish: 'Fail hua', gu: 'નિષ્ફળ', mr: 'अयशस्वी', mwr: 'कोनी हुयो' },
};

const fmtDate = (ts) => (ts ? new Date(ts).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '');
const CURL = 'curl -H "Authorization: Bearer md_..." \\\n  https://api.meradhanda.in/api/v1/jobs';

export default function ApiKeysPage() {
  const t = useT(S);
  const { hasRole } = useAuth();
  const isAdmin = hasRole('admin', 'superadmin', 'owner');

  const [rows, setRows] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [newKey, setNewKey] = useState(null); // { id, label, key } shown once

  const load = () => apiKeysApi.list().then(setRows).catch(() => setRows([]));
  useEffect(() => { load(); }, []);

  const revoke = async (row) => {
    if (!window.confirm(t('confirmRevoke'))) return;
    try { await apiKeysApi.revoke(row.id); showToast(t('revoked'), 'success'); load(); }
    catch (e) { showToast(e.response?.data?.error || t('failed'), 'error'); }
  };

  if (!isAdmin) {
    return (
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>{t('title')}</h2>
        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>{t('adminOnly')}</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600 }}>{t('title')}</h2>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 2 }}>{t('subtitle')}</div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowNew(true)}>{t('generate')}</button>
      </div>

      {rows === null ? (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>…</div>
      ) : !rows.length ? (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>{t('none')}</div>
      ) : (
        <div className="card" style={{ padding: 0, overflowX: 'auto', marginBottom: 16 }}>
          <table className="crm-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>{t('label')}</th>
                <th>{t('key')}</th>
                <th>{t('created')}</th>
                <th>{t('lastUsed')}</th>
                <th>{t('status')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const revoked = !!r.revokedAt;
                return (
                  <tr key={r.id} style={{ opacity: revoked ? 0.5 : 1 }}>
                    <td style={{ fontWeight: 600 }}>{r.label || '—'}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text2)' }}>{r.prefix}…{r.last4}</td>
                    <td style={{ fontSize: 13, color: 'var(--text2)' }}>{fmtDate(r.createdAt)}</td>
                    <td style={{ fontSize: 13, color: 'var(--text2)' }}>{r.lastUsedAt ? fmtDate(r.lastUsedAt) : t('never')}</td>
                    <td>
                      <span className={`badge ${revoked ? 'badge-red' : 'badge-green'}`}>{revoked ? t('revoked') : t('active')}</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {!revoked && <button className="btn btn-ghost btn-xs" onClick={() => revoke(r)}>{t('revoke')}</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="card">
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{t('usage')}</div>
        <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 8 }}>{t('usageHint')}</div>
        <pre style={{ margin: 0, padding: 12, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, fontFamily: 'monospace', color: 'var(--text)', overflowX: 'auto', whiteSpace: 'pre' }}>{CURL}</pre>
      </div>

      {showNew && (
        <NewKeyModal
          t={t}
          onClose={() => setShowNew(false)}
          onCreated={(created) => { setShowNew(false); setNewKey(created); load(); }}
        />
      )}
      {newKey && <KeyRevealModal t={t} created={newKey} onClose={() => setNewKey(null)} />}
    </div>
  );
}

function NewKeyModal({ t, onClose, onCreated }) {
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!label.trim()) return showToast(t('label'), 'error');
    setBusy(true);
    try {
      const created = await apiKeysApi.create({ label: label.trim() });
      onCreated(created);
    } catch (e) { showToast(e.response?.data?.error || t('failed'), 'error'); }
    finally { setBusy(false); }
  };
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div className="card" style={{ maxWidth: 420, width: '100%' }}>
        <h3 style={{ marginBottom: 12 }}>{t('generate')}</h3>
        <div className="form-group">
          <label>{t('label')}</label>
          <input className="input" value={label} placeholder={t('newLabel')} onChange={(e) => setLabel(e.target.value)} maxLength={60} autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter' && !busy) submit(); }} />
        </div>
        <div className="flex gap-2 mt-2">
          <button className="btn btn-primary flex-1" onClick={submit} disabled={busy}>{busy ? '…' : t('create')}</button>
          <button className="btn btn-ghost" onClick={onClose}>{t('cancel')}</button>
        </div>
      </div>
    </div>
  );
}

function KeyRevealModal({ t, created, onClose }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(created.key); setCopied(true); showToast(t('copied'), 'success'); }
    catch { showToast(t('failed'), 'error'); }
  };
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div className="card" style={{ maxWidth: 480, width: '100%' }}>
        <h3 style={{ marginBottom: 4 }}>{t('keyReady')}</h3>
        {created.label && <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 10 }}>{created.label}</div>}
        <div className="card" style={{ background: 'var(--amber-light, #FEF3E2)', border: '1px solid var(--amber)', marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--amber)', marginBottom: 8 }}>⚠️ {t('keyOnce')}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <code style={{ flex: 1, fontFamily: 'monospace', fontSize: 13, wordBreak: 'break-all', background: 'var(--surface2)', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', color: 'var(--text)' }}>{created.key}</code>
            <button className="btn btn-primary btn-sm" onClick={copy}>{copied ? t('copied') : t('copy')}</button>
          </div>
        </div>
        <div className="flex gap-2 mt-2">
          <button className="btn btn-ghost flex-1" onClick={onClose}>{t('close')}</button>
        </div>
      </div>
    </div>
  );
}
