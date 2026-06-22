/**
 * Tasks page — REFERENCE PORT.
 *
 * This page is intentionally fully implemented (not a stub) so your developer
 * can copy the pattern when porting the remaining 49 legacy pages:
 *
 *   1. Subscribe to a Firebase Realtime DB path via `onValue` (real-time).
 *   2. Mirror the legacy filter/sort logic that lived inside refreshTasks().
 *   3. Use dbApi.create / dbApi.update / dbApi.remove for writes — these go
 *      through the Node backend so all role checks happen server-side.
 *   4. Custom roles ("CustomRolesInTaskAssign"): the assignee dropdown shows
 *      both built-in roles and any custom role names that appear on user docs.
 */

import { useEffect, useMemo, useState } from 'react';
import { ref, onValue, db } from '../services/realtime';
import { dbApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { showToast } from '../components/common/toast';

const PRIORITY_ORDER = { most_urgent: 0, urgent: 1, normal: 2 };
const PRIORITY_LABEL = { most_urgent: '🔴 MOST URGENT', urgent: '⚡ Urgent', normal: '' };
const PRIORITY_BG    = { most_urgent: '#DC2626', urgent: '#F59E0B', normal: '' };

function getDeadlineMs(t) {
  try {
    if (!t.deadlineDate) return 0;
    const iso = t.deadlineDate + (t.deadlineTime ? 'T' + t.deadlineTime : '');
    return new Date(iso).getTime();
  } catch { return 0; }
}

export default function TasksPage() {
  const { profile } = useAuth();
  const [tasks, setTasks] = useState({});      // { id: task }
  const [users, setUsers] = useState({});      // { uid: user }
  const [search, setSearch] = useState('');
  const [showNew, setShowNew] = useState(false);

  const isAdmin = ['admin', 'manager', 'floor_manager', 'superadmin', 'owner'].includes(profile?.role);
  const canSeeAll = isAdmin || profile?.permissions?.manage_tasks;

  // Real-time subscriptions — same pattern the legacy file used.
  useEffect(() => {
    const tasksRef = ref(db, 'mpw/tasks');
    const usersRef = ref(db, 'mpw/users');
    const u1 = onValue(tasksRef, (snap) => setTasks(snap.val() || {}));
    const u2 = onValue(usersRef, (snap) => setUsers(snap.val() || {}));
    return () => { u1(); u2(); };
  }, []);

  const all = useMemo(
    () => Object.entries(tasks).map(([id, t]) => ({ ...t, id })),
    [tasks]
  );

  const visible = useMemo(() => {
    if (canSeeAll) return all;
    const myKey = profile?.id;
    return all.filter(t => t.assignedTo === myKey || t.createdBy === myKey);
  }, [all, canSeeAll, profile]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return visible;
    return visible.filter(t =>
      (t.title || '').toLowerCase().includes(q) ||
      (t.assignedToName || '').toLowerCase().includes(q) ||
      (t.jobRef || '').toLowerCase().includes(q)
    );
  }, [visible, search]);

  const now = Date.now();
  const active   = filtered.filter(t => t.status !== 'done');
  const overdue  = active.filter(t => { const dl = getDeadlineMs(t); return dl && dl < now; });
  const upcoming = active.filter(t => { const dl = getDeadlineMs(t); return !dl || dl >= now; });
  const done     = filtered.filter(t => t.status === 'done');

  const sortedActive = [
    ...overdue.sort((a, b) => getDeadlineMs(a) - getDeadlineMs(b)),
    ...upcoming.sort((a, b) =>
      (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2)
    ),
  ];

  const completeTask = async (t) => {
    try {
      await dbApi.update('tasks', t.id, { status: 'done', completedTs: Date.now() });
      showToast('Task marked done', 'success');
    } catch (e) { showToast(e.response?.data?.error || 'Failed', 'error'); }
  };

  const removeTask = async (t) => {
    if (!confirm(`Delete task "${t.title}"?`)) return;
    try {
      await dbApi.remove('tasks', t.id);
      showToast('Task deleted', 'success');
    } catch (e) { showToast(e.response?.data?.error || 'Failed', 'error'); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600 }}>📋 Task Manager</h2>
          <div style={{ fontSize: 13, color: 'var(--text2)' }}>
            {active.length} active · {overdue.length} overdue · {done.length} done
          </div>
        </div>
        {canSeeAll && (
          <button className="btn btn-primary btn-sm" onClick={() => setShowNew(true)}>
            + New Task
          </button>
        )}
      </div>

      <input
        className="input mb-4"
        placeholder="🔍 Search tasks..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {!filtered.length && (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>
          No tasks yet.
        </div>
      )}

      {!!sortedActive.length && (
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', margin: '8px 0', textTransform: 'uppercase', letterSpacing: '.05em' }}>
          Active ({sortedActive.length})
        </div>
      )}
      {sortedActive.map(t => (
        <TaskCard key={t.id} t={t} now={now} onComplete={completeTask} onDelete={removeTask} canManage={canSeeAll} />
      ))}

      {!!done.length && (
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', margin: '16px 0 8px', textTransform: 'uppercase', letterSpacing: '.05em' }}>
          Done ({done.length})
        </div>
      )}
      {done.map(t => (
        <TaskCard key={t.id} t={t} now={now} onDelete={removeTask} canManage={canSeeAll} />
      ))}

      {showNew && (
        <NewTaskModal users={users} onClose={() => setShowNew(false)} createdBy={profile?.id} />
      )}
    </div>
  );
}

