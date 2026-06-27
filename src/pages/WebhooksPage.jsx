/**
 * Webhooks — register outbound HTTP endpoints that MeraDhanda calls when events
 * fire (job.created, invoice.paid, …). On mount we load the endpoints
 * (webhooksApi.list) and the recent deliveries (webhooksApi.logs).
 *
 * - "+ Add webhook" opens a modal: URL, event checkboxes, active toggle ->
 *   webhooksApi.create. The signing secret is returned ONCE and shown here with
 *   an explanation of the X-MD-Signature header (sha256 HMAC of the body).
 * - Per endpoint: active toggle (webhooksApi.update), Test (webhooksApi.test),
 *   Delete (confirm -> webhooksApi.remove).
 * Admin-only screen; the backend also enforces this. SSRF-unsafe URLs are
 * rejected server-side (localhost / private ranges).
 */
import { useEffect, useState } from 'react';
import { webhooksApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useT } from '../i18n/LanguageContext';
import { showToast } from '../components/common/toast';

// Event catalog for the UI (mirrors the backend EVENTS list).
const EVENTS = ['job.created', 'job.dispatched', 'invoice.created', 'invoice.paid', 'lead.created', 'ping'];

const S = {
  title:      { en: '🪝 Webhooks', hi: '🪝 वेबहुक', hinglish: '🪝 Webhooks', gu: '🪝 વેબહૂક', mr: '🪝 वेबहूक', mwr: '🪝 वेबहुक' },
  subtitle:   { en: 'Get real-time HTTP callbacks when events happen in your account.', hi: 'जब आपके अकाउंट में इवेंट होते हैं तो रियल-टाइम HTTP कॉलबैक पाएं।', hinglish: 'Jab aapke account mein events hote hain to real-time HTTP callbacks paayein.', gu: 'જ્યારે તમારા એકાઉન્ટમાં ઇવેન્ટ થાય ત્યારે રિયલ-ટાઇમ HTTP કૉલબેક મેળવો.', mr: 'तुमच्या खात्यात इव्हेंट होतात तेव्हा रिअल-टाइम HTTP कॉलबॅक मिळवा.', mwr: 'जद थारा अकाउंट मांय इवेंट होवै तो रियल-टाइम HTTP कॉलबैक पावो।' },
  add:        { en: '+ Add webhook', hi: '+ वेबहुक जोड़ें', hinglish: '+ Webhook add karein', gu: '+ વેબહૂક ઉમેરો', mr: '+ वेबहूक जोडा', mwr: '+ वेबहुक जोड़ो' },
  none:       { en: 'No webhooks yet. Add one to start receiving events.', hi: 'अभी कोई वेबहुक नहीं। इवेंट पाने के लिए एक जोड़ें।', hinglish: 'Abhi koi webhook nahi. Events paane ke liye ek add karein.', gu: 'હજુ કોઈ વેબહૂક નથી. ઇવેન્ટ મેળવવા એક ઉમેરો.', mr: 'अद्याप वेबहूक नाही. इव्हेंट मिळवण्यासाठी एक जोडा.', mwr: 'अजे कोई वेबहुक कोनी। इवेंट पावण खातर एक जोड़ो।' },
  endpoint:   { en: 'Endpoint', hi: 'एंडपॉइंट', hinglish: 'Endpoint', gu: 'એન્ડપોઇન્ટ', mr: 'एंडपॉइंट', mwr: 'एंडपॉइंट' },
  events:     { en: 'Events', hi: 'इवेंट', hinglish: 'Events', gu: 'ઇવેન્ટ', mr: 'इव्हेंट', mwr: 'इवेंट' },
  active:     { en: 'Active', hi: 'एक्टिव', hinglish: 'Active', gu: 'એક્ટિવ', mr: 'सक्रिय', mwr: 'एक्टिव' },
  paused:     { en: 'Paused', hi: 'रुका हुआ', hinglish: 'Paused', gu: 'થોભેલું', mr: 'थांबवलेले', mwr: 'रुक्यो' },
  test:       { en: 'Test', hi: 'टेस्ट', hinglish: 'Test', gu: 'ટેસ્ટ', mr: 'टेस्ट', mwr: 'टेस्ट' },
  remove:     { en: 'Delete', hi: 'हटाएं', hinglish: 'Delete', gu: 'કાઢો', mr: 'हटवा', mwr: 'हटावो' },
  confirmDel: { en: 'Delete this webhook?', hi: 'यह वेबहुक हटाएं?', hinglish: 'Yeh webhook delete karein?', gu: 'આ વેબહૂક કાઢો?', mr: 'हा वेबहूक हटवायचा?', mwr: 'यो वेबहुक हटावां?' },
  url:        { en: 'Payload URL', hi: 'पेलोड URL', hinglish: 'Payload URL', gu: 'પેલોડ URL', mr: 'पेलोड URL', mwr: 'पेलोड URL' },
  urlHint:    { en: 'Must be a public https:// URL — localhost and private IPs are rejected.', hi: 'सार्वजनिक https:// URL होना चाहिए — localhost और प्राइवेट IP अस्वीकृत हैं।', hinglish: 'Public https:// URL hona chahiye — localhost aur private IPs rejected hain.', gu: 'સાર્વજનિક https:// URL હોવું જોઈએ — localhost અને પ્રાઇવેટ IP નકારવામાં આવે છે.', mr: 'सार्वजनिक https:// URL असावा — localhost व खाजगी IP नाकारले जातात.', mwr: 'पब्लिक https:// URL होणो चाइजे — localhost अर प्राइवेट IP नकारिज्जै।' },
  selectEvents:{ en: 'Subscribe to events', hi: 'इवेंट सब्सक्राइब करें', hinglish: 'Events subscribe karein', gu: 'ઇવેન્ટ સબ્સ્ક્રાઇબ કરો', mr: 'इव्हेंट सबस्क्राइब करा', mwr: 'इवेंट सब्सक्राइब करो' },
  activeNow:  { en: 'Active (start delivering immediately)', hi: 'एक्टिव (तुरंत डिलीवर करें)', hinglish: 'Active (turant deliver karein)', gu: 'એક્ટિવ (તરત જ ડિલિવર કરો)', mr: 'सक्रिय (लगेच डिलिव्हर करा)', mwr: 'एक्टिव (तुरंत डिलीवर करो)' },
  create:     { en: 'Create webhook', hi: 'वेबहुक बनाएं', hinglish: 'Webhook banayein', gu: 'વેબહૂક બનાવો', mr: 'वेबहूक तयार करा', mwr: 'वेबहुक बणावो' },
  cancel:     { en: 'Cancel', hi: 'रद्द करें', hinglish: 'Cancel', gu: 'રદ કરો', mr: 'रद्द करा', mwr: 'रद्द करो' },
  close:      { en: 'Close', hi: 'बंद करें', hinglish: 'Close', gu: 'બંધ કરો', mr: 'बंद करा', mwr: 'बंद करो' },
  creating:   { en: 'Creating…', hi: 'बन रहा है…', hinglish: 'Ban raha hai…', gu: 'બની રહ્યું છે…', mr: 'तयार होत आहे…', mwr: 'बण रियो है…' },
  urlRequired:{ en: 'Payload URL is required', hi: 'पेलोड URL ज़रूरी है', hinglish: 'Payload URL zaroori hai', gu: 'પેલોડ URL જરૂરી છે', mr: 'पेलोड URL आवश्यक आहे', mwr: 'पेलोड URL जरूरी है' },
  pickEvent:  { en: 'Pick at least one event', hi: 'कम से कम एक इवेंट चुनें', hinglish: 'Kam se kam ek event chunein', gu: 'ઓછામાં ઓછું એક ઇવેન્ટ પસંદ કરો', mr: 'किमान एक इव्हेंट निवडा', mwr: 'कम सूं कम एक इवेंट चुणो' },
  created:    { en: 'Webhook created', hi: 'वेबहुक बन गया', hinglish: 'Webhook ban gaya', gu: 'વેબહૂક બન્યો', mr: 'वेबहूक तयार झाला', mwr: 'वेबहुक बण ग्यो' },
  deleted:    { en: 'Webhook deleted', hi: 'वेबहुक हटा दिया', hinglish: 'Webhook delete ho gaya', gu: 'વેબહૂક કાઢ્યો', mr: 'वेबहूक हटवला', mwr: 'वेबहुक हटा दियो' },
  testSent:   { en: 'Test ping dispatched', hi: 'टेस्ट पिंग भेजा गया', hinglish: 'Test ping bhej diya', gu: 'ટેસ્ટ પિંગ મોકલ્યું', mr: 'टेस्ट पिंग पाठवले', mwr: 'टेस्ट पिंग भेज्यो' },
  updated:    { en: 'Updated', hi: 'अपडेट हो गया', hinglish: 'Update ho gaya', gu: 'અપડેટ થયું', mr: 'अपडेट झाले', mwr: 'अपडेट हो ग्यो' },
  failed:     { en: 'Failed', hi: 'नहीं हुआ', hinglish: 'Fail hua', gu: 'નિષ્ફળ', mr: 'अयशस्वी', mwr: 'कोनी हुयो' },
  secretTitle:{ en: '✅ Webhook created — save your signing secret', hi: '✅ वेबहुक बन गया — साइनिंग सीक्रेट सेव करें', hinglish: '✅ Webhook ban gaya — signing secret save karein', gu: '✅ વેબહૂક બન્યો — સાઇનિંગ સિક્રેટ સેવ કરો', mr: '✅ वेबहूक तयार झाला — साइनिंग सीक्रेट सेव्ह करा', mwr: '✅ वेबहुक बण ग्यो — साइनिंग सीक्रेट सेव करो' },
  secretOnce: { en: 'This secret is shown only once. Store it securely now.', hi: 'यह सीक्रेट सिर्फ़ एक बार दिखेगा। इसे अभी सुरक्षित रखें।', hinglish: 'Yeh secret sirf ek baar dikhega. Ab securely store karein.', gu: 'આ સિક્રેટ ફક્ત એક જ વાર બતાવાશે. હમણાં સુરક્ષિત રાખો.', mr: 'हे सीक्रेट फक्त एकदाच दिसेल. आता सुरक्षित ठेवा.', mwr: 'यो सीक्रेट सिरफ एक बार दिखसी। अबार सुरक्षित राखो।' },
  secretExpl: { en: 'Every delivery includes an X-MD-Signature header = "sha256=" + HMAC-SHA256 of the raw request body, keyed with this secret. Verify it on your server to confirm the request came from MeraDhanda.', hi: 'हर डिलीवरी में X-MD-Signature हेडर होता है = "sha256=" + रॉ बॉडी का HMAC-SHA256, इस सीक्रेट से। अपने सर्वर पर इसे वेरिफ़ाई करें।', hinglish: 'Har delivery mein X-MD-Signature header hota hai = "sha256=" + raw body ka HMAC-SHA256, is secret se. Apne server par verify karein ki request MeraDhanda se aayi hai.', gu: 'દરેક ડિલિવરીમાં X-MD-Signature હેડર હોય છે = "sha256=" + રો બોડીનું HMAC-SHA256, આ સિક્રેટ સાથે. તમારા સર્વર પર ચકાસો.', mr: 'प्रत्येक डिलिव्हरीमध्ये X-MD-Signature हेडर असते = "sha256=" + रॉ बॉडीचे HMAC-SHA256, या सीक्रेटने. तुमच्या सर्व्हरवर पडताळा.', mwr: 'हर डिलीवरी मांय X-MD-Signature हेडर रैवै = "sha256=" + रॉ बॉडी रो HMAC-SHA256, इण सीक्रेट सूं। थारा सर्वर पर वेरिफाई करो।' },
  copy:       { en: 'Copy', hi: 'कॉपी', hinglish: 'Copy', gu: 'કૉપિ', mr: 'कॉपी', mwr: 'कॉपी' },
  copied:     { en: 'Copied', hi: 'कॉपी हो गया', hinglish: 'Copy ho gaya', gu: 'કૉપિ થયું', mr: 'कॉपी झाले', mwr: 'कॉपी हो ग्यो' },
  recent:     { en: 'Recent deliveries', hi: 'हाल की डिलीवरी', hinglish: 'Recent deliveries', gu: 'તાજેતરની ડિલિવરી', mr: 'अलीकडील डिलिव्हरी', mwr: 'हाल री डिलीवरी' },
  noLogs:     { en: 'No deliveries yet.', hi: 'अभी कोई डिलीवरी नहीं।', hinglish: 'Abhi koi delivery nahi.', gu: 'હજુ કોઈ ડિલિવરી નથી.', mr: 'अद्याप डिलिव्हरी नाही.', mwr: 'अजे कोई डिलीवरी कोनी।' },
  refresh:    { en: '↻ Refresh', hi: '↻ रिफ्रेश', hinglish: '↻ Refresh', gu: '↻ રિફ્રેશ', mr: '↻ रिफ्रेश', mwr: '↻ रिफ्रेश' },
  adminOnly:  { en: 'Only admins can manage webhooks.', hi: 'सिर्फ़ एडमिन वेबहुक मैनेज कर सकते हैं।', hinglish: 'Sirf admins webhooks manage kar sakte hain.', gu: 'ફક્ત એડમિન વેબહૂક મેનેજ કરી શકે છે.', mr: 'फक्त अॅडमिन वेबहूक व्यवस्थापित करू शकतात.', mwr: 'सिरफ एडमिन वेबहुक मैनेज कर सके।' },
};

