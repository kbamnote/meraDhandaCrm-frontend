/**
 * Live on-screen popup stack for in-app notifications (rendered by
 * NotificationBell, mounted in the topbar so it follows every route).
 *
 * Purely presentational: receives the notifications to surface, calls
 * onOpen(notification) when the user clicks one (navigate to its link + mark
 * read) and onClose(id) to dismiss. Each popup auto-dismisses after
 * AUTO_DISMISS_MS.
 */
import { useEffect } from 'react';

const AUTO_DISMISS_MS = 8000;

function relativeTime(ts) {
  if (!ts) return '';
  const diff = Date.now() - Number(ts);
  if (Number.isNaN(diff)) return '';
  const s = Math.max(0, Math.floor(diff / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  try {
    return new Date(Number(ts)).toLocaleDateString();
  } catch {
    return `${d}d ago`;
  }
}

export default function NotificationPopups({ items, onOpen, onClose }) {
  if (!items.length) return null;
  return (
    <div className="notif-popups" role="region" aria-label="Notifications">
      {items.map((n) => (
        <NotificationPopup key={n.id} n={n} onOpen={onOpen} onClose={onClose} />
      ))}
    </div>
  );
}

function NotificationPopup({ n, onOpen, onClose }) {
  // Auto-dismiss per popup (timer keyed to the notification id).
  useEffect(() => {
    const t = setTimeout(() => onClose(n.id), AUTO_DISMISS_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n.id]);

  return (
    <div
      className="notif-popup"
      role="button"
      tabIndex={0}
      onClick={() => onOpen(n)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(n);
        }
      }}
    >
      <span className="notif-popup-accent" aria-hidden="true" />
      <span className="notif-popup-text">
        <strong>{n.title || 'Notification'}</strong>
        {n.body && <span className="notif-popup-body">{n.body}</span>}
        <span className="notif-popup-time">{relativeTime(n.ts)}</span>
      </span>
      <button
        type="button"
        className="notif-popup-close"
        aria-label="Dismiss notification"
        onClick={(e) => {
          e.stopPropagation();
          onClose(n.id);
        }}
      >
        ✕
      </button>
    </div>
  );
}
