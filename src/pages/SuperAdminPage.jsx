/**
 * Super Admin — system overview dashboard.
 *
 * Real-time user counts (total + per role) via onValue(mpw/users), plus a
 * best-effort recent-activity peek from auditLogs (admin/superadmin only; the
 * collection 403s for everyone else, which we catch gracefully).
 */
import { useEffect, useMemo, useState } from 'react';
import { ref, onValue, db } from '../services/realtime';
import { dbApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { showToast } from '../components/common/toast';

function fmtTime(ts) {
  if (!ts) return '—';
  try {
    const d = typeof ts === 'number' ? new Date(ts) : new Date(String(ts));
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString();
  } catch { return '—'; }
}

export default function SuperAdminPage() {
  const { profile } = useAuth();
  const [users, setUsers] = useState({});
  const [logs, setLogs] = useState([]);
  const [logsOk, setLogsOk] = useState(true);

  // Real-time user list.
  useEffect(() => {
    const u = onValue(ref(db, 'mpw/users'), (snap) => setUsers(snap.val() || {}));
    return () => u();
  }, []);

  // Best-effort audit logs (may 403 for non-superadmins).
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const map = await dbApi.list('auditLogs');
        if (!active) return;
        const arr = Object.entries(map || {}).map(([id, l]) => ({ ...l, id }));
        arr.sort((a, b) => {
          const ta = Number(a.ts || a.timestamp || 0);
          const tb = Number(b.ts || b.timestamp || 0);
          return tb - ta;
        });
        setLogs(arr);
      } catch (err) {
        if (!active) return;
        setLogsOk(false);
        setLogs([]);
        if (err.response?.status && err.response.status !== 403) {
          showToast(err.response?.data?.error || 'Failed to load activity', 'error');
        }
      }
    })();
    return () => { active = false; };
  }, []);

  const userList = useMemo(
    () => Object.entries(users).map(([id, u]) => ({ ...u, id })),
    [users]
  );

  const total = userList.length;

  const byRole = useMemo(() => {
    const counts = {};
    userList.forEach((u) => {
      const role = u.role || 'unassigned';
      counts[role] = (counts[role] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [userList]);

  const pending = useMemo(
    () => userList.filter((u) => !u.role || u.role === 'pending').length,
    [userList]
  );

  const recent = logs.slice(0, 6);

  return (
    <div data-legacy-id="page-superadmin">
      <div className="mb-4">
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>🛡️ Super Admin</h2>
        <div style={{ fontSize: 13, color: 'var(--text2)' }}>
          System overview · signed in as <b>{profile?.name || profile?.phone || '—'}</b>
          {profile?.role && <> · <span className="badge badge-blue">{profile.role}</span></>}
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))',
          gap: 12,
          marginBottom: 20,
        }}
      >
        <div className="card">
          <div style={{ fontSize: 24 }}>👥</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>Total users</div>
          <div style={{ fontSize: 28, fontWeight: 700, marginTop: 2 }}>{total}</div>
        </div>
        <div className="card">
          <div style={{ fontSize: 24 }}>🧩</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>Distinct roles</div>
          <div style={{ fontSize: 28, fontWeight: 700, marginTop: 2 }}>{byRole.length}</div>
        </div>
        <div className="card">
          <div style={{ fontSize: 24 }}>⏳</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>Pending / unassigned</div>
          <div style={{ fontSize: 28, fontWeight: 700, marginTop: 2 }}>{pending}</div>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))',
          gap: 16,
        }}
      >
        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 10 }}>Users by role</div>
          {!byRole.length ? (
            <div style={{ fontSize: 13, color: 'var(--text3)' }}>No users yet.</div>
          ) : (
            <table className="crm-table">
              <thead>
                <tr>
                  <th>Role</th>
                  <th style={{ width: 80, textAlign: 'right' }}>Count</th>
                </tr>
              </thead>
              <tbody>
                {byRole.map(([role, count]) => (
                  <tr key={role}>
                    <td><span className="badge badge-blue">{role}</span></td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <div style={{ fontWeight: 600 }}>Recent activity</div>
            {!logsOk && <span className="badge badge-amber">restricted</span>}
          </div>
          {!logsOk ? (
            <div style={{ fontSize: 13, color: 'var(--text3)' }}>
              Audit logs are not available for your role.
            </div>
          ) : !recent.length ? (
            <div style={{ fontSize: 13, color: 'var(--text3)' }}>No recent activity.</div>
          ) : (
            <div>
              {recent.map((l) => (
                <div
                  key={l.id}
                  style={{
                    fontSize: 12,
                    padding: '8px 0',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  <div style={{ fontWeight: 600 }}>
                    {l.action || l.event || l.type || 'activity'}
                  </div>
                  <div style={{ color: 'var(--text3)', marginTop: 2 }}>
                    {(l.actor || l.userName || l.user || l.by || 'system')}
                    {' · '}
                    {fmtTime(l.ts || l.timestamp || l.createdAt)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
