/**
 * Tenant owner/admin → Send Notification to their own staff. Composes an
 * announcement and delivers it three ways at once (handled server-side by
 * services/notify): the 🔔 bell, a live Socket.IO update, and an Expo push to
 * any staff phone that has registered a token.
 *
 * Target is everyone, one role, or one person. Roles are derived from the staff
 * actually on the team rather than hard-coded, so custom setups still work.
 */
import { useEffect, useState, useCallback } from 'react';
import { tenantApi, dbApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { showToast } from '../components/common/toast';

const ADMIN_ROLES = ['owner', 'admin', 'superadmin'];

function relativeTime(ts) {
  if (!ts) return '';
  const s = Math.max(0, Math.floor((Date.now() - Number(ts)) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  try { return new Date(Number(ts)).toLocaleDateString(); } catch { return `${d}d ago`; }
}

export default function SendNotificationPage() {
  const { profile } = useAuth();
  const isAdmin = ADMIN_ROLES.includes(profile?.role);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [mode, setMode] = useState('all');   // 'all' | 'role' | 'user'
  const [role, setRole] = useState('');
  const [userId, setUserId] = useState('');
  const [staff, setStaff] = useState([]);
  const [sent, setSent] = useState([]);
  const [busy, setBusy] = useState(false);

  const loadSent = useCallback(() => {
    tenantApi.sentNotifications()
      .then((r) => setSent(Array.isArray(r) ? r : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    dbApi.list('users')
      .then((map) => {
        const rows = map && typeof map === 'object' ? Object.entries(map).map(([id, u]) => ({ id, ...u })) : [];
        setStaff(rows.filter((u) => u.name || u.email));
      })
      .catch(() => {});
    loadSent();
    // `loadSent` is stable (useCallback []); listing staff should run once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="card" style={{ maxWidth: 480, margin: '40px auto', textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>🔒</div>
        <h3>Owners and admins only</h3>
        <div style={{ color: 'var(--text2)', fontSize: 14 }}>Ask an admin if you need to send announcements.</div>
      </div>
    );
  }

  const roles = [...new Set(staff.map((u) => u.role).filter(Boolean))].sort();
  const countFor = () => {
    if (mode === 'user') return userId ? 1 : 0;
    if (mode === 'role') return staff.filter((u) => u.role === role).length;
    return staff.length;
  };

  const send = async () => {
    if (!title.trim()) return showToast('Enter a title', 'error');
    if (mode === 'role' && !role) return showToast('Pick a role', 'error');
    if (mode === 'user' && !userId) return showToast('Pick a staff member', 'error');
    setBusy(true);
    try {
      const r = await tenantApi.notify({
        title: title.trim(),
        body: body.trim(),
        ...(mode === 'role' ? { forRole: role } : {}),
        ...(mode === 'user' ? { forUser: userId } : {}),
      });
      showToast(`Sent to ${r.recipients} ${r.recipients === 1 ? 'person' : 'people'}`, 'success');
      setTitle(''); setBody(''); setMode('all'); setRole(''); setUserId('');
      loadSent();
    } catch (e) {
      showToast(e.response?.data?.error || 'Could not send', 'error');
    } finally { setBusy(false); }
  };

  const audienceLabel = (n) => {
    if (n.forUser) return staff.find((u) => u.id === n.forUser)?.name || 'One person';
    if (n.forRole) return `Role: ${n.forRole}`;
    return 'All staff';
  };

  return (
    <div data-legacy-id="page-send-notification">
      <div className="mb-4">
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>🔔 Send Notification</h2>
        <div style={{ fontSize: 13, color: 'var(--text2)' }}>Send an announcement to your team</div>
      </div>

      <div className="card" style={{ maxWidth: 560 }}>
        <div className="form-group">
          <label>Title</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)}
                 placeholder="e.g. Holiday on Friday" autoFocus />
        </div>
        <div className="form-group">
          <label>Message</label>
          <textarea className="input" rows={4} value={body} onChange={(e) => setBody(e.target.value)}
                    placeholder="What do you want to tell your team?" />
        </div>

        <div className="form-group">
          <label>Send to</label>
          <div className="flex gap-2" style={{ marginBottom: 8, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="radio" checked={mode === 'all'} onChange={() => setMode('all')} /> All staff ({staff.length})
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="radio" checked={mode === 'role'} onChange={() => setMode('role')} /> By role
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="radio" checked={mode === 'user'} onChange={() => setMode('user')} /> One person
            </label>
          </div>

          {mode === 'role' && (
            <select className="input" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="">Choose a role…</option>
              {roles.map((r) => (
                <option key={r} value={r}>{r} ({staff.filter((u) => u.role === r).length})</option>
              ))}
            </select>
          )}

          {mode === 'user' && (
            <select className="input" value={userId} onChange={(e) => setUserId(e.target.value)}>
              <option value="">Choose a staff member…</option>
              {staff.slice().sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
                .map((u) => <option key={u.id} value={u.id}>{u.name || u.email} — {u.role || 'staff'}</option>)}
            </select>
          )}
        </div>

        <button className="btn btn-primary" onClick={send} disabled={busy}>
          {busy ? 'Sending…' : `🔔 Send to ${countFor()} ${countFor() === 1 ? 'person' : 'people'}`}
        </button>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>
          Lands in their 🔔 bell instantly, and as a phone notification for staff using the mobile app.
        </div>
      </div>

      <div className="card" style={{ maxWidth: 560, marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <strong>Recently sent</strong>
          <button type="button" className="btn btn-ghost btn-xs" onClick={loadSent}>↻ Refresh</button>
        </div>
        {!sent.length ? (
          <div style={{ color: 'var(--text3)', fontSize: 13 }}>Nothing sent yet.</div>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {sent.map((n) => (
              <li key={n.id} style={{ borderBottom: '1px solid var(--border)', padding: '8px 0' }}>
                <div style={{ fontWeight: 600 }}>{n.title}</div>
                {n.body && <div style={{ color: 'var(--text2)', fontSize: 13, marginTop: 2 }}>{n.body}</div>}
                <div style={{ color: 'var(--text3)', fontSize: 11, marginTop: 4 }}>
                  {audienceLabel(n)} · {relativeTime(n.ts)} · read by {n.readCount}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
