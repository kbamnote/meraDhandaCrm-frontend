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
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { meApi } from '../../services/api';
import { socket } from '../../services/realtime';

// Which notification types are urgent enough to interrupt. Add more here if
// other events ever need the same treatment.
const POPUP_TYPES = ['job'];

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
  const [queue, setQueue] = useState([]);

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
      setQueue((q) => [...q, ...fresh]);
      chime();
    }
  }, []);

  useEffect(() => {
    check();
    const onChange = (msg) => {
      const path = String((msg && msg.path) || '');
      if (path.startsWith('mpw/tenantNotifications')) check();
    };
    socket.on('data:change', onChange);
    // Fallback for a dropped socket — the bell polls on the same cadence.
    const poll = setInterval(check, 60000);
    return () => { socket.off('data:change', onChange); clearInterval(poll); };
  }, [check]);

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

  const open = async () => {
    try { await meApi.readNotification(current.id); } catch (e) { /* non-fatal */ }
    close();
    if (current.link) navigate(current.link);
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
        <div style={{ fontSize: 40, lineHeight: 1 }}>🎨</div>
        <h3 style={{ margin: '10px 0 4px', fontSize: 18 }}>{current.title || 'New job'}</h3>
        {current.body && (
          <div style={{ color: 'var(--text2)', fontSize: 14, lineHeight: 1.5 }}>{current.body}</div>
        )}
        {queue.length > 1 && (
          <div style={{ color: 'var(--text3)', fontSize: 11, marginTop: 6 }}>
            +{queue.length - 1} more waiting
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button type="button" className="btn btn-primary" style={{ flex: 1 }} onClick={open}>
            Open now
          </button>
          <button type="button" className="btn btn-ghost" onClick={close}>Dismiss</button>
        </div>
      </div>
    </div>
  );
}