export default function WebhooksPage() {
  const { hasRole } = useAuth();
  const t = useT(S);
  const canManage = hasRole('admin', 'superadmin', 'owner');

  const [hooks, setHooks] = useState(null);
  const [logs, setLogs] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newSecret, setNewSecret] = useState(null); // { url, secret } shown once

  const loadHooks = () => webhooksApi.list().then(setHooks).catch(() => setHooks([]));
  const loadLogs = () => webhooksApi.logs().then(setLogs).catch(() => setLogs([]));

  useEffect(() => { loadHooks(); loadLogs(); }, []);

  const onCreated = (res) => {
    setShowAdd(false);
    if (res?.secret) setNewSecret({ url: res.url, secret: res.secret });
    showToast(t('created'), 'success');
    loadHooks();
  };

  if (!canManage) {
    return (
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>{t('title')}</h2>
        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>{t('adminOnly')}</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600 }}>{t('title')}</h2>
          <div style={{ fontSize: 13, color: 'var(--text2)' }}>{t('subtitle')}</div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>{t('add')}</button>
      </div>

      {newSecret && <SecretReveal data={newSecret} t={t} onClose={() => setNewSecret(null)} />}

      {hooks === null ? (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>…</div>
      ) : !hooks.length ? (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>{t('none')}</div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'auto', marginBottom: 16 }}>
          <table className="crm-table">
            <thead>
              <tr>
                <th>{t('endpoint')}</th>
                <th>{t('events')}</th>
                <th>{t('active')}</th>
                <th style={{ textAlign: 'right' }}></th>
              </tr>
            </thead>
            <tbody>
              {hooks.map((w) => <HookRow key={w.id} w={w} t={t} reload={loadHooks} reloadLogs={loadLogs} />)}
            </tbody>
          </table>
        </div>
      )}

      <DeliveriesPanel logs={logs} t={t} reload={loadLogs} />

      {showAdd && <AddWebhookModal t={t} onClose={() => setShowAdd(false)} onCreated={onCreated} />}
    </div>
  );
}