function TaskCard({ t, now, onComplete, onDelete, canManage }) {
  const dlMs = getDeadlineMs(t);
  const isOverdue = dlMs && dlMs < now && t.status !== 'done';
  const isDueSoon = dlMs && dlMs - now < 3600000 && dlMs > now;
  const minutesLeft = dlMs ? Math.max(0, Math.round((dlMs - now) / 60000)) : 0;
  const dl = (t.deadlineDate || '') + (t.deadlineTime ? ' ' + t.deadlineTime : '');
  const borderColor =
    isOverdue ? 'var(--red)'
    : isDueSoon ? 'var(--amber)'
    : t.priority === 'most_urgent' ? '#DC2626'
    : t.priority === 'urgent' ? '#F59E0B'
    : 'var(--border)';

  return (
    <div className="card" style={{ borderLeft: `4px solid ${borderColor}`, marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{t.title}</div>
          {t.description && (
            <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>{t.description}</div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {PRIORITY_LABEL[t.priority] && (
            <span style={{ background: PRIORITY_BG[t.priority], color: '#fff', fontSize: 10, padding: '2px 7px', borderRadius: 8, fontWeight: 700 }}>
              {PRIORITY_LABEL[t.priority]}
            </span>
          )}
          {isOverdue && <span className="badge badge-red">⚠️ OVERDUE</span>}
          {isDueSoon && <span className="badge badge-amber">⏰ Due in {minutesLeft}m</span>}
          {t.status === 'done' && <span className="badge badge-green">✓ Done</span>}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 11, color: 'var(--text3)', marginBottom: 10 }}>
        <span>👤 <b style={{ color: 'var(--text2)' }}>{t.assignedToName || t.assignedTo}</b></span>
        <span>📅 <b style={{ color: isOverdue ? 'var(--red)' : 'var(--text2)' }}>{dl || 'No deadline'}</b></span>
        {t.jobRef && <span>🔗 {t.jobRef}</span>}
        <span>By: {t.createdByName || t.createdBy}</span>
        {t.assignedRole && <span className="badge badge-blue">Role: {t.assignedRole}</span>}
      </div>

      <div className="flex gap-2">
        {t.status !== 'done' && onComplete && (
          <button className="btn btn-success btn-xs" onClick={() => onComplete(t)}>Mark Done</button>
        )}
        {canManage && (
          <button className="btn btn-danger btn-xs" onClick={() => onDelete(t)}>Delete</button>
        )}
      </div>
    </div>
  );
}

function NewTaskModal({ users, onClose, createdBy }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('normal');
  const [deadlineDate, setDeadlineDate] = useState('');
  const [deadlineTime, setDeadlineTime] = useState('');
  const [assignMode, setAssignMode] = useState('user');     // 'user' | 'role'
  const [assignedTo, setAssignedTo] = useState('');
  const [assignedRole, setAssignedRole] = useState('');
  const [jobRef, setJobRef] = useState('');
  const [busy, setBusy] = useState(false);

  const userList = Object.entries(users).map(([uid, u]) => ({ uid, ...u }));

  // CustomRolesInTaskAssign: gather every role string seen on users (built-in + custom).
  const allRoles = useMemo(() => {
    const set = new Set();
    userList.forEach(u => {
      if (u.role && u.role !== 'pending') set.add(u.role);
      if (u.customRole) set.add(u.customRole);
    });
    return [...set].sort();
  }, [userList]);

  const submit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return showToast('Title required', 'error');

    let assignedToFinal = null, assignedToName = null, assignedRoleFinal = null;
    if (assignMode === 'user') {
      if (!assignedTo) return showToast('Pick an assignee', 'error');
      const u = users[assignedTo];
      assignedToFinal = assignedTo;
      assignedToName = u?.name || u?.phone || assignedTo;
    } else {
      if (!assignedRole) return showToast('Pick a role', 'error');
      assignedRoleFinal = assignedRole;
      assignedToName = `(role) ${assignedRole}`;
    }

    setBusy(true);
    try {
      await dbApi.create('tasks', {
        title: title.trim(),
        description: description.trim(),
        priority,
        deadlineDate, deadlineTime,
        assignedTo: assignedToFinal,
        assignedToName,
        assignedRole: assignedRoleFinal,
        jobRef: jobRef.trim() || null,
        status: 'pending',
        createdBy,
        assignedAt: new Date().toISOString(),
      });
      showToast('Task created', 'success');
      onClose();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to create task', 'error');
    } finally { setBusy(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <form className="card" onSubmit={submit} style={{ maxWidth: 480, width: '100%', maxHeight: '90vh', overflow: 'auto' }}>
        <h3 style={{ marginBottom: 14 }}>+ New Task</h3>

        <div className="form-group">
          <label>Title *</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus required />
        </div>

        <div className="form-group">
          <label>Description</label>
          <textarea className="input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>

        <div className="flex gap-2">
          <div className="form-group" style={{ flex: 1 }}>
            <label>Priority</label>
            <select className="input" value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="normal">Normal</option>
              <option value="urgent">⚡ Urgent</option>
              <option value="most_urgent">🔴 Most Urgent</option>
            </select>
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label>Job ref</label>
            <input className="input" value={jobRef} onChange={(e) => setJobRef(e.target.value)} />
          </div>
        </div>

        <div className="flex gap-2">
          <div className="form-group" style={{ flex: 1 }}>
            <label>Deadline date</label>
            <input className="input" type="date" value={deadlineDate} onChange={(e) => setDeadlineDate(e.target.value)} />
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label>Time</label>
            <input className="input" type="time" value={deadlineTime} onChange={(e) => setDeadlineTime(e.target.value)} />
          </div>
        </div>

        <div className="form-group">
          <label>Assign to</label>
          <div className="flex gap-2 mb-2">
            <button type="button"
              className={`btn btn-sm ${assignMode === 'user' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setAssignMode('user')}>Specific user</button>
            <button type="button"
              className={`btn btn-sm ${assignMode === 'role' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setAssignMode('role')}>Role (custom roles supported)</button>
          </div>
          {assignMode === 'user' ? (
            <select className="input" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
              <option value="">-- choose --</option>
              {userList.map(u => (
                <option key={u.uid} value={u.uid}>
                  {(u.name || u.phone || u.uid)} {u.role ? `[${u.role}]` : ''}
                </option>
              ))}
            </select>
          ) : (
            <select className="input" value={assignedRole} onChange={(e) => setAssignedRole(e.target.value)}>
              <option value="">-- choose role --</option>
              {allRoles.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          )}
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
            Tip: role-based assignment notifies every user with that role or customRole.
          </div>
        </div>

        <div className="flex gap-2 mt-2">
          <button type="submit" className="btn btn-primary flex-1" disabled={busy}>
            {busy ? 'Saving…' : 'Create task'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
