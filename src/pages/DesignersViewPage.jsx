/**
 * Designers View — read-only board.
 * Subscribes to mpw/designers + mpw/jobs and shows a card per designer with the
 * number of jobs assigned to that designer (matched on name or id).
 */
import { useEffect, useMemo, useState } from 'react';
import { ref, onValue, db } from '../services/realtime';

export default function DesignersViewPage() {
  const [designers, setDesigners] = useState({});
  const [jobs, setJobs] = useState({});

  useEffect(() => {
    const u1 = onValue(ref(db, 'mpw/designers'), (snap) => setDesigners(snap.val() || {}));
    const u2 = onValue(ref(db, 'mpw/jobs'), (snap) => setJobs(snap.val() || {}));
    return () => { u1(); u2(); };
  }, []);

  const designerList = useMemo(
    () => Object.entries(designers).map(([id, d]) => ({ ...d, id })),
    [designers]
  );

  const jobList = useMemo(
    () => Object.entries(jobs).map(([id, j]) => ({ ...j, id })),
    [jobs]
  );

  const jobCountFor = (d) => {
    const name = (d.name || '').trim().toLowerCase();
    const id = d.id;
    return jobList.filter((j) => {
      const assigned = String(j.assignedTo ?? j.designer ?? '').trim().toLowerCase();
      if (!assigned) return false;
      return assigned === id || (name && assigned === name);
    }).length;
  };

  const statusBadge = (status) => {
    const s = String(status || '').toLowerCase();
    if (s === 'active' || s === 'available') return 'badge badge-green';
    if (s === 'busy' || s === 'on_leave' || s === 'leave') return 'badge badge-amber';
    if (s === 'inactive' || s === 'offline') return 'badge badge-red';
    return 'badge badge-blue';
  };

  return (
    <div data-legacy-id="page-designers-view">
      <div className="mb-4">
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>🎨 Designers</h2>
        <div style={{ fontSize: 13, color: 'var(--text2)' }}>
          {designerList.length} {designerList.length === 1 ? 'designer' : 'designers'} · {jobList.length} jobs
        </div>
      </div>

      {!designerList.length ? (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>
          No designers yet.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 12 }}>
          {designerList.map((d) => (
            <div key={d.id} className="card">
              <div className="flex items-center justify-between mb-2">
                <div style={{ fontSize: 15, fontWeight: 600 }}>{d.name || '—'}</div>
                {d.status && <span className={statusBadge(d.status)}>{d.status}</span>}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8 }}>
                {d.specialization || d.specialty || 'General'}
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontSize: 28, fontWeight: 700 }}>{jobCountFor(d)}</span>
                <span style={{ fontSize: 12, color: 'var(--text3)' }}>assigned jobs</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