function HookRow({ w, t, reload, reloadLogs }) {
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState(!!w.active);

  const toggle = async () => {
    const next = !active;
    setActive(next);
    setBusy(true);
    try {
      await webhooksApi.update(w.id, { active: next });
      showToast(t('updated'), 'success');
    } catch (e) {
      setActive(!next); // revert on failure
      showToast(e.response?.data?.error || t('failed'), 'error');
    } finally { setBusy(false); }
  };

  const test = async () => {
    setBusy(true);
    try { await webhooksApi.test(w.id); showToast(t('testSent'), 'success'); reloadLogs(); }
    catch (e) { showToast(e.response?.data?.error || t('failed'), 'error'); }
    finally { setBusy(false); }
  };

  const remove = async () => {
    if (!window.confirm(t('confirmDel'))) return;
    setBusy(true);
    try { await webhooksApi.remove(w.id); showToast(t('deleted'), 'success'); reload(); }
    catch (e) { showToast(e.response?.data?.error || t('failed'), 'error'); }
    finally { setBusy(false); }
  };

  return (
    <tr>
      <td style={{ maxWidth: 280, wordBreak: 'break-all' }}>
        <span style={{ fontFamily: 'monospace', fontSize: 13 }}>{w.url}</span>
        {w.secretPrefix && <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'monospace' }}>{w.secretPrefix}…</div>}
      </td>
      <td>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {(w.events || []).length
            ? w.events.map((ev) => <span key={ev} className="badge badge-blue">{ev}</span>)
            : <span style={{ color: 'var(--text3)' }}>—</span>}
        </div>
      </td>
      <td>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input type="checkbox" checked={active} onChange={toggle} disabled={busy} style={{ width: 18, height: 18 }} />
          <span className={`badge ${active ? 'badge-green' : 'badge-amber'}`}>{active ? t('active') : t('paused')}</span>
        </label>
      </td>
      <td style={{ textAlign: 'right' }}>
        <div className="flex gap-2 items-center" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost btn-xs" onClick={test} disabled={busy}>{t('test')}</button>
          <button className="btn btn-ghost btn-xs" onClick={remove} disabled={busy} style={{ color: 'var(--red)' }}>{t('remove')}</button>
        </div>
      </td>
    </tr>
  );
}

