/**
 * Broadcast — bulk customer messaging. Pick a template (or write a message),
 * choose recipients from the client DB, and queue it. Messages go to the outbox
 * (status 'pending'); actual sending happens once a provider (WhatsApp/SMS) is
 * connected — until then "Send pending" reports that it's queued.
 */
import { useEffect, useMemo, useState } from 'react';
import { ref, onValue, db } from '../services/realtime';
import { messagingApi } from '../services/api';
import { useT } from '../i18n/LanguageContext';
import { showToast } from '../components/common/toast';

const S = {
  title:    { en: '📣 Broadcast', hi: '📣 ब्रॉडकास्ट', hinglish: '📣 Broadcast', gu: '📣 બ્રોડકાસ્ટ', mr: '📣 ब्रॉडकास्ट', mwr: '📣 ब्रॉडकास्ट' },
  send:     { en: 'Send', hi: 'भेजें', hinglish: 'Send', gu: 'મોકલો', mr: 'पाठवा', mwr: 'भेजो' },
  outbox:   { en: 'Outbox', hi: 'आउटबॉक्स', hinglish: 'Outbox', gu: 'આઉટબોક્સ', mr: 'आउटबॉक्स', mwr: 'आउटबॉक्स' },
  templates:{ en: 'Templates', hi: 'टेम्पलेट', hinglish: 'Templates', gu: 'ટેમ્પલેટ', mr: 'टेम्पलेट', mwr: 'टेम्पलेट' },
  notConnected:{ en: '⚠️ No messaging provider connected yet — messages are queued and will send once WhatsApp/SMS is wired.', hi: '⚠️ अभी कोई मैसेजिंग प्रोवाइडर कनेक्ट नहीं — मैसेज क्यू में हैं।', hinglish: '⚠️ Abhi koi messaging provider connect nahi — messages queue mein hain.', gu: '⚠️ હજુ કોઈ પ્રોવાઇડર કનેક્ટ નથી — સંદેશ ક્યૂમાં છે.', mr: '⚠️ अद्याप प्रोव्हायडर कनेक्ट नाही — संदेश रांगेत आहेत.', mwr: '⚠️ अजे कोई प्रोवाइडर कनेक्ट कोनी — मैसेज क्यू मांय है।' },
  template: { en: 'Template', hi: 'टेम्पलेट', hinglish: 'Template', gu: 'ટેમ્પલેટ', mr: 'टेम्पलेट', mwr: 'टेम्पलेट' },
  custom:   { en: 'Custom message', hi: 'कस्टम मैसेज', hinglish: 'Custom message', gu: 'કસ્ટમ સંદેશ', mr: 'कस्टम संदेश', mwr: 'कस्टम मैसेज' },
  channel:  { en: 'Channel', hi: 'चैनल', hinglish: 'Channel', gu: 'ચેનલ', mr: 'चॅनल', mwr: 'चैनल' },
  allClients:{ en: 'All clients', hi: 'सभी क्लाइंट', hinglish: 'All clients', gu: 'બધા ક્લાયન્ટ', mr: 'सर्व क्लायंट', mwr: 'सगळा क्लाइंट' },
  recipients:{ en: 'Recipients', hi: 'प्राप्तकर्ता', hinglish: 'Recipients', gu: 'પ્રાપ્તકર્તા', mr: 'प्राप्तकर्ते', mwr: 'प्राप्तकर्ता' },
  link:     { en: 'Link (for {link})', hi: 'लिंक', hinglish: 'Link (for {link})', gu: 'લિંક', mr: 'लिंक', mwr: 'लिंक' },
  queued:   { en: 'Queued', hi: 'क्यू में डाला', hinglish: 'Queue mein dala', gu: 'ક્યૂમાં', mr: 'रांगेत', mwr: 'क्यू मांय' },
  pickRec:  { en: 'Pick recipients first', hi: 'पहले प्राप्तकर्ता चुनें', hinglish: 'Pehle recipients chunein', gu: 'પહેલા પ્રાપ્તકર્તા પસંદ કરો', mr: 'आधी प्राप्तकर्ते निवडा', mwr: 'पैला प्राप्तकर्ता चुणो' },
  sendPending:{ en: 'Send pending', hi: 'पेंडिंग भेजें', hinglish: 'Send pending', gu: 'પેન્ડિંગ મોકલો', mr: 'प्रलंबित पाठवा', mwr: 'पेंडिंग भेजो' },
  save:     { en: 'Save', hi: 'सेव', hinglish: 'Save', gu: 'સેવ', mr: 'सेव', mwr: 'सेव' },
  saved:    { en: 'Saved', hi: 'सेव हो गया', hinglish: 'Saved', gu: 'સેવ થયું', mr: 'सेव झाले', mwr: 'सेव हो ग्यो' },
  none:     { en: 'No messages yet.', hi: 'अभी कोई मैसेज नहीं।', hinglish: 'Abhi koi message nahi.', gu: 'હજુ કોઈ સંદેશ નથી.', mr: 'अद्याप संदेश नाही.', mwr: 'अजे कोई मैसेज कोनी।' },
  failed:   { en: 'Failed', hi: 'नहीं हुआ', hinglish: 'Fail hua', gu: 'નિષ્ફળ', mr: 'अयशस्वी', mwr: 'कोनी हुयो' },
};
const STATUS_TONE = { sent: 'badge-green', pending: 'badge-amber', failed: 'badge-red' };

