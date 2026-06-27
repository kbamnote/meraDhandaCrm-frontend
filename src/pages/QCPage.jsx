/**
 * Quality Check — jobs awaiting QC (stage 'qc'). Pass (→ dispatch) or Reject
 * (→ back to production, steps reset) with a comment. Comment is required to
 * reject. Goes through the order engine (ordersApi.qc).
 */
import { useEffect, useMemo, useState } from 'react';
import { ref, onValue, db } from '../services/realtime';
import { ordersApi } from '../services/api';
import { useT } from '../i18n/LanguageContext';
import { showToast } from '../components/common/toast';

const S = {
  title:    { en: '🔍 Quality Check', hi: '🔍 क्वालिटी चेक', hinglish: '🔍 Quality Check', gu: '🔍 ક્વોલિટી ચેક', mr: '🔍 क्वालिटी चेक', mwr: '🔍 क्वालिटी चेक' },
  none:     { en: 'No jobs awaiting QC.', hi: 'QC के लिए कोई जॉब नहीं।', hinglish: 'QC ke liye koi job nahi.', gu: 'QC માટે કોઈ જોબ નથી.', mr: 'QC साठी जॉब नाही.', mwr: 'QC खातर कोई जॉब कोनी।' },
  comment:  { en: 'Comment (required to reject)', hi: 'कमेंट (रिजेक्ट के लिए ज़रूरी)', hinglish: 'Comment (reject ke liye zaroori)', gu: 'કોમેન્ટ (રિજેક્ટ માટે જરૂરી)', mr: 'कमेंट (रिजेक्टसाठी आवश्यक)', mwr: 'कमेंट (रिजेक्ट खातर जरूरी)' },
  pass:     { en: '✓ Pass', hi: '✓ पास', hinglish: '✓ Pass', gu: '✓ પાસ', mr: '✓ पास', mwr: '✓ पास' },
  reject:   { en: '✗ Reject', hi: '✗ रिजेक्ट', hinglish: '✗ Reject', gu: '✗ રિજેક્ટ', mr: '✗ रिजेक्ट', mwr: '✗ रिजेक्ट' },
  needComment:{ en: 'A comment is required to reject', hi: 'रिजेक्ट के लिए कमेंट ज़रूरी है', hinglish: 'Reject ke liye comment zaroori hai', gu: 'રિજેક્ટ માટે કોમેન્ટ જરૂરી', mr: 'रिजेक्टसाठी कमेंट आवश्यक', mwr: 'रिजेक्ट खातर कमेंट जरूरी' },
  passed:   { en: 'Passed → Dispatch', hi: 'पास → डिस्पैच', hinglish: 'Pass → Dispatch', gu: 'પાસ → ડિસ્પેચ', mr: 'पास → डिस्पॅच', mwr: 'पास → डिस्पैच' },
  rejected: { en: 'Rejected → Production', hi: 'रिजेक्ट → प्रोडक्शन', hinglish: 'Reject → Production', gu: 'રિજેક્ટ → પ્રોડક્શન', mr: 'रिजेक्ट → प्रोडक्शन', mwr: 'रिजेक्ट → प्रोडक्शन' },
  failed:   { en: 'Failed', hi: 'नहीं हुआ', hinglish: 'Fail hua', gu: 'નિષ્ફળ', mr: 'अयशस्वी', mwr: 'कोनी हुयो' },
};

export default function QCPage() {
  const t = useT(S);
  const [jobs, setJobs] = useState({});
  useEffect(() => { const u = onValue(ref(db, 'mpw/jobs'), (s) => setJobs(s.val() || {})); return () => u(); }, []);
  const pending = useMemo(() => Object.entries(jobs).map(([id, j]) => ({ ...j, id })).filter((j) => j.stage === 'qc'), [jobs]);

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>{t('title')}</h2>
      <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 14 }}>{pending.length} pending</div>
      {!pending.length && <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>{t('none')}</div>}
      {pending.map((job) => <QCCard key={job.id} job={job} t={t} />)}
    </div>
  );
}

function QCCard({ job, t }) {
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  const decide = async (result) => {
    if (result === 'reject' && !comment.trim()) return showToast(t('needComment'), 'error');
    setBusy(true);
    try {
      await ordersApi.qc(job.id, { result, comment: comment.trim() || null });
      showToast(result === 'pass' ? t('passed') : t('rejected'), 'success');
    } catch (e) { showToast(e.response?.data?.error || t('failed'), 'error'); }
    finally { setBusy(false); }
  };

  return (
    <div className="card" style={{ marginBottom: 10, borderLeft: '4px solid #CA8A04' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{job.jobNo}</span>
        {job.priority === 'urgent' && <span className="badge badge-amber">⚡</span>}
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>{job.clientName}</div>
      <div style={{ fontSize: 12, color: 'var(--text2)' }}>{job.work || '—'}{job.deliveryDate ? ` · 📅 ${job.deliveryDate}` : ''}</div>
      <input className="input" style={{ marginTop: 8 }} placeholder={t('comment')} value={comment} onChange={(e) => setComment(e.target.value)} />
      <div className="flex gap-2" style={{ marginTop: 8 }}>
        <button className="btn btn-success btn-sm" onClick={() => decide('pass')} disabled={busy}>{t('pass')}</button>
        <button className="btn btn-danger btn-sm" onClick={() => decide('reject')} disabled={busy}>{t('reject')}</button>
      </div>
    </div>
  );
}