function DeliveriesPanel({ logs, t, reload }) {
  return (
    <div className="card" style={{ padding: 0 }}>
      <div className="flex items-center justify-between" style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{t('recent')}</span>
        <button className="btn btn-ghost btn-xs" onClick={reload}>{t('refresh')}</button>
      </div>
      {logs === null ? (
        <div style={{ textAlign: 'center', padding: 24, color: 'var(--text3)' }}>…</div>
      ) : !logs.length ? (
        <div style={{ textAlign: 'center', padding: 24, color: 'var(--text3)' }}>{t('noLogs')}</div>
      ) : (
        logs.map((l) => (
          <div key={l._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '10px 14px', borderTop: '1px solid var(--border)', fontSize: 13 }}>
            <div style={{ minWidth: 0 }}>
              <span className="badge badge-blue">{l.event}</span>
              <span style={{ color: 'var(--text2)', marginLeft: 8, fontFamily: 'monospace', wordBreak: 'break-all' }}>{l.url}</span>
              {l.responseSnippet && <div style={{ color: 'var(--text3)', fontSize: 11, marginTop: 2, wordBreak: 'break-all' }}>{l.responseSnippet}</div>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <span className={`badge ${l.ok ? 'badge-green' : 'badge-red'}`}>{l.ok ? 'ok' : 'fail'} · {String(l.status)}</span>
              <span style={{ color: 'var(--text3)', whiteSpace: 'nowrap' }}>{fmtTime(l.ts)}</span>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function SecretReveal({ data, t, onClose }) {
  const copy = async () => {
    try { await navigator.clipboard.writeText(data.secret); showToast(t('copied'), 'success'); }
    catch { showToast(t('failed'), 'error'); }
  };
  return (
    <div className="card" style={{ background: 'var(--surface2)', border: '1px solid var(--green)', marginBottom: 16 }}>
      <div style={{ fontWeight: 700, color: 'var(--green)', marginBottom: 4 }}>{t('secretTitle')}</div>
      <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 8 }}>{t('secretOnce')}</div>
      <div className="flex gap-2 items-center mb-2">
        <input className="input" readOnly value={data.secret} style={{ fontFamily: 'monospace', fontSize: 13 }} onFocus={(e) => e.target.select()} />
        <button className="btn btn-primary btn-sm" onClick={copy}>{t('copy')}</button>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.5 }}>{t('secretExpl')}</div>
      <div style={{ marginTop: 10 }}>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>{t('close')}</button>
      </div>
    </div>
  );
}

function AddWebhookModal({ t, onClose, onCreated }) {
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState(['job.created']);
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);

  const toggleEvent = (ev) => setEvents((s) => s.includes(ev) ? s.filter((x) => x !== ev) : [...s, ev]);

  const submit = async (e) => {
    e.preventDefault();
    if (!url.trim()) return showToast(t('urlRequired'), 'error');
    if (!events.length) return showToast(t('pickEvent'), 'error');
    setBusy(true);
    try {
      const res = await webhooksApi.create({ url: url.trim(), events, active });
      onCreated(res);
    } catch (err) {
      showToast(err.response?.data?.error || t('failed'), 'error');
    } finally { setBusy(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <form className="card" onSubmit={submit} style={{ maxWidth: 460, width: '100%', maxHeight: '90vh', overflow: 'auto' }}>
        <h3 style={{ marginBottom: 14 }}>{t('add')}</h3>

        <div className="form-group">
          <label>{t('url')}</label>
          <input className="input" type="url" placeholder="https://example.com/webhooks/meradhanda" value={url} onChange={(e) => setUrl(e.target.value)} autoFocus />
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{t('urlHint')}</div>
        </div>

        <div className="form-group">
          <label>{t('selectEvents')}</label>
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            {EVENTS.map((ev, i) => (
              <label key={ev} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', cursor: 'pointer', borderTop: i ? '1px solid var(--border)' : 'none' }}>
                <input type="checkbox" checked={events.includes(ev)} onChange={() => toggleEvent(ev)} style={{ width: 18, height: 18 }} />
                <span style={{ fontFamily: 'monospace', fontSize: 13 }}>{ev}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} style={{ width: 18, height: 18 }} />
            {t('activeNow')}
          </label>
        </div>

        <div className="flex gap-2 mt-2">
          <button type="submit" className="btn btn-primary flex-1" disabled={busy}>{busy ? t('creating') : t('create')}</button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>{t('cancel')}</button>
        </div>
      </form>
    </div>
  );
}

function fmtTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}
