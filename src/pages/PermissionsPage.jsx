/**
 * PermissionsPage — admin role management.
 *
 * Real-time list of every user (onValue mpw/users). Each row shows name, phone,
 * current role badge and customRole, plus an inline editor (select of built-in
 * roles + customRole text input + Save) that calls authApi.setRole. Editor
 * controls only render for admin / superadmin / owner.
 */
import { useEffect, useMemo, useState } from 'react';
import { ref, onValue, db } from '../services/realtime';
import { authApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { showToast } from '../components/common/toast';

const BUILTIN_ROLES = [
  'pending', 'staff', 'designer', 'jobsetter', 'sales', 'hr',
  'manager', 'floor_manager', 'admin', 'superadmin', 'owner',
];

const ROLE_BADGE = {
  admin: 'badge-red', superadmin: 'badge-red', owner: 'badge-red',
  manager: 'badge-amber', floor_manager: 'badge-amber', hr: 'badge-amber',
  designer: 'badge-blue', jobsetter: 'badge-blue', sales: 'badge-blue',
  staff: 'badge-green', pending: 'badge-amber',
};

export default function PermissionsPage() {
  const { hasRole } = useAuth();
  const [users, setUsers] = useState({});
  const [search, setSearch] = useState('');

  const canEdit = hasRole('admin', 'superadmin', 'owner');

  useEffect(() => {
    const u = onValue(ref(db, 'mpw/users'), (snap) => setUsers(snap.val() || {}));
    return () => u();
  }, []);

  const rows = useMemo(
    () => Object.entries(users).map(([id, u]) => ({ ...u, id })),
    [users]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((u) =>
      (u.name || '').toLowerCase().includes(q) ||
      (u.phone || '').toLowerCase().includes(q) ||
      (u.role || '').toLowerCase().includes(q) ||
      (u.customRole || '').toLowerCase().includes(q)
    );
  }, [rows, search]);

  return (
    <div data-legacy-id="page-permissions">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600 }}>🔐 Permissions &amp; Roles</h2>
          <div style={{ fontSize: 13, color: 'var(--text2)' }}>
            {filtered.length} {filtered.length === 1 ? 'user' : 'users'}
            {!canEdit && ' · read-only'}
          </div>
        </div>
      </div>

      <input
        className="input mb-4"
        placeholder="🔍 Search users..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        {!filtered.length ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>
            No users yet.
          </div>
        ) : (
          <table className="crm-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Current role</th>
                <th>Custom role</th>
                {canEdit && <th style={{ minWidth: 320 }}>Change role</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <RoleRow key={u.id} u={u} canEdit={canEdit} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function RoleRow({ u, canEdit }) {
  const [role, setRole] = useState(u.role || 'pending');
  const [customRole, setCustomRole] = useState(u.customRole || '');
  const [busy, setBusy] = useState(false);

  const badgeClass = ROLE_BADGE[u.role] || 'badge-blue';

  const save = async () => {
    setBusy(true);
    try {
      await authApi.setRole(u.id, { role, customRole: customRole.trim() || null });
      showToast('Role updated', 'success');
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <tr>
      <td><b style={{ color: 'var(--text)' }}>{u.name || '—'}</b></td>
      <td>{u.phone || '—'}</td>
      <td><span className={`badge ${badgeClass}`}>{u.role || 'pending'}</span></td>
      <td>{u.customRole || '—'}</td>
      {canEdit && (
        <td>
          <div className="flex gap-2 items-center">
            <select
              className="input"
              style={{ maxWidth: 150 }}
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              {BUILTIN_ROLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <input
              className="input"
              style={{ maxWidth: 130 }}
              placeholder="customRole"
              value={customRole}
              onChange={(e) => setCustomRole(e.target.value)}
            />
            <button className="btn btn-primary btn-xs" onClick={save} disabled={busy}>
              {busy ? 'Saving…' : 'Save'}
            </button>
          </div>
        </td>
      )}
    </tr>
  );
}
