/**
 * Job Setter — jobs that finished design and are waiting at stage 'jobsetter'.
 * Each pending job shows the work + who designed it, and a "Select Production
 * Type" button that opens the production-type grid (AssignProductionModal) → the
 * job is sent to production and routed to that type's assigned operator. The
 * Completed tab shows jobs already sent on (production and beyond).
 */
import { useEffect, useMemo, useState } from 'react';
import { ref, onValue, db } from '../services/realtime';
import AssignProductionModal from '../components/common/AssignProductionModal';
import { useT } from '../i18n/LanguageContext';

const S = {
  title:        { en: 'Job Setter', hi: 'जॉब सेटर', hinglish: 'Job Setter', gu: 'જોબ સેટર', mr: 'जॉब सेटर', mwr: 'जॉब सेटर' },
  pendingCount: { en: 'pending', hi: 'बाकी', hinglish: 'pending', gu: 'બાકી', mr: 'प्रलंबित', mwr: 'बाकी' },
  pending:      { en: 'Pending', hi: 'बाकी', hinglish: 'Pending', gu: 'બાકી', mr: 'प्रलंबित', mwr: 'बाकी' },
  completed:    { en: 'Completed', hi: 'पूर्ण', hinglish: 'Completed', gu: 'પૂર્ણ', mr: 'पूर्ण', mwr: 'पूरो' },
  designBy:     { en: 'Design by', hi: 'डिज़ाइन:', hinglish: 'Design by', gu: 'ડિઝાઇન:', mr: 'डिझाइन:', mwr: 'डिज़ाइन:' },
  delivery:     { en: 'Delivery', hi: 'डिलीवरी', hinglish: 'Delivery', gu: 'ડિલિવરી', mr: 'डिलिव्हरी', mwr: 'डिलीवरी' },
  selectType:   { en: 'Select Production Type', hi: 'प्रोडक्शन टाइप चुनें', hinglish: 'Select Production Type', gu: 'પ્રોડક્શન ટાઇપ પસંદ કરો', mr: 'प्रोडक्शन प्रकार निवडा', mwr: 'प्रोडक्शन टाइप चुणो' },
  jobSetter:    { en: 'Job Setter', hi: 'जॉब सेटर', hinglish: 'Job Setter', gu: 'જોબ સેટર', mr: 'जॉब सेटर', mwr: 'जॉब सेटर' },
  nonePending:  { en: 'No jobs waiting for production.', hi: 'प्रोडक्शन के लिए कोई जॉब नहीं।', hinglish: 'Production ke liye koi job nahi.', gu: 'પ્રોડક્શન માટે કોઈ જોબ નથી.', mr: 'प्रोडक्शनसाठी जॉब नाही.', mwr: 'प्रोडक्शन खातर कोई जॉब कोनी।' },
  noneCompleted:{ en: 'No jobs sent to production yet.', hi: 'अभी तक प्रोडक्शन में कोई जॉब नहीं।', hinglish: 'Abhi tak production mein koi job nahi.', gu: 'હજુ સુધી પ્રોડક્શનમાં કોઈ જોબ નથી.', mr: 'अद्याप प्रोडक्शनमध्ये जॉब नाही.', mwr: 'अजे प्रोडक्शन में कोई जॉब कोनी।' },
};

export default function JobSetterPage() {
  const t = useT(S);
  const [jobs, setJobs] = useState({});
  const [tab, setTab] = useState('pending');     // 'pending' | 'completed'
  const [assignJob, setAssignJob] = useState(null);

  useEffect(() => {
    const u = onValue(ref(db, 'mpw/jobs'), (snap) => setJobs(snap.val() || {}));
    return () => u();
  }, []);

  const all = useMemo(
    () => Object.entries(jobs).map(([id, j]) => ({ ...j, id })).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)),
    [jobs]
  );
  const pending = all.filter((j) => j.stage === 'jobsetter');
  const completed = all.filter((j) => ['production', 'qc', 'dispatch', 'delivered'].includes(j.stage));
  const list = tab === 'pending' ? pending : completed;

  return (
    <div data-legacy-id="page-jobsetter">
      <div className="mb-4">
        <h2 style={{ fontSize: 22, fontWeight: 700 }}>🛠 {t('title')}</h2>
        <div style={{ fontSize: 13, color: 'var(--text2)' }}>{pending.length} {t('pendingCount')}</div>
      </div>

      <div className="flex gap-4 mb-4" style={{ borderBottom: '1px solid var(--border)' }}>
        {['pending', 'completed'].map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: '8px 4px',
              borderBottom: tab === k ? '2px solid var(--blue)' : '2px solid transparent',
              color: tab === k ? 'var(--blue)' : 'var(--text2)', fontWeight: tab === k ? 700 : 500, fontSize: 15,
            }}
          >
            {k === 'pending' ? t('pending') : t('completed')}
          </button>
        ))}
      </div>

      {!list.length ? (
        <div className="card" style={{ textAlign: 'center', color: 'var(--text3)', padding: 40 }}>
          {tab === 'pending' ? t('nonePending') : t('noneCompleted')}
        </div>
      ) : (
        list.map((job) => (
          <div key={job.id} className="card mb-3">
            <div className="flex items-start justify-between">
              <div style={{ flex: 1, paddingRight: 12 }}>
                <div style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text3)' }}>{job.jobNo}</div>
                <div style={{ fontSize: 18, fontWeight: 600, marginTop: 2 }}>{job.clientName || '—'}</div>
                {job.work ? (
                  <div style={{ whiteSpace: 'pre-wrap', color: 'var(--text2)', marginTop: 6, lineHeight: 1.4 }}>{job.work}</div>
                ) : null}
                {job.designerName ? (
                  <span className="badge" style={{ marginTop: 10, display: 'inline-block', background: '#EDE9FE', color: '#6D28D9' }}>
                    {t('designBy')} {job.designerName}
                  </span>
                ) : null}
                {job.deliveryDate ? (
                  <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 10 }}>
                    {t('delivery')}: {job.deliveryDate}{job.deliveryTime ? ` at ${job.deliveryTime}` : ''}
                  </div>
                ) : null}
              </div>
              <span className="badge badge-amber">{t('jobSetter')}</span>
            </div>

            {tab === 'pending' ? (
              <button className="btn btn-primary" style={{ width: '100%', marginTop: 14 }} onClick={() => setAssignJob(job)}>
                {t('selectType')} →
              </button>
            ) : (
              <div style={{ marginTop: 10, fontSize: 13, color: 'var(--text2)' }}>
                → {job.stage}{job.productionType ? ` (${job.productionType})` : ''}
              </div>
            )}
          </div>
        ))
      )}

      {assignJob && (
        <AssignProductionModal
          jobId={assignJob.id}
          jobNo={assignJob.jobNo}
          onClose={() => setAssignJob(null)}
          onDone={() => setAssignJob(null)}
        />
      )}
    </div>
  );
}
