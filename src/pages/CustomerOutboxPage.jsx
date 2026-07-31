/**
 * Customer WhatsApp Outbox — the assisted "click to send" surface for the
 * per-order customer notifications the pipeline queues at each stage.
 *
 * Each row is a `tenantNotifications` document of type `customer_message`
 * ({ id, to, body, event, jobNo, clientName, status, createdAt, sentAt }).
 * Pending rows get a "Send on WhatsApp" button: it opens wa.me with the message
 * pre-filled, then marks the message sent (messagingApi.markSent) and refetches.
 *
 * Realtime: subscribes to mpw/tenantNotifications (same shim the other pages use)
 * so a message queued elsewhere in the app pops in without a manual refresh.
 *
 * Stages that message the customer (the "notify set"): enquiry (order received),
 * jobsetter (design ready/approved), production (in production), qc (quality
 * check), dispatch (out for delivery), delivered (+ review link). NOTE the
 * 'designer' / with-design-team stage is intentionally NOT in this set.
 */
import { useEffect, useMemo, useState } from 'react';
import { ref, onValue, db } from '../services/realtime';
import { messagingApi } from '../services/api';
import { useT } from '../i18n/LanguageContext';
import { showToast } from '../components/common/toast';

const S = {
  title:   { en: '📲 WhatsApp Outbox', hi: '📲 व्हाट्सएप आउटबॉक्स', hinglish: '📲 WhatsApp Outbox', gu: '📲 વોટ્સએપ આઉટબોક્સ', mr: '📲 व्हॉट्सअॅप आउटबॉक्स', mwr: '📲 व्हाट्सएप आउटबॉक्स' },
  subtitle:{ en: 'Send the ready customer updates on WhatsApp — one tap each.', hi: 'तैयार ग्राहक अपडेट व्हाट्सएप पर भेजें — एक टैप में।', hinglish: 'Ready customer updates WhatsApp par bhejein — ek tap mein.', gu: 'તૈયાર ગ્રાહક અપડેટ વોટ્સએપ પર મોકલો — એક ટેપમાં.', mr: 'तयार ग्राहक अपडेट व्हॉट्सअॅपवर पाठवा — एका टॅपमध्ये.', mwr: 'त्यार ग्राहक अपडेट व्हाट्सएप पर भेजो — एक टैप मांय।' },
  pending: { en: 'Pending', hi: 'बाकी', hinglish: 'Pending', gu: 'બાકી', mr: 'प्रलंबित', mwr: 'बाकी' },
  sent:    { en: 'Sent', hi: 'भेजा गया', hinglish: 'Sent', gu: 'મોકલ્યું', mr: 'पाठवले', mwr: 'भेज्यो' },
  all:     { en: 'All', hi: 'सभी', hinglish: 'All', gu: 'બધા', mr: 'सर्व', mwr: 'सगळा' },
  sendBtn: { en: 'Send on WhatsApp', hi: 'व्हाट्सएप पर भेजें', hinglish: 'WhatsApp par bhejein', gu: 'વોટ્સએપ પર મોકલો', mr: 'व्हॉट्सअॅपवर पाठवा', mwr: 'व्हाट्सएप पर भेजो' },
  resend:  { en: 'Send again', hi: 'फिर भेजें', hinglish: 'Phir bhejein', gu: 'ફરી મોકલો', mr: 'पुन्हा पाठवा', mwr: 'फेर भेजो' },
  noPhone: { en: 'No mobile number on this message', hi: 'इस मैसेज पर मोबाइल नंबर नहीं', hinglish: 'Is message par mobile number nahi', gu: 'આ સંદેશ પર મોબાઇલ નંબર નથી', mr: 'या संदेशावर मोबाइल नंबर नाही', mwr: 'इण मैसेज पर मोबाइल नंबर कोनी' },
  marked:  { en: 'Marked as sent', hi: 'भेजा हुआ मार्क किया', hinglish: 'Sent mark kiya', gu: 'મોકલ્યું તરીકે માર્ક', mr: 'पाठवले म्हणून खूण', mwr: 'भेज्यो मार्क कर्यो' },
  failed:  { en: 'Something went wrong', hi: 'कुछ गड़बड़ हुई', hinglish: 'Kuch gadbad hui', gu: 'કંઈક ખોટું થયું', mr: 'काहीतरी चुकले', mwr: 'कीं गड़बड़ हुई' },
  none:    { en: 'Nothing here yet.', hi: 'अभी यहां कुछ नहीं।', hinglish: 'Abhi yahan kuch nahi.', gu: 'હજુ અહીં કંઈ નથી.', mr: 'अद्याप इथे काही नाही.', mwr: 'अजे अठे कीं कोनी।' },
  job:     { en: 'Job', hi: 'जॉब', hinglish: 'Job', gu: 'જોબ', mr: 'जॉब', mwr: 'जॉब' },

  // Event badge labels (keyed by the notify-set stage / event value).
  ev_enquiry:    { en: 'order received', hi: 'ऑर्डर मिला', hinglish: 'order received', gu: 'ઓર્ડર મળ્યો', mr: 'ऑर्डर मिळाला', mwr: 'ऑर्डर मिल्यो' },
  ev_jobsetter:  { en: 'design ready', hi: 'डिज़ाइन तैयार', hinglish: 'design ready', gu: 'ડિઝાઇન તૈયાર', mr: 'डिझाइन तयार', mwr: 'डिज़ाइन त्यार' },
  ev_production: { en: 'in production', hi: 'प्रोडक्शन में', hinglish: 'in production', gu: 'પ્રોડક્શનમાં', mr: 'प्रोडक्शनमध्ये', mwr: 'प्रोडक्शन मांय' },
  ev_qc:         { en: 'quality check', hi: 'क्वालिटी चेक', hinglish: 'quality check', gu: 'ક્વોલિટી ચેક', mr: 'क्वालिटी चेक', mwr: 'क्वालिटी चेक' },
  ev_dispatch:   { en: 'out for delivery', hi: 'डिलीवरी के लिए निकला', hinglish: 'out for delivery', gu: 'ડિલિવરી માટે નીકળ્યું', mr: 'डिलिव्हरीसाठी निघाले', mwr: 'डिलीवरी वास्ते निकळ्यो' },
  ev_delivered:  { en: 'delivered', hi: 'डिलीवर हुआ', hinglish: 'delivered', gu: 'ડિલિવર થયું', mr: 'डिलिव्हर झाले', mwr: 'डिलीवर हुयो' },
  ev_update:     { en: 'update', hi: 'अपडेट', hinglish: 'update', gu: 'અપડેટ', mr: 'अपडेट', mwr: 'अपडेट' },
};

