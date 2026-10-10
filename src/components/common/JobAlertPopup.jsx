/**
 * On-screen alert for time-critical job notifications (the designer pool being
 * the main one — a new design job is first-come-first-served, so a designer who
 * only notices it in the 🔔 bell later has already lost it).
 *
 * The server already targets these correctly (notify(..., { forRole: 'designer' })
 * writes a tenantNotifications row and emits `data:change`), and /me/notifications
 * only ever returns rows meant for this user — their id, their role, or a
 * tenant-wide broadcast. So this component just has to surface what arrives.
 *
 * Only notifications that land WHILE THE PAGE IS OPEN pop up: everything present
 * on mount is recorded as already-seen, so a refresh never replays old alerts.
 *
 * It also carries DELIVERY DEADLINE alerts, which work the other way round.
 * A job that is late stays late, so those ARE shown on arrival — otherwise an
 * alert broadcast overnight reaches an empty office and is never seen again.
 * Dismissals are remembered for the session instead, so it asks once.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { meApi, ordersApi } from '../../services/api';
import { socket } from '../../services/realtime';

// Which notification types are urgent enough to interrupt. Add more here if
// other events ever need the same treatment.
const POPUP_TYPES = ['job'];

// The socket event the deadline sweep pushes on.
const OVERDUE_EVENT = 'job:overdue';

// One dismissal per job per level, remembered for the session: a late job is
// still late after a refresh, but being asked about it on every page change
// is how an alert becomes something people click away without reading.
const DISMISS_KEY = 'md.overdueDismissed';
const loadDismissed = () => {
  try { return new Set(JSON.parse(sessionStorage.getItem(DISMISS_KEY) || '[]')); }
  catch (e) { return new Set(); }
};
const saveDismissed = (set) => {
  try { sessionStorage.setItem(DISMISS_KEY, JSON.stringify([...set])); }
  catch (e) { /* private window / blocked storage — it just asks again */ }
};

