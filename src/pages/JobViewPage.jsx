/**
 * Job View — a full-screen, naturally-scrolling read-only page that renders a
 * single job's ENTIRE lifecycle via <JobFullDetail />.
 *
 * Replaces the old JobFullDetail bottom-sheet/modal (which didn't scroll
 * reliably on the app). Opened by the "👁 View" action in the Completed / Hold
 * resource lists, which navigates here with the job id in the URL (?id=…).
 *
 * Same realtime pattern as JobDetailPage: onValue(ref(db, 'mpw/jobs')). The
 * page reads the id from the query string, picks jobs[id] from the LIVE jobs
 * collection, and renders inside normal document flow so it scrolls naturally.
 */
import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ref, onValue, db } from '../services/realtime';
import { useT } from '../i18n/LanguageContext';
import JobFullDetail from '../components/common/JobFullDetail';

const S = {
  back: { en: '← Back', hi: '← वापस', hinglish: '← Back', gu: '← પાછળ', mr: '← मागे', mwr: '← पाछो' },
  jobView: { en: 'Job View', hi: 'जॉब व्यू', hinglish: 'Job View', gu: 'જોબ વ્યૂ', mr: 'जॉब व्ह्यू', mwr: 'जॉब व्यू' },
  loading: { en: 'Loading…', hi: 'लोड हो रहा है…', hinglish: 'Load ho raha hai…', gu: 'લોડ થઈ રહ્યું છે…', mr: 'लोड होत आहे…', mwr: 'लोड हो रियो है…' },
  notFound: { en: 'Job not found', hi: 'जॉब नहीं मिला', hinglish: 'Job nahi mila', gu: 'જોબ મળ્યું નથી', mr: 'जॉब सापडले नाही', mwr: 'जॉब कोनी मिल्यो' },
  notFoundHint: {
    en: 'This job may have been removed, or the link is invalid.',
    hi: 'यह जॉब हटा दिया गया हो सकता है, या लिंक अमान्य है।',
    hinglish: 'Yeh job hata diya gaya ho sakta hai, ya link invalid hai.',
    gu: 'આ જોબ દૂર કરવામાં આવ્યું હોઈ શકે, અથવા લિંક અમાન્ય છે.',
    mr: 'हे जॉब काढून टाकले असावे, किंवा लिंक अवैध आहे.',
    mwr: 'यो जॉब हटा दियो ग्यो होसी, या लिंक गलत है।',
  },
};

export default function JobViewPage() {
  const t = useT(S);
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const id = params.get('id');

  const [jobs, setJobs] = useState(null); // null until first snapshot arrives

  useEffect(() => {
    const r = ref(db, 'mpw/jobs');
    const u = onValue(r, (snap) => setJobs(snap.val() || {}));
    return u;
  }, []);

  const job = jobs && id ? jobs[id] : null;
  const loading = jobs === null;

  return (
    <div data-legacy-id="page-job-view">
      <div className="flex items-center gap-3 mb-4">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>
          {t('back')}
        </button>
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>{t('jobView')}</h2>
      </div>

      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>
          {t('loading')}
        </div>
      ) : !job ? (
        <div className="card" style={{ maxWidth: 480, margin: '0 auto', textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
          <h3 style={{ marginBottom: 6 }}>{t('notFound')}</h3>
          <div style={{ color: 'var(--text2)', fontSize: 14 }}>{t('notFoundHint')}</div>
        </div>
      ) : (
        <JobFullDetail job={{ ...job, id }} />
      )}
    </div>
  );
}
