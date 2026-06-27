/**
 * HR — Leaves. Review staff leave requests and approve / reject them
 * (hrApi.leaveDecision, admin/hr only). Live via mpw/leaves.
 */
import { useEffect, useMemo, useState } from 'react';
import { ref, onValue, db } from '../services/realtime';
import { hrApi } from '../services/api';
import { useT } from '../i18n/LanguageContext';
import { showToast } from '../components/common/toast';

const S = {
  title:    { en: '🏖 Leaves', hi: '🏖 छुट्टियां', hinglish: '🏖 Leaves', gu: '🏖 રજાઓ', mr: '🏖 रजा', mwr: '🏖 छुट्टियां' },
  none:     { en: 'No leave requests.', hi: 'कोई छुट्टी अनुरोध नहीं।', hinglish: 'Koi leave request nahi.', gu: 'કોઈ રજા વિનંતી નથી.', mr: 'रजा विनंती नाही.', mwr: 'कोई छुट्टी अनुरोध कोनी।' },
  pending:  { en: 'Pending', hi: 'पेंडिंग', hinglish: 'Pending', gu: 'પેન્ડિંગ', mr: 'प्रलंबित', mwr: 'पेंडिंग' },
  approved: { en: 'Approved', hi: 'मंज़ूर', hinglish: 'Approved', gu: 'મંજૂર', mr: 'मंजूर', mwr: 'मंज़ूर' },
  rejected: { en: 'Rejected', hi: 'अस्वीकृत', hinglish: 'Rejected', gu: 'નકારેલ', mr: 'नाकारले', mwr: 'अस्वीकृत' },
  approve:  { en: '✓ Approve', hi: '✓ मंज़ूर', hinglish: '✓ Approve', gu: '✓ મંજૂર', mr: '✓ मंजूर', mwr: '✓ मंज़ूर' },
  reject:   { en: '✗ Reject', hi: '✗ अस्वीकार', hinglish: '✗ Reject', gu: '✗ નકારો', mr: '✗ नाकारा', mwr: '✗ अस्वीकार' },
  done:     { en: 'Done', hi: 'हो गया', hinglish: 'Done', gu: 'થઈ ગયું', mr: 'झाले', mwr: 'हो ग्यो' },
  failed:   { en: 'Failed', hi: 'नहीं हुआ', hinglish: 'Fail hua', gu: 'નિષ્ફળ', mr: 'अयशस्वी', mwr: 'कोनी हुयो' },
};
const TONE = { pending: 'badge-amber', approved: 'badge-green', rejected: 'badge-red' };

export default function HrLeavesPage() {
  const t = useT(S);
  const [leaves, setLeaves] = useState({});
  const [busy, setBusy] = useState(null);
  useEffect(() => { const u = onValue(ref(db, 'mpw/leaves'), (s) => setLeaves(s.val() || {})); return () => u(); }, []);

  const all = useMemo(() => Object.entries(leaves).map(([id, v]) => ({ ...v, id }))
    .sort((a, b) => (a.status === 'pending' ? -1 : 1) - (b.status === 'pending' ? -1 : 1) || (b.createdAt || 0) - (a.createdAt || 0)), [leaves]);

  const decide = async (id, status) => {
    setBusy(id);
    try { await hrApi.leaveDecision(id, { status }); showToast(t('done'), 'success'); }
    catch (e) { showToast(e.response?.data?.error || t('failed'), 'error'); }
    finally { setBusy(null); }
  };

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 14 }}>{t('title')}</h2>
      {!all.length && <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>{t('none')}</div>}
      {all.map((lv) => (
        <div key={lv.id} className="card" style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontWeight: 600 }}>{lv.username || lv.userId} <span className={`badge ${TONE[lv.status] || ''}`}>{t(lv.status || 'pending')}</span></div>
              <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 2 }}>{lv.type || 'leave'} · {lv.fromDate} → {lv.toDate}</div>
              {lv.reason && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{lv.reason}</div>}
            </div>
            {lv.status === 'pending' && (
              <div className="flex gap-2" style={{ alignItems: 'center' }}>
                <button className="btn btn-success btn-sm" onClick={() => decide(lv.id, 'approved')} disabled={busy === lv.id}>{t('approve')}</button>
                <button className="btn btn-danger btn-sm" onClick={() => decide(lv.id, 'rejected')} disabled={busy === lv.id}>{t('reject')}</button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
