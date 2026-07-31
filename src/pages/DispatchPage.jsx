/**
 * Dispatch — jobs ready to deliver (stage 'dispatch'). The card gates on a bill
 * (job.billNumber, stamped when an invoice is created here). Once billed, the
 * "Mark Dispatched & Delivered" button opens a DispatchConfirmModal where the
 * dispatcher picks a dispatch mode + carrier (le jane wale) details and confirms.
 * On confirm the backend sets stage='delivered', auto-stamps the timestamp, saves
 * dispatchInfo, and queues the customer "delivered" message + Google review link.
 * Also lists recently delivered jobs.
 */
import { useEffect, useMemo, useState } from 'react';
import { ref, onValue, db } from '../services/realtime';
import { ordersApi } from '../services/api';
import { useT } from '../i18n/LanguageContext';
import { showToast } from '../components/common/toast';
import CreateInvoiceFlow from '../components/common/CreateInvoiceFlow';

const S = {
  title:      { en: '🚚 Dispatch', hi: '🚚 डिस्पैच', hinglish: '🚚 Dispatch', gu: '🚚 ડિસ્પેચ', mr: '🚚 डिस्पॅच', mwr: '🚚 डिस्पैच' },
  none:       { en: 'No jobs ready for dispatch.', hi: 'डिस्पैच के लिए कोई जॉब नहीं।', hinglish: 'Dispatch ke liye koi job nahi.', gu: 'ડિસ્પેચ માટે કોઈ જોબ નથી.', mr: 'डिस्पॅचसाठी जॉब नाही.', mwr: 'डिस्पैच खातर कोई जॉब कोनी।' },
  vehicle:    { en: 'Vehicle number', hi: 'गाड़ी नंबर', hinglish: 'Vehicle number', gu: 'વાહન નંબર', mr: 'वाहन नंबर', mwr: 'गाड़ी नंबर' },
  delivered:  { en: 'Delivered ✓', hi: 'डिलीवर हो गया ✓', hinglish: 'Delivered ✓', gu: 'ડિલિવર્ડ ✓', mr: 'डिलिव्हर्ड ✓', mwr: 'डिलीवर हो ग्यो ✓' },
  recent:     { en: 'Recently delivered', hi: 'हाल में डिलीवर हुए', hinglish: 'Recently delivered', gu: 'તાજેતરમાં ડિલિવર્ડ', mr: 'अलीकडे डिलिव्हर्ड', mwr: 'हाल मांय डिलीवर हुया' },
  failed:     { en: 'Failed', hi: 'नहीं हुआ', hinglish: 'Fail hua', gu: 'નિષ્ફળ', mr: 'अयशस्वी', mwr: 'कोनी हुयो' },
  bill:       { en: 'Bill', hi: 'बिल', hinglish: 'Bill', gu: 'બિલ', mr: 'बिल', mwr: 'बिल' },
  billAuto:   { en: 'Auto-fills when invoice is created', hi: 'इनवॉइस बनने पर अपने-आप भर जाएगा', hinglish: 'Invoice banne par auto-fill ho jayega', gu: 'ઇન્વોઇસ બને ત્યારે આપમેળે ભરાશે', mr: 'इनव्हॉइस तयार झाल्यावर आपोआप भरले जाईल', mwr: 'इनवॉइस बणतां ही खुद-ब-खुद भर जावैलो' },
  createInv:  { en: '📝 Create Invoice', hi: '📝 इनवॉइस बनाएं', hinglish: '📝 Invoice banayein', gu: '📝 ઇન્વોઇસ બનાવો', mr: '📝 इनव्हॉइस तयार करा', mwr: '📝 इनवॉइस बणावो' },
  gstInvoice: { en: 'GST Invoice / Tax Bill', hi: 'GST इनवॉइस / टैक्स बिल', hinglish: 'GST Invoice / Tax Bill', gu: 'GST ઇન્વોઇસ / ટેક્સ બિલ', mr: 'GST इनव्हॉइस / टॅक्स बिल', mwr: 'GST इनवॉइस / टैक्स बिल' },
  markBtn:    { en: '🚚 Mark Dispatched & Delivered ✓', hi: '🚚 डिस्पैच & डिलीवर मार्क करें ✓', hinglish: '🚚 Mark Dispatched & Delivered ✓', gu: '🚚 ડિસ્પેચ & ડિલિવર્ડ માર્ક કરો ✓', mr: '🚚 डिस्पॅच & डिलिव्हर्ड मार्क करा ✓', mwr: '🚚 डिस्पैच & डिलीवर मार्क करो ✓' },
  lockedBtn:  { en: '🔒 Create Invoice / Proforma / DM First', hi: '🔒 पहले इनवॉइस / प्रोफॉर्मा / DM बनाएं', hinglish: '🔒 Pehle Invoice / Proforma / DM banayein', gu: '🔒 પહેલા ઇન્વોઇસ / પ્રોફોર્મા / DM બનાવો', mr: '🔒 आधी इनव्हॉइस / प्रोफॉर्मा / DM तयार करा', mwr: '🔒 पैलां इनवॉइस / प्रोफॉर्मा / DM बणावो' },
  needBill:   { en: 'Create the invoice first', hi: 'पहले इनवॉइस बनाएं', hinglish: 'Pehle invoice banayein', gu: 'પહેલા ઇન્વોઇસ બનાવો', mr: 'आधी इनव्हॉइस तयार करा', mwr: 'पैलां इनवॉइस बणावो' },

  // ── Dispatch confirmation modal ─────────────────────────────────────────────
  confirmTitle:  { en: '🚚 Dispatch Confirmation', hi: '🚚 डिस्पैच पुष्टि', hinglish: '🚚 Dispatch Confirmation', gu: '🚚 ડિસ્પેચ પુષ્ટિ', mr: '🚚 डिस्पॅच पुष्टी', mwr: '🚚 डिस्पैच पुष्टि' },
  dispatchMode:  { en: 'Dispatch Mode *', hi: 'डिस्पैच मोड *', hinglish: 'Dispatch Mode *', gu: 'ડિસ્પેચ મોડ *', mr: 'डिस्पॅच मोड *', mwr: 'डिस्पैच मोड *' },
  // mode cards
  modeSelfT:     { en: 'Self Delivery', hi: 'खुद डिलीवरी', hinglish: 'Self Delivery', gu: 'સેલ્ફ ડિલિવરી', mr: 'स्वतः डिलिव्हरी', mwr: 'खुद डिलीवरी' },
  modeSelfD:     { en: 'Apna staff', hi: 'अपना स्टाफ', hinglish: 'Apna staff', gu: 'આપણો સ્ટાફ', mr: 'आपला स्टाफ', mwr: 'आपणो स्टाफ' },
  modePorterT:   { en: 'Porter', hi: 'पोर्टर', hinglish: 'Porter', gu: 'પોર્ટર', mr: 'पोर्टर', mwr: 'पोर्टर' },
  modePorterD:   { en: 'Porter app', hi: 'पोर्टर ऐप', hinglish: 'Porter app', gu: 'પોર્ટર એપ', mr: 'पोर्टर अ‍ॅप', mwr: 'पोर्टर ऐप' },
  modePrivateT:  { en: 'Private Vehicle', hi: 'प्राइवेट गाड़ी', hinglish: 'Private Vehicle', gu: 'પ્રાઇવેટ વાહન', mr: 'प्रायव्हेट वाहन', mwr: 'प्राइवेट गाड़ी' },
  modePrivateD:  { en: 'Private gaadi', hi: 'प्राइवेट गाड़ी', hinglish: 'Private gaadi', gu: 'પ્રાઇવેટ ગાડી', mr: 'प्रायव्हेट गाडी', mwr: 'प्राइवेट गाड़ी' },
  modeCourierT:  { en: 'Courier', hi: 'कूरियर', hinglish: 'Courier', gu: 'કુરિયર', mr: 'कुरियर', mwr: 'कूरियर' },
  modeCourierD:  { en: 'DTDC/Blue Dart etc', hi: 'DTDC/Blue Dart आदि', hinglish: 'DTDC/Blue Dart etc', gu: 'DTDC/Blue Dart વગેરે', mr: 'DTDC/Blue Dart इ.', mwr: 'DTDC/Blue Dart वगैरह' },
  modePickupT:   { en: 'Customer Pickup', hi: 'ग्राहक पिकअप', hinglish: 'Customer Pickup', gu: 'ગ્રાહક પિકઅપ', mr: 'ग्राहक पिकअप', mwr: 'ग्राहक पिकअप' },
  modePickupD:   { en: 'Khud aaya', hi: 'खुद आया', hinglish: 'Khud aaya', gu: 'ખુદ આવ્યો', mr: 'स्वतः आला', mwr: 'खुद आयो' },
  // carrier
  carrierSec:    { en: 'Carrier / Le jane wale details', hi: 'ले जाने वाले की जानकारी', hinglish: 'Le jane wale ki details', gu: 'લઈ જનારની વિગત', mr: 'नेणाऱ्याची माहिती', mwr: 'ले जावण वाळे री जाणकारी' },
  carrierName:   { en: 'Name *', hi: 'नाम *', hinglish: 'Naam *', gu: 'નામ *', mr: 'नाव *', mwr: 'नाम *' },
  carrierNamePh: { en: 'Le jane wale ka naam', hi: 'ले जाने वाले का नाम', hinglish: 'Le jane wale ka naam', gu: 'લઈ જનારનું નામ', mr: 'नेणाऱ्याचे नाव', mwr: 'ले जावण वाळे रो नाम' },
  carrierMobile: { en: 'Mobile *', hi: 'मोबाइल *', hinglish: 'Mobile *', gu: 'મોબાઇલ *', mr: 'मोबाइल *', mwr: 'मोबाइल *' },
  vehiclePh:     { en: 'e.g. MH12AB1234', hi: 'जैसे MH12AB1234', hinglish: 'e.g. MH12AB1234', gu: 'દા.ત. MH12AB1234', mr: 'उदा. MH12AB1234', mwr: 'जियां MH12AB1234' },
  // date/time
  dateTimeSec:   { en: 'Date & Time (auto-locked)', hi: 'दिनांक व समय (ऑटो-लॉक)', hinglish: 'Date & Time (auto-locked)', gu: 'તારીખ અને સમય (ઓટો-લોક)', mr: 'दिनांक व वेळ (ऑटो-लॉक)', mwr: 'तारीख अर टेम (ऑटो-लॉक)' },
  dateTimeNote:  { en: '🔒 System auto-captures — cannot be changed', hi: '🔒 सिस्टम अपने-आप कैप्चर करता है — बदला नहीं जा सकता', hinglish: '🔒 System auto-capture karta hai — change nahi kar sakte', gu: '🔒 સિસ્ટમ આપમેળે કૅપ્ચર કરે છે — બદલી શકાતું નથી', mr: '🔒 सिस्टम आपोआप कॅप्चर करते — बदलता येत नाही', mwr: '🔒 सिस्टम खुद-ब-खुद कैप्चर करै — बदल्यो कोनी सकै' },
  // notes / delivering to
  notesLabel:    { en: 'Notes (optional)', hi: 'नोट्स (वैकल्पिक)', hinglish: 'Notes (optional)', gu: 'નોંધ (વૈકલ્પિક)', mr: 'नोट्स (ऐच्छिक)', mwr: 'नोट्स (मरजी)' },
  notesPh:       { en: 'Remarks…', hi: 'टिप्पणी…', hinglish: 'Remarks…', gu: 'ટિપ્પણી…', mr: 'टिप्पणी…', mwr: 'टिप्पणी…' },
  deliveringTo:  { en: '📍 Delivering To:', hi: '📍 डिलीवरी:', hinglish: '📍 Delivering To:', gu: '📍 ડિલિવરી:', mr: '📍 डिलिव्हरी:', mwr: '📍 डिलीवरी:' },
  // footer / validation
  cancel:        { en: 'Cancel', hi: 'रद्द करें', hinglish: 'Cancel', gu: 'રદ કરો', mr: 'रद्द करा', mwr: 'रद्द करो' },
  confirmBtn:    { en: '✅ Confirm Dispatch', hi: '✅ डिस्पैच पुष्टि करें', hinglish: '✅ Confirm Dispatch', gu: '✅ ડિસ્પેચ પુષ્ટિ કરો', mr: '✅ डिस्पॅच पुष्टी करा', mwr: '✅ डिस्पैच पुष्टि करो' },
  needMode:      { en: 'Select a dispatch mode', hi: 'डिस्पैच मोड चुनें', hinglish: 'Dispatch mode chunein', gu: 'ડિસ્પેચ મોડ પસંદ કરો', mr: 'डिस्पॅच मोड निवडा', mwr: 'डिस्पैच मोड चुणो' },
  needName:      { en: 'Carrier name is required', hi: 'ले जाने वाले का नाम ज़रूरी है', hinglish: 'Le jane wale ka naam zaroori hai', gu: 'લઈ જનારનું નામ જરૂરી', mr: 'नेणाऱ्याचे नाव आवश्यक', mwr: 'ले जावण वाळे रो नाम जरूरी' },
  needMobile:    { en: 'Carrier mobile is required', hi: 'ले जाने वाले का मोबाइल ज़रूरी है', hinglish: 'Le jane wale ka mobile zaroori hai', gu: 'લઈ જનારનો મોબાઇલ જરૂરી', mr: 'नेणाऱ्याचा मोबाइल आवश्यक', mwr: 'ले जावण वाळे रो मोबाइल जरूरी' },
};