const lateText = (ms) => {
  const mins = Math.max(0, Math.round(Number(ms || 0) / 60000));
  if (mins < 60) return `${mins} min late`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m ? `${m}m ` : ''}late`;
};

// Short two-tone chime, synthesised so there's no audio asset to ship. Browsers
// block audio until the user has interacted with the page, hence the try/catch —
// a silent alert is fine, a crashed component is not.
function chime() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    [880, 1180].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02 + i * 0.14);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.30 + i * 0.14);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.14);
      osc.stop(ctx.currentTime + 0.36 + i * 0.14);
    });
    setTimeout(() => ctx.close().catch(() => {}), 1200);
  } catch (e) { /* audio blocked — the popup still shows */ }
}

export default function JobAlertPopup() {
  const navigate = useNavigate();
  const seen = useRef(null);          // ids already known; null until first load
  const dismissed = useRef(loadDismissed());
  const [queue, setQueue] = useState([]);

  // A late job is identified by WHICH job and HOW late: the hour-late
  // escalation is a second, separate thing to be told, not a repeat.
  const pushOverdue = useCallback((rows) => {
    const list = (Array.isArray(rows) ? rows : [rows]).filter(Boolean);
    const fresh = [];
    for (const r of list) {
      const key = `${r.id}:${r.level}`;
      if (dismissed.current.has(key)) continue;
      dismissed.current.add(key);
      fresh.push({ kind: 'overdue', key, job: r });
    }
    if (!fresh.length) return;
    saveDismissed(dismissed.current);
    setQueue((q) => [...q, ...fresh]);
    chime();
  }, []);

  const check = useCallback(async () => {
    let rows;
    try {
      rows = await meApi.notifications();
    } catch (e) { return; }
    if (!Array.isArray(rows)) return;

    // First run: treat everything that already exists as seen, so opening the
    // page doesn't fire alerts for yesterday's jobs.
    if (seen.current === null) {
      seen.current = new Set(rows.map((r) => r.id));
      return;
    }

    // Only alerts aimed at THIS user (their role, e.g. the designer pool, or
    // them personally). Tenant-wide broadcasts — like the "New job card" notice
    // every user receives — stay in the bell instead of interrupting everyone.
    const targeted = (r) => !!(r.forUser || r.forRole);
    const fresh = rows.filter((r) => POPUP_TYPES.includes(r.type) && targeted(r) && !r.read && !seen.current.has(r.id));
    fresh.forEach((r) => seen.current.add(r.id));
    if (fresh.length) {
      setQueue((q) => [...q, ...fresh.map((r) => ({ kind: 'notification', key: r.id, row: r }))]);
      chime();
    }
  }, []);

  // What is ALREADY late when this page opens. The server decides what this
  // user may be told about; we just show it.
  const checkOverdue = useCallback(async () => {
    try {
      const r = await ordersApi.overdue();
      pushOverdue((r && r.rows) || []);
    } catch (e) { /* the socket push still covers the live case */ }
  }, [pushOverdue]);

  useEffect(() => {
    check();
    checkOverdue();
    const onChange = (msg) => {
      const path = String((msg && msg.path) || '');
      if (path.startsWith('mpw/tenantNotifications')) check();
    };
    const onOverdue = (row) => pushOverdue(row);
    socket.on('data:change', onChange);
    socket.on(OVERDUE_EVENT, onOverdue);
    // Fallback for a dropped socket — the bell polls on the same cadence.
    const poll = setInterval(check, 60000);
    // Slower: a missed deadline push is caught here rather than by the user.
    const latePoll = setInterval(checkOverdue, 5 * 60000);
    return () => {
      socket.off('data:change', onChange);
      socket.off(OVERDUE_EVENT, onOverdue);
      clearInterval(poll); clearInterval(latePoll);
    };
  }, [check, checkOverdue, pushOverdue]);

  const current = queue[0];

  // Proper modal behaviour while one is showing: the page behind must not
  // scroll, and Escape should dismiss. Both effects sit above the early return
  // so hook order stays stable between renders.
  useEffect(() => {
    if (!current) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [current]);

  useEffect(() => {
    if (!current) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setQueue((q) => q.slice(1)); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current]);

  if (!current) return null;

  const close = () => setQueue((q) => q.slice(1));

  const isLate = current.kind === 'overdue';
  const job = current.job || {};
  const row = current.row || {};

  const open = async () => {
    if (isLate) { close(); navigate('/job-cards'); return; }
    try { await meApi.readNotification(row.id); } catch (e) { /* non-fatal */ }
    close();
    if (row.link) navigate(row.link);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed', inset: 0, zIndex: 4000,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
      onClick={close}
    >
      <style>{`
        @keyframes jobAlertIn {
          from { opacity: 0; transform: scale(0.92) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
      <div
        className="card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 420, padding: 20, textAlign: 'center',
          animation: 'jobAlertIn .18s ease-out',
          boxShadow: '0 18px 50px rgba(0,0,0,0.35)',
        }}
      >
        <div style={{ fontSize: 40, lineHeight: 1 }}>{isLate ? (job.level === 2 ? '🚨' : '⏰') : '🎨'}</div>
        <h3 style={{ margin: '10px 0 4px', fontSize: 18, color: isLate ? 'var(--red)' : undefined }}>
          {isLate
            ? (job.level === 2 ? 'Over an hour late' : 'Delivery time has passed')
            : (row.title || 'New job')}
        </h3>
        {isLate ? (
          <div style={{ color: 'var(--text2)', fontSize: 14, lineHeight: 1.5 }}>
            <div style={{ fontWeight: 700, color: 'var(--text)' }}>
              {job.jobNo || ''}{job.clientName ? ` · ${job.clientName}` : ''}
            </div>
            {job.work ? <div>{job.work}</div> : null}
            <div style={{ marginTop: 6 }}>
              Promised {job.deliveryDate || ''}{job.deliveryTime ? ` at ${job.deliveryTime}` : ''}
            </div>
            <div style={{ color: 'var(--red)', fontWeight: 700 }}>
              {lateText(job.lateMs)}{job.stage ? ` · still at ${job.stage}` : ''}
            </div>
          </div>
        ) : row.body ? (
          <div style={{ color: 'var(--text2)', fontSize: 14, lineHeight: 1.5 }}>{row.body}</div>
        ) : null}
        {queue.length > 1 && (
          <div style={{ color: 'var(--text3)', fontSize: 11, marginTop: 6 }}>
            +{queue.length - 1} more waiting
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button type="button" className="btn btn-primary" style={{ flex: 1 }} onClick={open}>
            {isLate ? 'Open job cards' : 'Open now'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={close}>Dismiss</button>
        </div>
      </div>
    </div>
  );
}
