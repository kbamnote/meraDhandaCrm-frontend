/**
 * My Attendance — personal self-service page.
 * Lists the caller's own attendance records via meApi.attendance().
 */
import { useEffect, useMemo, useState } from 'react';
import { meApi } from '../services/api';
import { showToast } from '../components/common/toast';

const STATUS_BADGE = {
  present: 'badge-green',
  absent: 'badge-red',
  leave: 'badge-amber',
  'half-day': 'badge-amber',
  late: 'badge-amber',
};

export default function MyAttendancePage() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await meApi.attendance();
        if (active) setRecords(Array.isArray(data) ? data : []);
      } catch (err) {
        showToast(err.response?.data?.error || 'Failed to load attendance', 'error');
        if (active) setRecords([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const presentCount = useMemo(
    () => records.filter(r => String(r.status || '').toLowerCase() === 'present').length,
    [records]
  );

  if (loading) {
    return (
      <div data-legacy-id="page-my-attendance" className="center-screen">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div data-legacy-id="page-my-attendance">
      <div className="mb-4">
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>🕒 My Attendance</h2>
        <div style={{ fontSize: 13, color: 'var(--text2)' }}>
          {records.length} total {records.length === 1 ? 'day' : 'days'} · {presentCount} present
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        {!records.length ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>
            No attendance records yet.
          </div>
        ) : (
          <table className="crm-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Login</th>
                <th>Logout</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r, i) => {
                const status = String(r.status || '').toLowerCase();
                return (
                  <tr key={r.id || `${r.date || ''}-${i}`}>
                    <td>{r.date || '—'}</td>
                    <td>{r.loginTime || '—'}</td>
                    <td>{r.logoutTime || '—'}</td>
                    <td>
                      {r.status
                        ? <span className={`badge ${STATUS_BADGE[status] || 'badge-blue'}`}>{r.status}</span>
                        : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