// event value -> { key (i18n), tone (badge class) }. Aliases fold the various
// event strings the pipeline may emit onto the six customer-facing stages.
// Tones use only the four badge classes global.css defines (blue/green/red/amber).
const EVENT_META = {
  enquiry:       { key: 'ev_enquiry',    tone: 'badge-blue' },
  order:         { key: 'ev_enquiry',    tone: 'badge-blue' },
  order_received:{ key: 'ev_enquiry',    tone: 'badge-blue' },
  jobsetter:     { key: 'ev_jobsetter',  tone: 'badge-blue' },
  design_ready:  { key: 'ev_jobsetter',  tone: 'badge-blue' },
  design_approved:{ key: 'ev_jobsetter', tone: 'badge-blue' },
  production:    { key: 'ev_production',  tone: 'badge-amber' },
  in_production: { key: 'ev_production',  tone: 'badge-amber' },
  qc:            { key: 'ev_qc',          tone: 'badge-amber' },
  quality_check: { key: 'ev_qc',          tone: 'badge-amber' },
  dispatch:      { key: 'ev_dispatch',    tone: 'badge-blue' },
  out_for_delivery:{ key: 'ev_dispatch',  tone: 'badge-blue' },
  delivered:     { key: 'ev_delivered',   tone: 'badge-green' },
  delivery:      { key: 'ev_delivered',   tone: 'badge-green' },
};

function eventMeta(ev) {
  return EVENT_META[String(ev || '').toLowerCase()] || { key: 'ev_update', tone: 'badge-amber' };
}

