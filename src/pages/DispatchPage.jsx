/**
 * Dispatch — jobs ready to deliver (stage 'dispatch'). Capture receiver name /
 * number / vehicle and mark delivered. On delivery the backend queues the
 * customer "delivered" message + Google review link (sent by the messaging
 * module). Also lists recently delivered jobs.
 */
import { useEffect, useMemo, useState } from 'react';
import { ref, onValue, db } from '../services/realtime';
import { ordersApi } from '../services/api';
import { useT } from '../i18n/LanguageContext';
import { showToast } from '../components/common/toast';

const S = {
  title:      { en: '🚚 Dispatch', hi: '🚚 डिस्पैच', hinglish: '🚚 Dispatch', gu: '🚚 ડિસ્પેચ', mr: '🚚 डिस्पॅच', mwr: '🚚 डिस्पैच' },
  none:       { en: 'No jobs ready for dispatch.', hi: 'डिस्पैच के लिए कोई जॉब नहीं।', hinglish: 'Dispatch ke liye koi job nahi.', gu: 'ડિસ્પેચ માટે કોઈ જોબ નથી.', mr: 'डिस्पॅचसाठी जॉब नाही.', mwr: 'डिस्पैच खातर कोई जॉब कोनी।' },
  receiver:   { en: 'Receiver name *', hi: 'रिसीवर का नाम *', hinglish: 'Receiver ka naam *', gu: 'રિસીવરનું નામ *', mr: 'रिसीव्हरचे नाव *', mwr: 'रिसीवर रो नाम *' },
  number:     { en: 'Receiver number', hi: 'रिसीवर नंबर', hinglish: 'Receiver number', gu: 'રિસીવર નંબર', mr: 'रिसीव्हर नंबर', mwr: 'रिसीवर नंबर' },
  vehicle:    { en: 'Vehicle number', hi: 'गाड़ी नंबर', hinglish: 'Vehicle number', gu: 'વાહન નંબર', mr: 'वाहन नंबर', mwr: 'गाड़ी नंबर' },
  deliver:    { en: '✓ Mark delivered', hi: '✓ डिलीवर मार्क करें', hinglish: '✓ Delivered mark karein', gu: '✓ ડિલિવર્ડ માર્ક કરો', mr: '✓ डिलिव्हर्ड मार्क करा', mwr: '✓ डिलीवर मार्क करो' },
  needName:   { en: 'Receiver name is required', hi: 'रिसीवर का नाम ज़रूरी है', hinglish: 'Receiver ka naam zaroori hai', gu: 'રિસીવરનું નામ જરૂરી', mr: 'रिसीव्हरचे नाव आवश्यक', mwr: 'रिसीवर रो नाम जरूरी' },
  delivered:  { en: 'Delivered ✓', hi: 'डिलीवर हो गया ✓', hinglish: 'Delivered ✓', gu: 'ડિલિવર્ડ ✓', mr: 'डिलिव्हर्ड ✓', mwr: 'डिलीवर हो ग्यो ✓' },
  recent:     { en: 'Recently delivered', hi: 'हाल में डिलीवर हुए', hinglish: 'Recently delivered', gu: 'તાજેતરમાં ડિલિવર્ડ', mr: 'अलीकडे डिलिव्हर्ड', mwr: 'हाल मांय डिलीवर हुया' },
  failed:     { en: 'Failed', hi: 'नहीं हुआ', hinglish: 'Fail hua', gu: 'નિષ્ફળ', mr: 'अयशस्वी', mwr: 'कोनी हुयो' },
};

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
  const [form, setForm] = useState({ receiverName: '', receiverNumber: '', vehicleNumber: '' });
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const deliver = async () => {
    if (!form.receiverName.trim()) return showToast(t('needName'), 'error');
    setBusy(true);
    try {
      await ordersApi.dispatch(job.id, form);
      showToast(t('delivered'), 'success');
    } catch (e) { showToast(e.response?.data?.error || t('failed'), 'error'); }
    finally { setBusy(false); }
  };

  return (
    <div className="card" style={{ marginBottom: 10, borderLeft: '4px solid #3B82F6' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{job.jobNo}</span>
        <span style={{ fontSize: 14, fontWeight: 600 }}>{job.clientName}</span>
        {job.clientMobile && <span style={{ fontSize: 12, color: 'var(--text2)' }}>📱 {job.clientMobile}</span>}
      </div>
      <div className="flex gap-2" style={{ marginTop: 8, flexWrap: 'wrap' }}>
        <input className="input" style={{ flex: 1, minWidth: 140 }} placeholder={t('receiver')} value={form.receiverName} onChange={(e) => set('receiverName', e.target.value)} />
        <input className="input" style={{ flex: 1, minWidth: 120 }} placeholder={t('number')} value={form.receiverNumber} onChange={(e) => set('receiverNumber', e.target.value)} />
        <input className="input" style={{ flex: 1, minWidth: 120 }} placeholder={t('vehicle')} value={form.vehicleNumber} onChange={(e) => set('vehicleNumber', e.target.value)} />
      </div>
      <button className="btn btn-primary btn-sm" style={{ marginTop: 8 }} onClick={deliver} disabled={busy}>{t('deliver')}</button>
    </div>
  );
}
