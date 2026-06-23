/**
 * Job Detail — master/detail single-record page (read-only).
 * Left: a selectable list of jobs. Right: a detail card showing every field
 * of the selected job.
 *
 * Same realtime pattern as TasksPage: onValue(ref(db, 'mpw/jobs')).
 */
import { useEffect, useMemo, useState } from 'react';
import { ref, onValue, db } from '../services/realtime';
import { useT } from '../i18n/LanguageContext';

const S = {
  jobDetail: { en: 'Job Detail', hi: 'जॉब डिटेल', hinglish: 'Job Detail', gu: 'જોબ ડિટેલ', mr: 'जॉब तपशील', mwr: 'जॉब डिटेल' },
  job: { en: 'job', hi: 'जॉब', hinglish: 'job', gu: 'જોબ', mr: 'जॉब', mwr: 'जॉब' },
  jobs: { en: 'jobs', hi: 'जॉब', hinglish: 'jobs', gu: 'જોબ', mr: 'जॉब', mwr: 'जॉब' },
  noJobs: { en: 'No jobs yet.', hi: 'अभी तक कोई जॉब नहीं।', hinglish: 'Abhi tak koi job nahi.', gu: 'હજુ સુધી કોઈ જોબ નથી.', mr: 'अद्याप कोणतेही जॉब नाहीत.', mwr: 'अजे तांई कोई जॉब कोनी।' },
  selectJob: { en: 'Select a job.', hi: 'कोई जॉब चुनें।', hinglish: 'Koi job chunein.', gu: 'કોઈ જોબ પસંદ કરો.', mr: 'एखादे जॉब निवडा.', mwr: 'कोई जॉब चुणो।' },
  jobWord: { en: 'Job', hi: 'जॉब', hinglish: 'Job', gu: 'જોબ', mr: 'जॉब', mwr: 'जॉब' },
};

const STATUS_BADGE = {
  done: 'badge-green',
  completed: 'badge-green',
  pending: 'badge-amber',
  in_progress: 'badge-blue',
  'in-progress': 'badge-blue',
  active: 'badge-blue',
  hold: 'badge-amber',
  cancelled: 'badge-red',
  rejected: 'badge-red',
};

function cellText(value) {
  if (value == null || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return Array.isArray(value) ? value.join(', ') : JSON.stringify(value);
  return String(value);
}

export default function JobDetailPage() {
  const t = useT(S);
  const [jobs, setJobs] = useState({}); // { id: job }
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    const r = ref(db, 'mpw/jobs');
    const u = onValue(r, (snap) => setJobs(snap.val() || {}));
    return u;
  }, []);

  const list = useMemo(
    () => Object.entries(jobs).map(([id, j]) => ({ ...j, id })),
    [jobs]
  );

  // Default-select the first job once data arrives (or if the selected one
  // disappears).
  useEffect(() => {
    if (!list.length) { setSelectedId(null); return; }
    if (!selectedId || !list.some((j) => j.id === selectedId)) {
      setSelectedId(list[0].id);
    }
  }, [list, selectedId]);

  const selected = useMemo(
    () => list.find((j) => j.id === selectedId) || null,
    [list, selectedId]
  );

  const detailEntries = useMemo(() => {
    if (!selected) return [];
    return Object.entries(selected).filter(([k]) => k !== 'id');
  }, [selected]);

  return (
    <div data-legacy-id="page-job-detail">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600 }}>🛠 {t('jobDetail')}</h2>
          <div style={{ fontSize: 13, color: 'var(--text2)' }}>
            {list.length} {list.length === 1 ? t('job') : t('jobs')}
          </div>
        </div>
      </div>

      {!list.length ? (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>
          {t('noJobs')}
        </div>
      ) : (
        <div className="flex gap-3" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {/* Master list */}
          <div className="card" style={{ padding: 6, width: 280, maxWidth: '100%', maxHeight: '70vh', overflow: 'auto' }}>
            {list.map((j) => {
              const active = j.id === selectedId;
              return (
                <button
                  key={j.id}
                  type="button"
                  onClick={() => setSelectedId(j.id)}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '10px 12px',
                    borderRadius: 8,
                    marginBottom: 4,
                    background: active ? 'var(--blue-light)' : 'transparent',
                    borderLeft: `3px solid ${active ? 'var(--blue)' : 'transparent'}`,
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                    {j.title || j.name || `#${j.id}`}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
                    {j.client || '—'}
                  </div>
                  {j.status && (
                    <span
                      className={`badge ${STATUS_BADGE[j.status] || 'badge-blue'}`}
                      style={{ marginTop: 4 }}
                    >
                      {j.status}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Detail card */}
          <div className="card flex-1" style={{ minWidth: 280 }}>
            {!selected ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>
                {t('selectJob')}
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-2" style={{ flexWrap: 'wrap', gap: 8 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 600 }}>
                    {selected.title || selected.name || `${t('jobWord')} #${selected.id}`}
                  </h3>
                  {selected.status && (
                    <span className={`badge ${STATUS_BADGE[selected.status] || 'badge-blue'}`}>
                      {selected.status}
                    </span>
                  )}
                </div>

                <table className="crm-table" style={{ width: '100%' }}>
                  <tbody>
                    {detailEntries.map(([k, v]) => (
                      <tr key={k}>
                        <td style={{ width: 140, color: 'var(--text2)', textTransform: 'capitalize' }}>{k}</td>
                        <td style={{ fontWeight: 500 }}>{cellText(v)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
