import { useEffect, useMemo, useState } from 'react';
import { ref, onValue, db } from '../services/realtime';
import { useAuth } from '../context/AuthContext';

export default function HrDashboardPage() {
  const { profile } = useAuth();
  const [users, setUsers] = useState({});
  const [leaves, setLeaves] = useState({});
  const [attendance, setAttendance] = useState({});
  const [departments, setDepartments] = useState({});

  useEffect(() => {
    const u1 = onValue(ref(db, 'mpw/users'), (snap) => setUsers(snap.val() || {}));
    const u2 = onValue(ref(db, 'mpw/leaves'), (snap) => setLeaves(snap.val() || {}));
    const u3 = onValue(ref(db, 'mpw/attendance'), (snap) => setAttendance(snap.val() || {}));
    const u4 = onValue(ref(db, 'mpw/departments'), (snap) => setDepartments(snap.val() || {}));
    return () => { u1(); u2(); u3(); u4(); };
  }, []);

  const leaveList = useMemo(
    () => Object.entries(leaves || {}).map(([id, l]) => ({ ...(l || {}), id })),
    [leaves]
  );

  const staffCount = Object.keys(users || {}).length;
  const deptCount = Object.keys(departments || {}).length;
  const attendanceCount = Object.keys(attendance || {}).length;

  const pendingLeaves = useMemo(
    () => leaveList.filter((l) => l.status === 'pending'),
    [leaveList]
  );
  const approvedLeaves = useMemo(
    () => leaveList.filter((l) => l.status === 'approved'),
    [leaveList]
  );

  const userName = (uid) => {
    const u = (users || {})[uid];
    return (u && (u.name || u.phone)) || uid || '—';
  };

  const cards = [
    { label: 'Total staff', icon: '👥', value: staffCount },
    { label: 'Departments', icon: '🏢', value: deptCount },
    { label: 'Pending leaves', icon: '⏳', value: pendingLeaves.length },
    { label: 'Approved leaves', icon: '✅', value: approvedLeaves.length },
  ];

  return (
    <div data-legacy-id="page-hr-dashboard">
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>🧑‍💼 HR Dashboard</h2>
      <div style={{ color: 'var(--text2)', fontSize: 13, marginBottom: 20 }}>
        People & leave overview{profile?.name ? ` · ${profile.name}` : ''}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 12 }}>
        {cards.map((c) => (
          <div key={c.label} className="card">
            <div style={{ fontSize: 24 }}>{c.icon}</div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>{c.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, marginTop: 2 }}>{c.value ?? '—'}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 16, padding: 0, overflow: 'auto' }}>
        <div style={{ fontWeight: 600, padding: '12px 14px' }}>
          Pending leave requests ({pendingLeaves.length})
        </div>
        {!pendingLeaves.length ? (
          <div style={{ textAlign: 'center', padding: 30, color: 'var(--text3)' }}>
            No pending leave requests.
          </div>
        ) : (
          <table className="crm-table">
            <thead>
              <tr>
                <th>Staff</th>
                <th>Type</th>
                <th>From</th>
                <th>To</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {pendingLeaves.map((l) => (
                <tr key={l.id}>
                  <td>{l.userName || userName(l.userId || l.uid)}</td>
                  <td>{l.type ? <span className="badge badge-amber">{l.type}</span> : '—'}</td>
                  <td>{l.fromDate || '—'}</td>
                  <td>{l.toDate || '—'}</td>
                  <td>{l.reason || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
