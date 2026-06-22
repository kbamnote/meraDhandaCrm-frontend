/**
 * HierarchyPage — read-only org view.
 *
 * Real-time subscribe to mpw/users + mpw/departments. Group users by their
 * department (fallback 'Unassigned') and render one card per department, each
 * listing its users with a role badge. No writes.
 */
import { useEffect, useMemo, useState } from 'react';
import { ref, onValue, db } from '../services/realtime';

const ROLE_BADGE = {
  admin: 'badge-red', superadmin: 'badge-red', owner: 'badge-red',
  manager: 'badge-amber', floor_manager: 'badge-amber', hr: 'badge-amber',
  designer: 'badge-blue', jobsetter: 'badge-blue', sales: 'badge-blue',
  staff: 'badge-green', pending: 'badge-amber',
};

const UNASSIGNED = 'Unassigned';

export default function HierarchyPage() {
  const [users, setUsers] = useState({});
  const [departments, setDepartments] = useState({});

  useEffect(() => {
    const u1 = onValue(ref(db, 'mpw/users'), (snap) => setUsers(snap.val() || {}));
    const u2 = onValue(ref(db, 'mpw/departments'), (snap) => setDepartments(snap.val() || {}));
    return () => { u1(); u2(); };
  }, []);

  // Map a department id (or name) to a readable label.
  const deptLabel = useMemo(() => {
    const m = {};
    Object.entries(departments).forEach(([id, d]) => {
      m[id] = (d && (d.name || d.title)) || id;
    });
    return m;
  }, [departments]);

  // Group users by department label.
  const groups = useMemo(() => {
    const byDept = {};
    Object.entries(users).forEach(([id, u]) => {
      const raw = u?.department;
      const label = raw ? (deptLabel[raw] || raw) : UNASSIGNED;
      if (!byDept[label]) byDept[label] = [];
      byDept[label].push({ ...u, id });
    });
    // Sort: named departments first (alpha), Unassigned last.
    const names = Object.keys(byDept).sort((a, b) => {
      if (a === UNASSIGNED) return 1;
      if (b === UNASSIGNED) return -1;
      return a.localeCompare(b);
    });
    return names.map((name) => ({
      name,
      members: byDept[name].sort((a, b) =>
        (a.name || a.phone || '').localeCompare(b.name || b.phone || '')
      ),
    }));
  }, [users, deptLabel]);

  const totalUsers = Object.keys(users).length;

  return (
    <div data-legacy-id="page-hierarchy">
      <div className="mb-4">
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>🏢 Org Hierarchy</h2>
        <div style={{ fontSize: 13, color: 'var(--text2)' }}>
          {totalUsers} {totalUsers === 1 ? 'person' : 'people'} across {groups.length}{' '}
          {groups.length === 1 ? 'department' : 'departments'}
        </div>
      </div>

      {!groups.length ? (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>
          No users yet.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 12 }}>
          {groups.map((g) => (
            <div key={g.name} className="card">
              <div className="flex items-center justify-between mb-2">
                <div style={{ fontSize: 15, fontWeight: 600 }}>{g.name}</div>
                <span className="badge badge-blue">{g.members.length}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {g.members.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between"
                    style={{ paddingBottom: 8, borderBottom: '1px solid var(--border)' }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>
                        {u.name || u.phone || u.id}
                      </div>
                      {u.phone && u.name && (
                        <div style={{ fontSize: 11, color: 'var(--text3)' }}>{u.phone}</div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <span className={`badge ${ROLE_BADGE[u.role] || 'badge-blue'}`}>
                        {u.role || 'pending'}
                      </span>
                      {u.customRole && (
                        <span className="badge badge-blue">{u.customRole}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