export default function BroadcastPage() {
  const t = useT(S);
  const [tab, setTab] = useState('send');
  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>{t('title')}</h2>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {[['send', t('send')], ['outbox', t('outbox')], ['templates', t('templates')]].map(([k, label]) => (
          <button key={k} className="btn btn-xs" onClick={() => setTab(k)}
            style={{ background: tab === k ? 'var(--blue, #C05621)' : 'var(--surface2)', color: tab === k ? '#fff' : 'var(--text2)', border: 'none', borderRadius: 14 }}>{label}</button>
        ))}
      </div>
      {tab === 'send' && <Compose t={t} />}
      {tab === 'outbox' && <Outbox t={t} />}
      {tab === 'templates' && <Templates t={t} />}
    </div>
  );
}

function Compose({ t }) {
  const [clients, setClients] = useState({});
  const [templates, setTemplates] = useState([]);
  const [templateKey, setTemplateKey] = useState('');
  const [body, setBody] = useState('');
  const [channel, setChannel] = useState('whatsapp');
  const [all, setAll] = useState(true);
  const [selected, setSelected] = useState([]);
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const u = onValue(ref(db, 'mpw/clients'), (s) => setClients(s.val() || {}));
    messagingApi.templates().then((tp) => { setTemplates(tp); }).catch(() => {});
    return () => u();
  }, []);

  const clientList = useMemo(() => Object.entries(clients).map(([id, v]) => ({ ...v, id })), [clients]);
  const previewBody = body || (templates.find((x) => x.key === templateKey)?.body) || '';

  const send = async () => {
    if (!all && !selected.length) return showToast(t('pickRec'), 'error');
    setBusy(true);
    try {
      const r = await messagingApi.broadcast({ templateKey: body ? undefined : templateKey, body: body || undefined, channel, link, all, clientIds: all ? undefined : selected });
      showToast(`${t('queued')}: ${r.queued}`, 'success');
    } catch (e) { showToast(e.response?.data?.error || t('failed'), 'error'); }
    finally { setBusy(false); }
  };

  return (
    <>
      <div className="card" style={{ background: 'var(--amber-light, #FEF3E2)', color: 'var(--amber)', marginBottom: 12, fontSize: 13 }}>{t('notConnected')}</div>
      <div className="form-group">
        <label>{t('template')}</label>
        <select className="input" value={templateKey} onChange={(e) => { setTemplateKey(e.target.value); setBody(''); }}>
          <option value="">{t('custom')}</option>
          {templates.map((tp) => <option key={tp.key} value={tp.key}>{tp.key}</option>)}
        </select>
      </div>
      <div className="form-group">
        <label>{t('custom')} {previewBody && !body ? '(template — edit to override)' : ''}</label>
        <textarea className="input" rows={3} value={body} placeholder={previewBody} onChange={(e) => setBody(e.target.value)} />
      </div>
      <div className="flex gap-2">
        <div className="form-group" style={{ flex: 1 }}>
          <label>{t('channel')}</label>
          <select className="input" value={channel} onChange={(e) => setChannel(e.target.value)}>
            <option value="whatsapp">WhatsApp</option><option value="sms">SMS</option><option value="email">Email</option>
          </select>
        </div>
        <div className="form-group" style={{ flex: 2 }}><label>{t('link')}</label><input className="input" value={link} onChange={(e) => setLink(e.target.value)} /></div>
      </div>

      <div className="form-group">
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> {t('allClients')} ({clientList.length})
        </label>
      </div>
      {!all && (
        <div className="card" style={{ maxHeight: 200, overflow: 'auto', marginBottom: 12 }}>
          {clientList.map((c) => (
            <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 14 }}>
              <input type="checkbox" checked={selected.includes(c.id)} onChange={() => setSelected((s) => s.includes(c.id) ? s.filter((x) => x !== c.id) : [...s, c.id])} />
              {c.name || '—'} {c.phone ? `· ${c.phone}` : ''}
            </label>
          ))}
        </div>
      )}

      <button className="btn btn-primary" onClick={send} disabled={busy || !previewBody}>{busy ? '…' : `${t('send')} (${all ? clientList.length : selected.length})`}</button>
    </>
  );
}

