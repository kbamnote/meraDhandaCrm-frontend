/**
 * Platform super-admin console — manage ALL tenants (MeraDhanda staff only).
 * Lists every company on the platform with plan/trial/status + actions to
 * suspend/activate and extend trials. Gated server-side to platformAdmin and
 * route-gated to isPlatformAdmin.
 */
import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { platformApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useT } from '../i18n/LanguageContext';
import { showToast } from '../components/common/toast';

const S = {
  platformAdminsOnly: { en: 'Platform admins only', hi: 'सिर्फ़ प्लेटफ़ॉर्म एडमिन', hinglish: 'Sirf platform admins', gu: 'ફક્ત પ્લેટફોર્મ એડમિન', mr: 'फक्त प्लॅटफॉर्म अॅडमिन', mwr: 'सिरफ प्लेटफॉर्म एडमिन' },
  staffOnly: { en: 'This console is for MeraDhanda staff.', hi: 'यह कंसोल MeraDhanda स्टाफ के लिए है।', hinglish: 'Yeh console MeraDhanda staff ke liye hai.', gu: 'આ કન્સોલ MeraDhanda સ્ટાફ માટે છે.', mr: 'हे कन्सोल MeraDhanda कर्मचाऱ्यांसाठी आहे.', mwr: 'यो कंसोल MeraDhanda स्टाफ खातर है।' },
  platformConsole: { en: '👑 Platform Console', hi: '👑 प्लेटफ़ॉर्म कंसोल', hinglish: '👑 Platform Console', gu: '👑 પ્લેટફોર્મ કન્સોલ', mr: '👑 प्लॅटफॉर्म कन्सोल', mwr: '👑 प्लेटफॉर्म कंसोल' },
  allCompanies: { en: 'All companies on MeraDhanda CRM', hi: 'MeraDhanda CRM की सभी कंपनियां', hinglish: 'MeraDhanda CRM ki saari companies', gu: 'MeraDhanda CRM પરની બધી કંપનીઓ', mr: 'MeraDhanda CRM वरील सर्व कंपन्या', mwr: 'MeraDhanda CRM री सगळी कंपनियां' },
  statTenants: { en: 'Tenants', hi: 'टेनेंट', hinglish: 'Tenants', gu: 'ટેનન્ટ', mr: 'टेनंट', mwr: 'टेनेंट' },
  statActive: { en: 'Active', hi: 'एक्टिव', hinglish: 'Active', gu: 'એક્ટિવ', mr: 'सक्रिय', mwr: 'एक्टिव' },
  statTotalUsers: { en: 'Total users', hi: 'कुल यूज़र', hinglish: 'Total users', gu: 'કુલ યૂઝર', mr: 'एकूण युझर', mwr: 'कुल यूज़र' },
  statSuspended: { en: 'Suspended', hi: 'सस्पेंडेड', hinglish: 'Suspended', gu: 'સસ્પેન્ડેડ', mr: 'निलंबित', mwr: 'सस्पेंडेड' },
  statTrial: { en: 'On trial', hi: 'ट्रायल पर', hinglish: 'On trial', gu: 'ટ્રાયલ પર', mr: 'ट्रायलवर', mwr: 'ट्रायल पर' },
  statPaid: { en: 'Paid', hi: 'पेड', hinglish: 'Paid', gu: 'પેઇડ', mr: 'पेड', mwr: 'पेड' },
  billingPlans: { en: '💳 CRMs by billing plan', hi: '💳 बिलिंग प्लान के अनुसार CRM', hinglish: '💳 Billing plan ke hisaab se CRMs', gu: '💳 બિલિંગ પ્લાન મુજબ CRM', mr: '💳 बिलिंग प्लॅननुसार CRM', mwr: '💳 बिलिंग प्लान मुजब CRM' },
  newBusiness: { en: '+ New Business', hi: '+ नया बिज़नेस', hinglish: '+ New Business' },
  broadcastBtn: { en: '📢 Broadcast', hi: '📢 ब्रॉडकास्ट', hinglish: '📢 Broadcast' },
  broadcastTitle: { en: 'Broadcast to all companies', hi: 'सभी कंपनियों को ब्रॉडकास्ट करें', hinglish: 'Saari companies ko broadcast karein' },
  fldBroadcastTitle: { en: 'Title *', hi: 'शीर्षक *', hinglish: 'Title *' },
  fldBroadcastBody: { en: 'Message *', hi: 'संदेश *', hinglish: 'Message *' },
  send: { en: 'Send', hi: 'भेजें', hinglish: 'Send' },
  sending: { en: 'Sending…', hi: 'भेजा जा रहा है…', hinglish: 'Sending…' },
  broadcastSent: { en: 'Sent to {n} companies', hi: '{n} कंपनियों को भेजा गया', hinglish: '{n} companies ko bhej diya' },
  broadcastHint: { en: 'This message is delivered to every company on the platform.', hi: 'यह संदेश प्लेटफ़ॉर्म की हर कंपनी को भेजा जाता है।', hinglish: 'Yeh message platform ki har company ko jaata hai.' },
  createBusiness: { en: 'Create a new business', hi: 'नया बिज़नेस बनाएं', hinglish: 'Naya business banayein' },
  fldCompany: { en: 'Company name *', hi: 'कंपनी का नाम *', hinglish: 'Company name *' },
  fldOwner: { en: 'Owner name', hi: 'ओनर का नाम', hinglish: 'Owner name' },
  fldEmail: { en: 'Owner email *', hi: 'ओनर ईमेल *', hinglish: 'Owner email *' },
  fldPassword: { en: 'Temp password * (min 6)', hi: 'अस्थायी पासवर्ड * (min 6)', hinglish: 'Temp password * (min 6)' },
  fldPlan: { en: 'Plan', hi: 'प्लान', hinglish: 'Plan' },
  businessCreated: { en: 'Business created', hi: 'बिज़नेस बन गया', hinglish: 'Business ban gaya' },
  view: { en: 'View', hi: 'देखें', hinglish: 'View' },
  staffHdr: { en: 'Staff', hi: 'स्टाफ', hinglish: 'Staff' },
  activityHdr: { en: 'Activity', hi: 'एक्टिविटी', hinglish: 'Activity' },
  noStaff: { en: 'No staff yet.', hi: 'अभी कोई स्टाफ नहीं।', hinglish: 'Abhi koi staff nahi.' },
  close: { en: 'Close', hi: 'बंद करें', hinglish: 'Close' },
  creating: { en: 'Creating…', hi: 'बन रहा है…', hinglish: 'Creating…' },
  shareHint: { en: 'Share the email + password with the owner — they sign in at the login page.', hi: 'ओनर को ईमेल + पासवर्ड दें — वे लॉगिन पेज पर साइन इन करेंगे।', hinglish: 'Owner ko email + password dein — wo login page par sign in karenge.' },
  failedToLoad: { en: 'Failed to load', hi: 'लोड नहीं हुआ', hinglish: 'Load nahi hua', gu: 'લોડ થવામાં નિષ્ફળ', mr: 'लोड होऊ शकले नाही', mwr: 'लोड कोनी हुयो' },
  failed: { en: 'Failed', hi: 'नहीं हुआ', hinglish: 'Fail hua', gu: 'નિષ્ફળ', mr: 'अयशस्वी', mwr: 'कोनी हुयो' },
  noTenants: { en: 'No tenants yet.', hi: 'अभी तक कोई टेनेंट नहीं।', hinglish: 'Abhi tak koi tenant nahi.', gu: 'હજુ સુધી કોઈ ટેનન્ટ નથી.', mr: 'अद्याप कोणताही टेनंट नाही.', mwr: 'अजे तांई कोई टेनेंट कोनी।' },
  thCompany: { en: 'Company', hi: 'कंपनी', hinglish: 'Company', gu: 'કંપની', mr: 'कंपनी', mwr: 'कंपनी' },
  thPlan: { en: 'Plan', hi: 'प्लान', hinglish: 'Plan', gu: 'પ્લાન', mr: 'प्लान', mwr: 'प्लान' },
  thStatus: { en: 'Status', hi: 'स्टेटस', hinglish: 'Status', gu: 'સ્ટેટસ', mr: 'स्थिती', mwr: 'स्टेटस' },
  thUsers: { en: 'Users', hi: 'यूज़र', hinglish: 'Users', gu: 'યૂઝર', mr: 'युझर', mwr: 'यूज़र' },
  thTrialEnds: { en: 'Trial ends', hi: 'ट्रायल खत्म', hinglish: 'Trial ends', gu: 'ટ્રાયલ સમાપ્ત', mr: 'ट्रायल संपते', mwr: 'ट्रायल खतम' },
  thCreated: { en: 'Created', hi: 'बनाया गया', hinglish: 'Created', gu: 'બનાવ્યું', mr: 'तयार केले', mwr: 'बणायो' },
  thActions: { en: 'Actions', hi: 'एक्शन', hinglish: 'Actions', gu: 'એક્શન', mr: 'क्रिया', mwr: 'एक्शन' },
  own: { en: 'own', hi: 'अपना', hinglish: 'own', gu: 'પોતાનું', mr: 'स्वतःचे', mwr: 'अपणो' },
  expired: { en: 'expired', hi: 'खत्म', hinglish: 'expired', gu: 'સમાપ્ત', mr: 'संपले', mwr: 'खतम' },
  extend30: { en: '+30 days', hi: '+30 दिन', hinglish: '+30 days', gu: '+30 દિવસ', mr: '+30 दिवस', mwr: '+30 दिन' },
  trialExtended: { en: 'Trial extended 30 days', hi: 'ट्रायल 30 दिन बढ़ा दिया', hinglish: 'Trial 30 days extend ho gaya', gu: 'ટ્રાયલ 30 દિવસ વધાર્યું', mr: 'ट्रायल 30 दिवस वाढवले', mwr: 'ट्रायल 30 दिन बढ़ा दियो' },
  activate: { en: 'Activate', hi: 'एक्टिवेट करें', hinglish: 'Activate karein', gu: 'એક્ટિવેટ કરો', mr: 'सक्रिय करा', mwr: 'एक्टिवेट करो' },
  reactivated: { en: 'Reactivated', hi: 'फिर एक्टिव कर दिया', hinglish: 'Reactivate ho gaya', gu: 'ફરી એક્ટિવ થયું', mr: 'पुन्हा सक्रिय केले', mwr: 'फेर एक्टिव कर दियो' },
  suspend: { en: 'Suspend', hi: 'सस्पेंड करें', hinglish: 'Suspend karein', gu: 'સસ્પેન્ડ કરો', mr: 'निलंबित करा', mwr: 'सस्पेंड करो' },
  suspended: { en: 'Suspended', hi: 'सस्पेंड कर दिया', hinglish: 'Suspend ho gaya', gu: 'સસ્પેન્ડ થયું', mr: 'निलंबित केले', mwr: 'सस्पेंड कर दियो' },
  markPaid: { en: 'Mark paid', hi: 'पेड मार्क करें', hinglish: 'Mark paid', gu: 'પેઇડ માર્ક કરો', mr: 'पेड म्हणून चिन्हांकित करा', mwr: 'पेड मार्क करो' },
  markedPaid: { en: 'Marked as paid (pro)', hi: 'पेड (प्रो) मार्क कर दिया', hinglish: 'Paid (pro) mark ho gaya', gu: 'પેઇડ (પ્રો) તરીકે માર્ક થયું', mr: 'पेड (प्रो) म्हणून चिन्हांकित केले', mwr: 'पेड (प्रो) मार्क कर दियो' },
};