const MODE_CARDS = [
  { mode: 'self_delivery',   icon: '🛵', titleKey: 'modeSelfT',    descKey: 'modeSelfD' },
  { mode: 'porter',          icon: '📦', titleKey: 'modePorterT',  descKey: 'modePorterD' },
  { mode: 'private_vehicle', icon: '🚙', titleKey: 'modePrivateT', descKey: 'modePrivateD' },
  { mode: 'courier',         icon: '📮', titleKey: 'modeCourierT', descKey: 'modeCourierD' },
  { mode: 'customer_pickup', icon: '🧍', titleKey: 'modePickupT',  descKey: 'modePickupD' },
];

export default function DispatchPage() {
  const t = useT(S);
  const [jobs, setJobs] = useState({});
  useEffect(() => { const u = onValue(ref(db, 'mpw/jobs'), (s) => setJobs(s.val() || {})); return () => u(); }, []);
  const all = useMemo(() => Object.entries(jobs).map(([id, j]) => ({ ...j, id })), [jobs]);
  const pending = all.filter((j) => j.stage === 'dispatch');
  const delivered = all.filter((j) => j.stage === 'delivered').sort((a, b) => (b.deliveredAt || 0) - (a.deliveredAt || 0)).slice(0, 10);

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>{t('title')}</h2>
      <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 14 }}>{pending.length} pending</div>
      {!pending.length && <div className="card" style={{ textAlign: 'center', padding: 30, color: 'var(--text3)' }}>{t('none')}</div>}
      {pending.map((job) => <DispatchCard key={job.id} job={job} t={t} />)}

      {!!delivered.length && (
        <>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.05em', margin: '20px 0 8px' }}>{t('recent')}</div>
          {delivered.map((job) => (
            <div key={job.id} className="card" style={{ marginBottom: 6, opacity: 0.85 }}>
              <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{job.jobNo}</span> · {job.clientName}
              <span className="badge badge-green" style={{ marginLeft: 8 }}>{t('delivered')}</span>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                {job.dispatchInfo?.receiverName ? `→ ${job.dispatchInfo.receiverName}` : ''}{job.dispatchInfo?.vehicleNumber ? ` · 🚚 ${job.dispatchInfo.vehicleNumber}` : ''}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function DispatchCard({ job, t }) {
  // The bill number is stamped server-side when an invoice is created from this
  // card (job.billNumber, shown read-only and updated live). Receiver / vehicle
  // details are captured in the DispatchConfirmModal on confirm — not inline.
  const [gstInvoice, setGstInvoice] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const openConfirm = () => {
    if (!job.billNumber) return showToast(t('needBill'), 'error'); // must bill before dispatch
    setShowConfirm(true);
  };

  const fieldLabel = { fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 4, display: 'block' };

  return (
    <div className="card" style={{ marginBottom: 12, borderLeft: '4px solid #3B82F6' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div>
          <div style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text3)' }}>{job.jobNo}</div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>{job.clientName}</div>
          {job.clientMobile && <div style={{ fontSize: 13, color: 'var(--text2)' }}>{job.clientMobile}</div>}
          {job.work && <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 4 }}>{job.work}</div>}
        </div>
        <span className="badge" style={{ background: '#D1FAE5', color: '#065F46' }}>{t('title').replace('🚚 ', '')}</span>
      </div>

      <div style={{ marginTop: 12, border: '1px solid var(--border)', borderRadius: 10, padding: 12, background: 'var(--surface2)' }}>
        <label style={fieldLabel}>{t('bill')}</label>
        {job.billNumber ? (
          <div style={{ fontFamily: 'monospace', fontWeight: 600 }}>{job.billNumber}</div>
        ) : (
          <div style={{ fontStyle: 'italic', color: 'var(--text3)', fontSize: 13 }}>{t('billAuto')}</div>
        )}
        <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => setShowInvoice(true)}>{t('createInv')}</button>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 13, cursor: 'pointer' }}>
          <input type="checkbox" checked={gstInvoice} onChange={(e) => setGstInvoice(e.target.checked)} style={{ width: 16, height: 16 }} />
          {t('gstInvoice')}
        </label>
      </div>

      <button className="btn btn-primary" style={{ width: '100%', marginTop: 14 }} onClick={openConfirm} disabled={!job.billNumber}>
        {job.billNumber ? t('markBtn') : t('lockedBtn')}
      </button>

      {showInvoice && (
        <CreateInvoiceFlow job={job} onClose={() => setShowInvoice(false)} onCreated={() => setShowInvoice(false)} />
      )}
      {showConfirm && (
        <DispatchConfirmModal
          job={job}
          gstInvoice={gstInvoice}
          onClose={() => setShowConfirm(false)}
          onDone={() => setShowConfirm(false)}
        />
      )}
    </div>
  );
}

function DispatchConfirmModal({ job, gstInvoice, onClose, onDone }) {
  const t = useT(S);
  const [mode, setMode] = useState('');
  const [carrierName, setCarrierName] = useState('');
  const [carrierMobile, setCarrierMobile] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  // Locked capture time — display only; the server stamps the real timestamp.
  const now = useMemo(() => new Date(), []);
  const dateStr = now.toLocaleDateString('en-GB'); // dd/mm/yyyy
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

  const confirm = async () => {
    if (!mode) return showToast(t('needMode'), 'error');
    if (!carrierName.trim()) return showToast(t('needName'), 'error');
    if (!carrierMobile.trim()) return showToast(t('needMobile'), 'error');
    setBusy(true);
    try {
      await ordersApi.dispatch(job.id, {
        dispatchMode: mode,
        receiverName: carrierName.trim(),     // carrier name → server 'receiverName'
        receiverNumber: carrierMobile.trim(),
        vehicleNumber: vehicleNumber.trim(),
        notes: notes.trim(),
        billNumber: job.billNumber || '',
        gstInvoice,
      });
      showToast(t('delivered'), 'success');
      onDone();
    } catch (e) {
      showToast(e.response?.data?.error || t('failed'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const fieldLabel = { fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 4, display: 'block' };
  const sectionLabel = { fontSize: 12, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.04em', margin: '16px 0 8px', display: 'block' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div className="card" style={{ maxWidth: 560, width: '100%', maxHeight: '92vh', overflow: 'auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 8 }}>
          <h3 style={{ margin: 0 }}>{t('confirmTitle')}</h3>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 2 }}>
            <span style={{ fontFamily: 'monospace' }}>{job.jobNo}</span> — {job.work}
          </div>
        </div>

        {/* Dispatch mode */}
        <label style={sectionLabel}>{t('dispatchMode')}</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
          {MODE_CARDS.map((c) => {
            const active = mode === c.mode;
            return (
              <button
                key={c.mode}
                type="button"
                onClick={() => setMode(c.mode)}
                style={{
                  textAlign: 'left', cursor: 'pointer', padding: 10, borderRadius: 10,
                  border: active ? '2px solid var(--primary, #3B82F6)' : '1px solid var(--border)',
                  background: active ? 'var(--primary-soft, #EFF6FF)' : 'var(--surface2)',
                  display: 'flex', gap: 10, alignItems: 'center',
                }}
              >
                <span style={{ fontSize: 22, lineHeight: 1 }}>{c.icon}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontWeight: 700, fontSize: 13.5 }}>{t(c.titleKey)}</span>
                  <span style={{ display: 'block', fontSize: 11.5, color: 'var(--text2)', marginTop: 1 }}>{t(c.descKey)}</span>
                </span>
              </button>
            );
          })}
        </div>

        {/* Carrier details */}
        <label style={sectionLabel}>{t('carrierSec')}</label>
        <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 180 }}>
            <label style={fieldLabel}>{t('carrierName')}</label>
            <input className="input" placeholder={t('carrierNamePh')} value={carrierName} onChange={(e) => setCarrierName(e.target.value)} />
          </div>
          <div style={{ flex: 1, minWidth: 160 }}>
            <label style={fieldLabel}>{t('carrierMobile')}</label>
            <input className="input" type="tel" inputMode="numeric" maxLength={10} value={carrierMobile} onChange={(e) => setCarrierMobile(e.target.value.replace(/\D/g, ''))} />
          </div>
        </div>
        <div style={{ marginTop: 10 }}>
          <label style={fieldLabel}>{t('vehicle')}</label>
          <input className="input" placeholder={t('vehiclePh')} value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)} />
        </div>

        {/* Date & time — auto-locked */}
        <label style={sectionLabel}>{t('dateTimeSec')}</label>
        <div className="flex gap-2">
          <input className="input" value={dateStr} disabled readOnly style={{ flex: 1 }} />
          <input className="input" value={timeStr} disabled readOnly style={{ flex: 1 }} />
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 6 }}>{t('dateTimeNote')}</div>

        {/* Notes */}
        <label style={sectionLabel}>{t('notesLabel')}</label>
        <textarea className="input" rows={2} placeholder={t('notesPh')} value={notes} onChange={(e) => setNotes(e.target.value)} style={{ resize: 'vertical' }} />

        {/* Delivering to */}
        <div style={{ marginTop: 14, padding: 10, borderRadius: 10, background: 'var(--surface2)', border: '1px solid var(--border)', fontSize: 13 }}>
          <span style={{ fontWeight: 700 }}>{t('deliveringTo')}</span>{' '}
          {job.clientName}
          {job.clientMobile ? <span style={{ color: 'var(--text2)' }}> · 📞 {job.clientMobile}</span> : null}
        </div>

        {/* Footer */}
        <div className="flex gap-2" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose} disabled={busy}>{t('cancel')}</button>
          <button className="btn btn-primary" onClick={confirm} disabled={busy}>{busy ? '…' : t('confirmBtn')}</button>
        </div>
      </div>
    </div>
  );
}
