import { useEffect, useMemo, useState } from 'react';
import { ref, onValue, db } from '../services/realtime';
import { useAuth } from '../context/AuthContext';

export default function ProductivityPage() {
  const { profile } = useAuth();
  const [tasks, setTasks] = useState({});
  const [attendance, setAttendance] = useState({});

  useEffect(() => {
    const u1 = onValue(ref(db, 'mpw/tasks'), (snap) => setTasks(snap.val() || {}));
    const u2 = onValue(ref(db, 'mpw/attendance'), (snap) => setAttendance(snap.val() || {}));
    return () => { u1(); u2(); };
  }, []);

  const taskList = useMemo(() => Object.values(tasks || {}), [tasks]);

  const totalTasks = taskList.length;
  const doneTasks = useMemo(
    () => taskList.filter((t) => t && t.status === 'done').length,
    [taskList]
  );
  const completion = totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0;
  const attendanceCount = Object.keys(attendance || {}).length;

  const perAssignee = useMemo(() => {
    const map = {};
    taskList.forEach((t) => {
      const name = (t && (t.assignedToName || t.assignedTo)) || 'Unassigned';
      if (!map[name]) map[name] = { name, total: 0, done: 0 };
      map[name].total += 1;
      if (t && t.status === 'done') map[name].done += 1;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [taskList]);

  const cards = [
    { label: 'Total tasks', icon: '📋', value: totalTasks },
    { label: 'Done tasks', icon: '✅', value: doneTasks },
    { label: 'Completion', icon: '📈', value: `${completion}%` },
    { label: 'Attendance records', icon: '🕒', value: attendanceCount },
  ];

  return (
    <div data-legacy-id="page-productivity">
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>🚀 Productivity</h2>
      <div style={{ color: 'var(--text2)', fontSize: 13, marginBottom: 20 }}>
        Task throughput & attendance{profile?.name ? ` · ${profile.name}` : ''}
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
          Tasks per assignee
        </div>
        {!perAssignee.length ? (
          <div style={{ textAlign: 'center', padding: 30, color: 'var(--text3)' }}>
            No tasks yet.
          </div>
        ) : (
          <table className="crm-table">
            <thead>
              <tr>
                <th>Assignee</th>
                <th>Total</th>
                <th>Done</th>
                <th>Completion</th>
              </tr>
            </thead>
            <tbody>
              {perAssignee.map((a) => {
                const pct = a.total ? Math.round((a.done / a.total) * 100) : 0;
                return (
                  <tr key={a.name}>
                    <td>{a.name}</td>
                    <td>{a.total}</td>
                    <td>{a.done}</td>
                    <td>
                      <span className={`badge ${pct >= 100 ? 'badge-green' : pct >= 50 ? 'badge-blue' : 'badge-amber'}`}>
                        {pct}%
                      </span>
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
