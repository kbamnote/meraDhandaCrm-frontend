/**
 * Job View — a full-screen, naturally-scrolling read-only page that renders a
 * single job's ENTIRE lifecycle via <JobFullDetail />.
 *
 * Replaces the old JobFullDetail bottom-sheet/modal (which didn't scroll
 * reliably on the app). Opened by the "👁 View" action in the Completed / Hold
 * resource lists, which navigates here with the job id in the URL (?id=…).
 *
 * Realtime optimization:
 *   - Instantly renders from `location.state.job` if passed from JobCardsPage (0ms load).
 *   - Subscribes ONLY to `mpw/jobs/${id}` instead of downloading the entire jobs collection.
 */
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useLocation, useNavigate } from 'react-router-dom';
import { ref, onValue, db } from '../services/realtime';
import { useT } from '../i18n/LanguageContext';
import JobFullDetail from '../components/common/JobFullDetail';
import JobStagePanel from '../components/common/JobStagePanel';

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
  const location = useLocation();
  const navigate = useNavigate();
  const id = params.get('id');
  const canMove = params.get('manage') === '1';

  // Instant render from navigation state if available (0ms perceived latency)
  const navJob = location.state?.job && String(location.state.job.id) === String(id) ? location.state.job : null;
  const [job, setJob] = useState(navJob);
  const [loaded, setLoaded] = useState(!!navJob);
  const [users, setUsers] = useState({});

  useEffect(() => {
    if (!id) {
      setLoaded(true);
      return;
    }
    // Listen ONLY to this single job's path — avoiding full collection download
    const r = ref(db, `mpw/jobs/${id}`);
    const u = onValue(r, (snap) => {
      const val = snap.val();
      if (val) setJob(val);
      setLoaded(true);
    });
    return u;
  }, [id]);

  // uid → name, for "Cancelled by …" and the Timeline's "by …".
  useEffect(() => onValue(ref(db, 'mpw/users'), (snap) => setUsers(snap.val() || {})), []);
  const userNames = useMemo(() => {
    const out = {};
    Object.entries(users || {}).forEach(([uid, u]) => { if (u) out[uid] = u.name || u.email || uid; });
    return out;
  }, [users]);

  const loading = !loaded && !job;

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
        <>
          <JobStagePanel job={{ ...job, id }} userNames={userNames} canMove={canMove} />
          <JobFullDetail job={{ ...job, id }} userNames={userNames} />
        </>
      )}
    </div>
  );
}