function fmtDate(ms) {
  if (!ms) return '—';
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function PlatformConsolePage() {
  const { isPlatformAdmin } = useAuth();
  const t = useT(S);
  const [stats, setStats] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [showBroadcast, setShowBroadcast] = useState(false);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    try {
      const [s, list] = await Promise.all([platformApi.stats(), platformApi.tenants()]);
      setStats(s);
      setTenants(list);
    } catch (err) {
      showToast(err.response?.data?.error || t('failedToLoad'), 'error');
    } finally { setLoading(false); }
  }, [t]);

  useEffect(() => { load(); }, [load]);

  const act = async (id, body, msg) => {
    try {
      await platformApi.updateTenant(id, body);
      showToast(msg, 'success');
      load();
    } catch (err) {
      showToast(err.response?.data?.error || t('failed'), 'error');
    }
  };

  if (!isPlatformAdmin) {
    return <div className="card" style={{ maxWidth: 480, margin: '40px auto', textAlign: 'center' }}>
      <h3>{t('platformAdminsOnly')}</h3>
      <p style={{ color: 'var(--text2)', marginTop: 8 }}>{t('staffOnly')}</p>
    </div>;
  }

  const statusBadge = (s, expired) => expired ? 'badge-red'
    : s === 'suspended' ? 'badge-red' : s === 'active' ? 'badge-green' : 'badge-amber';

  return (
    <div data-legacy-id="page-platform">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600 }}>{t('platformConsole')}</h2>
          <div style={{ fontSize: 13, color: 'var(--text2)' }}>{t('allCompanies')}</div>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost btn-sm" onClick={() => setShowBroadcast(true)}>{t('broadcastBtn')}</button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowNew(true)}>{t('newBusiness')}</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 12, marginBottom: 16 }}>
        {[
          [t('statTenants'), stats?.tenants, null],
          [t('statActive'), stats?.active, 'var(--green)'],
          [t('statSuspended'), stats?.suspended, 'var(--red)'],
          [t('statTotalUsers'), stats?.users, null],
          [t('statTrial'), stats?.trial, 'var(--amber)'],
          [t('statPaid'), stats?.paid, 'var(--blue)'],
        ].map(([label, val, color]) => (
          <div key={label} className="card">
            <div style={{ fontSize: 12, color: 'var(--text2)' }}>{label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, marginTop: 2, color: color || 'var(--text)' }}>{val ?? '—'}</div>
          </div>
        ))}
      </div>

      {stats?.byPlan && Object.keys(stats.byPlan).length > 0 && (
        <div className="card mb-4">
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>{t('billingPlans')}</h3>
          {Object.entries(stats.byPlan).map(([plan, n]) => {
            const max = Math.max(1, ...Object.values(stats.byPlan));
            const pct = Math.round((n / max) * 100);
            return (
              <div key={plan} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                  <span style={{ textTransform: 'capitalize', color: 'var(--text2)' }}>{plan}</span>
                  <span style={{ fontWeight: 600 }}>{n}</span>
                </div>
                <div style={{ height: 9, background: 'var(--surface2)', borderRadius: 5, overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: plan === 'trial' ? 'var(--amber)' : 'var(--blue)', borderRadius: 5 }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" /></div>
        ) : !tenants.length ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>{t('noTenants')}</div>
        ) : (
          <table className="crm-table">
            <thead>
              <tr>
                <th>{t('thCompany')}</th><th>{t('thPlan')}</th><th>{t('thStatus')}</th><th>{t('thUsers')}</th>
                <th>{t('thTrialEnds')}</th><th>{t('thCreated')}</th><th style={{ minWidth: 280 }}>{t('thActions')}</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((tn) => {
                const expired = tn.status === 'expired' || (tn.plan === 'trial' && tn.trialEndsAt && Date.now() > tn.trialEndsAt);
                return (
                  <tr key={tn.id}>
                    <td><b>{tn.name}</b>{tn.legacy && <span className="badge badge-blue" style={{ marginLeft: 6 }}>{t('own')}</span>}</td>
                    <td style={{ textTransform: 'capitalize' }}>{tn.plan}</td>
                    <td><span className={`badge ${statusBadge(tn.status, expired)}`}>{expired ? t('expired') : tn.status}{tn.plan === 'trial' && !expired && tn.trialDaysLeft != null ? ` · ${tn.trialDaysLeft}d` : ''}</span></td>
                    <td>{tn.userCount}</td>
                    <td>{fmtDate(tn.trialEndsAt)}</td>
                    <td>{fmtDate(tn.createdAt)}</td>
                    <td>
                      <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
                        <button className="btn btn-ghost btn-xs" onClick={() => act(tn.id, { extendDays: 30 }, t('trialExtended'))}>{t('extend30')}</button>
                        {tn.status === 'suspended'
                          ? <button className="btn btn-success btn-xs" onClick={() => act(tn.id, { status: 'active' }, t('reactivated'))}>{t('activate')}</button>
                          : <button className="btn btn-danger btn-xs" onClick={() => act(tn.id, { status: 'suspended' }, t('suspended'))}>{t('suspend')}</button>}
                        <button className="btn btn-ghost btn-xs" onClick={() => act(tn.id, { plan: 'pro', status: 'active' }, t('markedPaid'))}>{t('markPaid')}</button>
                        <button className="btn btn-ghost btn-xs" onClick={() => navigate(`/company/${tn.id}`)}>👁 {t('view')}</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showNew && <NewBusinessModal t={t} onClose={() => setShowNew(false)} onDone={load} />}
      {showBroadcast && <BroadcastModal t={t} onClose={() => setShowBroadcast(false)} />}
    </div>
  );
}

function BroadcastModal({ t, onClose }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await platformApi.broadcast({ title: title.trim(), body: body.trim() });
      showToast(t('broadcastSent').replace('{n}', res?.sent ?? 0), 'success');
      onClose();
    } catch (err) { showToast(err.response?.data?.error || t('failed'), 'error'); }
    finally { setBusy(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <form className="card" onSubmit={submit} style={{ maxWidth: 420, width: '100%' }}>
        <h3 style={{ marginBottom: 12 }}>📢 {t('broadcastTitle')}</h3>
        <div className="form-group"><label>{t('fldBroadcastTitle')}</label><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus required /></div>
        <div className="form-group"><label>{t('fldBroadcastBody')}</label><textarea className="input" rows={5} value={body} onChange={(e) => setBody(e.target.value)} required /></div>
        <div className="flex gap-2 mt-2">
          <button type="button" className="btn btn-ghost flex-1" onClick={onClose}>{t('cancel')}</button>
          <button type="submit" className="btn btn-primary flex-1" disabled={busy}>{busy ? t('sending') : t('send')}</button>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>{t('broadcastHint')}</div>
      </form>
    </div>
  );
}

function NewBusinessModal({ t, onClose, onDone }) {
  const [f, setF] = useState({ companyName: '', name: '', email: '', password: '', plan: 'trial' });
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await platformApi.createTenant({ ...f, companyName: f.companyName.trim(), email: f.email.trim() });
      showToast(t('businessCreated'), 'success');
      onDone();
      onClose();
    } catch (err) { showToast(err.response?.data?.error || t('failed'), 'error'); }
    finally { setBusy(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <form className="card" onSubmit={submit} style={{ maxWidth: 420, width: '100%' }}>
        <h3 style={{ marginBottom: 12 }}>🏢 {t('createBusiness')}</h3>
        <div className="form-group"><label>{t('fldCompany')}</label><input className="input" value={f.companyName} onChange={(e) => set('companyName', e.target.value)} autoFocus required /></div>
        <div className="form-group"><label>{t('fldOwner')}</label><input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} /></div>
        <div className="form-group"><label>{t('fldEmail')}</label><input className="input" type="email" value={f.email} onChange={(e) => set('email', e.target.value)} required /></div>
        <div className="form-group"><label>{t('fldPassword')}</label><input className="input" type="text" value={f.password} onChange={(e) => set('password', e.target.value)} required /></div>
        <div className="form-group"><label>{t('fldPlan')}</label>
          <select className="input" value={f.plan} onChange={(e) => set('plan', e.target.value)}>
            <option value="trial">Trial</option><option value="pro">Pro (paid)</option><option value="free">Free</option>
          </select>
        </div>
        <div className="flex gap-2 mt-2">
          <button type="button" className="btn btn-ghost flex-1" onClick={onClose}>{t('cancel')}</button>
          <button type="submit" className="btn btn-primary flex-1" disabled={busy}>{busy ? t('creating') : t('createBusiness')}</button>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>{t('shareHint')}</div>
      </form>
    </div>
  );
}
