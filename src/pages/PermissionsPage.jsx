/**
 * PermissionsPage — admin user management.
 *
 * - "+ Add Teammate" creates a new user (email + password + role) via authApi.createUser.
 * - Real-time list of every user (onValue mpw/users) with an inline role editor
 *   (built-in role select + customRole) that calls authApi.setRole.
 * All write controls require admin / superadmin / owner.
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
  const [showAdd, setShowAdd] = useState(false);

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
      (u.email || '').toLowerCase().includes(q) ||
      (u.role || '').toLowerCase().includes(q) ||
      (u.customRole || '').toLowerCase().includes(q)
    );
  }, [rows, search]);

  return (
    <div data-legacy-id="page-permissions">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600 }}>🔐 Permissions &amp; Team</h2>
          <div style={{ fontSize: 13, color: 'var(--text2)' }}>
            {filtered.length} {filtered.length === 1 ? 'user' : 'users'}
            {!canEdit && ' · read-only'}
          </div>
        </div>
        {canEdit && (
          <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>
            + Add Teammate
          </button>
        )}
      </div>

      <input
        className="input mb-4"
        placeholder="🔍 Search by name, email, role..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        {!filtered.length ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>
            No users yet. Click “+ Add Teammate” to create the first one.
          </div>
        ) : (
          <table className="crm-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
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

      {showAdd && <AddTeammateModal onClose={() => setShowAdd(false)} />}
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
      <td>{u.email || '—'}</td>
      <td><span className={`badge ${badgeClass}`}>{u.role || 'pending'}</span></td>
      <td>{u.customRole || '—'}</td>
      {canEdit && (
        <td>
          <div className="flex gap-2 items-center">
            <select className="input" style={{ maxWidth: 150 }} value={role} onChange={(e) => setRole(e.target.value)}>
              {BUILTIN_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <input className="input" style={{ maxWidth: 130 }} placeholder="customRole" value={customRole} onChange={(e) => setCustomRole(e.target.value)} />
            <button className="btn btn-primary btn-xs" onClick={save} disabled={busy}>
              {busy ? 'Saving…' : 'Save'}
            </button>
          </div>
        </td>
      )}
    </tr>
  );
}

function AddTeammateModal({ onClose }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'staff', department: '' });
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.email.trim()) return showToast('Email is required', 'error');
    if (form.password.length < 6) return showToast('Password must be at least 6 characters', 'error');
    setBusy(true);
    try {
      await authApi.createUser({
        email: form.email.trim(),
        password: form.password,
        name: form.name.trim(),
        role: form.role,
        department: form.department.trim() || null,
      });
      showToast(`Teammate ${form.email.trim()} created`, 'success');
      onClose();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to create teammate', 'error');
    } finally { setBusy(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <form className="card" onSubmit={submit} style={{ maxWidth: 440, width: '100%' }}>
        <h3 style={{ marginBottom: 14 }}>+ Add Teammate</h3>

        <div className="form-group">
          <label>Full name</label>
          <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} autoFocus />
        </div>
        <div className="form-group">
          <label>Email *</label>
          <input className="input" type="email" placeholder="teammate@company.com" value={form.email} onChange={(e) => set('email', e.target.value)} required />
        </div>
        <div className="form-group">
          <label>Temporary password * (min 6 chars)</label>
          <input className="input" type="text" placeholder="they can change it later" value={form.password} onChange={(e) => set('password', e.target.value)} required />
        </div>
        <div className="flex gap-2">
          <div className="form-group" style={{ flex: 1 }}>
            <label>Role</label>
            <select className="input" value={form.role} onChange={(e) => set('role', e.target.value)}>
              {BUILTIN_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label>Department</label>
            <input className="input" value={form.department} onChange={(e) => set('department', e.target.value)} />
          </div>
        </div>

        <div className="flex gap-2 mt-2">
          <button type="submit" className="btn btn-primary flex-1" disabled={busy}>
            {busy ? 'Creating…' : 'Create teammate'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>
          Share the email + password with them. They sign in at the login page.
        </div>
      </form>
    </div>
  );
}
