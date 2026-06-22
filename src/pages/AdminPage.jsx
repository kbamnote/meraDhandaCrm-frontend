import { useEffect, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';

const STAT_PATHS = [
  { path: 'mpw/tasks',    label: 'Tasks',    icon: '✅' },
  { path: 'mpw/users',    label: 'Staff',    icon: '👥' },
  { path: 'mpw/leads',    label: 'Leads',    icon: '📞' },
  { path: 'mpw/products', label: 'Products', icon: '🛍' },
  { path: 'mpw/vendors',  label: 'Vendors',  icon: '🏪' },
  { path: 'mpw/machines', label: 'Machines', icon: '⚙️' },
];

export default function AdminPage() {
  const { profile } = useAuth();
  const [counts, setCounts] = useState({});

  useEffect(() => {
    const unsubs = STAT_PATHS.map(({ path }) => {
      const r = ref(db, path);
      return onValue(r, (snap) => {
        const v = snap.val();
        setCounts(prev => ({ ...prev, [path]: v ? Object.keys(v).length : 0 }));
      });
    });
    return () => unsubs.forEach(u => u());
  }, []);

  return (
    <div data-legacy-id="page-admin">
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>
        🏠 Welcome{profile?.name ? `, ${profile.name}` : ''}
      </h2>
      <div style={{ color: 'var(--text2)', fontSize: 13, marginBottom: 20 }}>
        Workflow at a glance · role: <b>{profile?.role || '—'}</b>
        {profile?.customRole && <> · custom: <b>{profile.customRole}</b></>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 12 }}>
        {STAT_PATHS.map(s => (
          <div key={s.path} className="card">
            <div style={{ fontSize: 24 }}>{s.icon}</div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, marginTop: 2 }}>
              {counts[s.path] ?? '—'}
            </div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 20, background: 'var(--blue-light)', borderColor: 'var(--blue)' }}>
        <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--blue-dark)' }}>👨‍💻 Developer notes</div>
        <div style={{ fontSize: 13, color: 'var(--text2)' }}>
          The Tasks page is fully ported as a reference. Use that pattern to port the
          remaining stub pages. See <code>docs/MIGRATION_GUIDE.md</code> for the full plan.
        </div>
      </div>
    </div>
  );
}