function Outbox({ t }) {
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = () => messagingApi.outbox().then(setRows).catch(() => setRows([]));
  useEffect(() => { load(); }, []);
  const flush = async () => {
    setBusy(true);
    try { const r = await messagingApi.sendPending(); showToast(r.providerReady ? `Sent ${r.sent}` : `${r.pending} queued (no provider)`, r.providerReady ? 'success' : 'info'); load(); }
    catch (e) { showToast(e.response?.data?.error || t('failed'), 'error'); }
    finally { setBusy(false); }
  };
  if (!rows) return <div className="card" style={{ textAlign: 'center', padding: 20, color: 'var(--text3)' }}>…</div>;
  return (
    <>
      <button className="btn btn-ghost btn-sm mb-4" onClick={flush} disabled={busy}>{t('sendPending')}</button>
      {!rows.length && <div className="card" style={{ textAlign: 'center', padding: 30, color: 'var(--text3)' }}>{t('none')}</div>}
      {rows.map((m, i) => (
        <div key={i} className="card" style={{ marginBottom: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ fontSize: 13 }}>
              <b>{m.clientName || m.to || '—'}</b> <span className="badge badge-blue">{m.channel}</span> <span className={`badge ${STATUS_TONE[m.status] || ''}`}>{m.status}</span>
              <div style={{ color: 'var(--text2)', marginTop: 2 }}>{m.body}</div>
            </div>
          </div>
        </div>
      ))}
    </>
  );
}

function Templates({ t }) {
  const [rows, setRows] = useState(null);
  useEffect(() => { messagingApi.templates().then(setRows).catch(() => setRows([])); }, []);
  if (!rows) return <div className="card" style={{ textAlign: 'center', padding: 20, color: 'var(--text3)' }}>…</div>;
  return rows.map((tp) => <TemplateRow key={tp.key} tp={tp} t={t} />);
}

function TemplateRow({ tp, t }) {
  const [body, setBody] = useState(tp.body);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try { await messagingApi.saveTemplate(tp.key, body); showToast(t('saved'), 'success'); }
    catch (e) { showToast(e.response?.data?.error || t('failed'), 'error'); }
    finally { setBusy(false); }
  };
  return (
    <div className="card" style={{ marginBottom: 8 }}>
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>{tp.key} {tp.custom && <span className="badge badge-green">custom</span>}</div>
      <textarea className="input" rows={2} value={body} onChange={(e) => setBody(e.target.value)} />
      <button className="btn btn-ghost btn-sm" style={{ marginTop: 6 }} onClick={save} disabled={busy || body === tp.body}>{t('save')}</button>
    </div>
  );
}