// Phone -> WhatsApp digits: strip non-digits; a bare 10-digit number is Indian,
// so prepend the '91' country code. Anything already carrying a country code is
// left as-is.
function waDigits(phone) {
  let d = String(phone || '').replace(/\D/g, '');
  if (d.length === 10) d = '91' + d;
  return d;
}

export default function CustomerOutboxPage() {
  const t = useT(S);
  const [tab, setTab] = useState('pending');   // 'pending' | 'sent' | 'all'
  const [all, setAll] = useState(null);        // full customer_message list

  // Load everything once, then live-refresh on any tenantNotifications change.
  const load = () => messagingApi.outbox('all').then(setAll).catch(() => setAll([]));
  useEffect(() => {
    load();
    const u = onValue(ref(db, 'mpw/tenantNotifications'), () => load());
    return () => u();
  }, []);

  const rows = useMemo(() => {
    const list = (all || []).filter((m) => (m.type ? m.type === 'customer_message' : true));
    const byTab = tab === 'all' ? list : list.filter((m) => (m.status || 'pending') === tab);
    return byTab
      .slice()
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [all, tab]);

  const counts = useMemo(() => {
    const list = (all || []).filter((m) => (m.type ? m.type === 'customer_message' : true));
    return {
      pending: list.filter((m) => (m.status || 'pending') === 'pending').length,
      sent: list.filter((m) => m.status === 'sent').length,
      all: list.length,
    };
  }, [all]);

  const sendOne = async (m) => {
    const digits = waDigits(m.to);
    if (!digits) return showToast(t('noPhone'), 'error');
    // Open WhatsApp with the message pre-filled (new tab; wa.me routes to the app
    // on mobile and web.whatsapp.com on desktop).
    window.open('https://wa.me/' + digits + '?text=' + encodeURIComponent(m.body || ''), '_blank');
    try {
      await messagingApi.markSent(m.id);
      showToast(t('marked'), 'success');
    } catch (e) {
      showToast(e.response?.data?.error || t('failed'), 'error');
    }
    load();
  };

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>{t('title')}</h2>
      <div style={{ color: 'var(--text2)', fontSize: 13, marginBottom: 14 }}>{t('subtitle')}</div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {[
          ['pending', `${t('pending')} (${counts.pending})`],
          ['sent', `${t('sent')} (${counts.sent})`],
          ['all', `${t('all')} (${counts.all})`],
        ].map(([k, label]) => (
          <button key={k} className="btn btn-xs" onClick={() => setTab(k)}
            style={{
              background: tab === k ? 'var(--blue, #C05621)' : 'var(--surface2)',
              color: tab === k ? '#fff' : 'var(--text2)',
              border: 'none', borderRadius: 14,
            }}>{label}</button>
        ))}
      </div>

      {all === null && (
        <div className="card" style={{ textAlign: 'center', padding: 20, color: 'var(--text3)' }}>…</div>
      )}

      {all !== null && !rows.length && (
        <div className="card" style={{ textAlign: 'center', padding: 30, color: 'var(--text3)' }}>{t('none')}</div>
      )}

      {rows.map((m) => {
        const meta = eventMeta(m.event);
        const status = m.status || 'pending';
        const digits = waDigits(m.to);
        return (
          <div key={m.id} className="card" style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <b style={{ fontSize: 14 }}>{m.clientName || m.to || '—'}</b>
                  {m.to && <span style={{ color: 'var(--text2)', fontSize: 13 }}>· {m.to}</span>}
                  <span className={`badge ${meta.tone}`}>{t(meta.key)}</span>
                  {m.jobNo && <span className="badge" style={{ background: 'var(--surface2)', color: 'var(--text2)' }}>{t('job')} {m.jobNo}</span>}
                  {status === 'sent' && <span className="badge badge-green">{t('sent')}</span>}
                </div>
                <div style={{ color: 'var(--text2)', marginTop: 6, fontSize: 13, whiteSpace: 'pre-wrap' }}>{m.body}</div>
              </div>
              <div style={{ flexShrink: 0 }}>
                <button
                  className={status === 'pending' ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'}
                  onClick={() => sendOne(m)}
                  disabled={!digits}
                  title={!digits ? t('noPhone') : undefined}
                >
                  {status === 'pending' ? t('sendBtn') : t('resend')}
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
