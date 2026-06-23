/**
 * Assign to Production — lists jobs not yet in production and lets an
 * admin/superadmin/owner push them into the production queue.
 */
import { useEffect, useMemo, useState } from 'react';
import { dbApi } from '../services/api';
import { ref, onValue, db } from '../services/realtime';
import { useAuth } from '../context/AuthContext';
import { useT } from '../i18n/LanguageContext';
import { showToast } from '../components/common/toast';

const S = {
  assignToProduction: { en: 'Assign to Production', hi: 'प्रोडक्शन में भेजें', hinglish: 'Production me bhejein', gu: 'પ્રોડક્શનમાં મોકલો', mr: 'प्रोडक्शनला पाठवा', mwr: 'प्रोडक्शन में भेजो' },
  jobOne: { en: 'job', hi: 'जॉब', hinglish: 'job', gu: 'જોબ', mr: 'जॉब', mwr: 'जॉब' },
  jobMany: { en: 'jobs', hi: 'जॉब', hinglish: 'jobs', gu: 'જોબ', mr: 'जॉब', mwr: 'जॉब' },
  awaitingProduction: { en: 'awaiting production', hi: 'प्रोडक्शन के इंतज़ार में', hinglish: 'production ke wait me', gu: 'પ્રોડક્શનની રાહ જોઈ રહ્યા છે', mr: 'प्रोडक्शनच्या प्रतीक्षेत', mwr: 'प्रोडक्शन रे इंतज़ार में' },
  noJobsAwaiting: { en: 'No jobs awaiting production.', hi: 'प्रोडक्शन के इंतज़ार में कोई जॉब नहीं।', hinglish: 'Production ke wait me koi job nahi.', gu: 'પ્રોડક્શનની રાહ જોતી કોઈ જોબ નથી.', mr: 'प्रोडक्शनच्या प्रतीक्षेत कोणतेही जॉब नाहीत.', mwr: 'प्रोडक्शन रे इंतज़ार में कोई जॉब कोनी।' },
  job: { en: 'Job', hi: 'जॉब', hinglish: 'Job', gu: 'જોબ', mr: 'जॉब', mwr: 'जॉब' },
  status: { en: 'Status', hi: 'स्टेटस', hinglish: 'Status', gu: 'સ્ટેટસ', mr: 'स्थिती', mwr: 'स्टेटस' },
  assignedTo: { en: 'Assigned To', hi: 'किसे सौंपा', hinglish: 'Assigned To', gu: 'કોને સોંપાયું', mr: 'कोणाला दिले', mwr: 'किणने सौंप्यो' },
  action: { en: 'Action', hi: 'कार्रवाई', hinglish: 'Action', gu: 'ક્રિયા', mr: 'क्रिया', mwr: 'कार्रवाई' },
  newStatus: { en: 'new', hi: 'नया', hinglish: 'new', gu: 'નવું', mr: 'नवीन', mwr: 'नयो' },
  assigning: { en: 'Assigning…', hi: 'भेजा जा रहा है…', hinglish: 'Assign ho raha hai…', gu: 'મોકલાઈ રહ્યું છે…', mr: 'पाठवत आहे…', mwr: 'भेजी रियो है…' },
  jobAssigned: { en: 'Job assigned to production', hi: 'जॉब प्रोडक्शन में भेज दी गई', hinglish: 'Job production me bhej di gayi', gu: 'જોબ પ્રોડક્શનમાં મોકલાઈ', mr: 'जॉब प्रोडक्शनला पाठवले', mwr: 'जॉब प्रोडक्शन में भेज दी' },
  failed: { en: 'Failed', hi: 'नहीं हुआ', hinglish: 'Fail hua', gu: 'નિષ્ફળ', mr: 'अयशस्वी', mwr: 'कोनी हुयो' },
};

export default function AssignProdPage() {
  const t = useT(S);
  const { hasRole } = useAuth();
  const [jobs, setJobs] = useState({});
  const [busyId, setBusyId] = useState(null);

  const canAssign = hasRole('admin', 'superadmin', 'owner');

  useEffect(() => {
    const u = onValue(ref(db, 'mpw/jobs'), (snap) => setJobs(snap.val() || {}));
    return () => u();
  }, []);

  const pending = useMemo(() => {
    return Object.entries(jobs)
      .map(([id, j]) => ({ ...j, id }))
      .filter((j) => {
        const s = String(j.status || '').toLowerCase();
        return s !== 'production' && s !== 'done';
      });
  }, [jobs]);

  const assign = async (job) => {
    setBusyId(job.id);
    try {
      await dbApi.update('jobs', job.id, { status: 'production' });
      await dbApi.create('production', {
        job: job.title || job.name || job.id,
        stage: 'queued',
        status: 'pending',
      });
      showToast(t('jobAssigned'), 'success');
    } catch (err) {
      showToast(err.response?.data?.error || t('failed'), 'error');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div data-legacy-id="page-assign-prod">
      <div className="mb-4">
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>🏭 {t('assignToProduction')}</h2>
        <div style={{ fontSize: 13, color: 'var(--text2)' }}>
          {pending.length} {pending.length === 1 ? t('jobOne') : t('jobMany')} {t('awaitingProduction')}
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        {!pending.length ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>
            {t('noJobsAwaiting')}
          </div>
        ) : (
          <table className="crm-table">
            <thead>
              <tr>
                <th>{t('job')}</th>
                <th>{t('status')}</th>
                <th>{t('assignedTo')}</th>
                {canAssign && <th style={{ width: 200 }}>{t('action')}</th>}
              </tr>
            </thead>
            <tbody>
              {pending.map((job) => (
                <tr key={job.id}>
                  <td>{job.title || job.name || '—'}</td>
                  <td><span className="badge badge-amber">{job.status || t('newStatus')}</span></td>
                  <td>{job.assignedTo || job.designer || '—'}</td>
                  {canAssign && (
                    <td>
                      <button
                        className="btn btn-primary btn-xs"
                        disabled={busyId === job.id}
                        onClick={() => assign(job)}
                      >
                        {busyId === job.id ? t('assigning') : t('assignToProduction')}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
