/**
 * Assign to Production — lists jobs not yet in production and lets an
 * admin/superadmin/owner push them into the production queue.
 */
import { useEffect, useMemo, useState } from 'react';
import { dbApi } from '../services/api';
import { ref, onValue, db } from '../services/realtime';
import { useAuth } from '../context/AuthContext';
import { showToast } from '../components/common/toast';

export default function AssignProdPage() {
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
      showToast('Job assigned to production', 'success');
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed', 'error');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div data-legacy-id="page-assign-prod">
      <div className="mb-4">
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>🏭 Assign to Production</h2>
        <div style={{ fontSize: 13, color: 'var(--text2)' }}>
          {pending.length} {pending.length === 1 ? 'job' : 'jobs'} awaiting production
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        {!pending.length ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>
            No jobs awaiting production.
          </div>
        ) : (
          <table className="crm-table">
            <thead>
              <tr>
                <th>Job</th>
                <th>Status</th>
                <th>Assigned To</th>
                {canAssign && <th style={{ width: 200 }}>Action</th>}
              </tr>
            </thead>
            <tbody>
              {pending.map((job) => (
                <tr key={job.id}>
                  <td>{job.title || job.name || '—'}</td>
                  <td><span className="badge badge-amber">{job.status || 'new'}</span></td>
                  <td>{job.assignedTo || job.designer || '—'}</td>
                  {canAssign && (
                    <td>
                      <button
                        className="btn btn-primary btn-xs"
                        disabled={busyId === job.id}
                        onClick={() => assign(job)}
                      >
                        {busyId === job.id ? 'Assigning…' : 'Assign to Production'}
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
