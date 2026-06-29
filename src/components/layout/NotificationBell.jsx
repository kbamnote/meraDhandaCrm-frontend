import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { meApi } from '../../services/api';
import { socket } from '../../services/realtime';

// Turn an epoch-ms timestamp into a short relative string ("just now", "5m", "3h", "2d").
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

export default function NotificationBell() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const data = await meApi.notifications();
      setItems(Array.isArray(data) ? data : []);
    } catch {
      // network/auth error — keep whatever we already have
    }
  }, []);

  // Initial fetch + realtime + 60s fallback poll.
  useEffect(() => {
    load();

    const onChange = (msg) => {
      const path = String((msg && msg.path) || '');
      if (path.startsWith('mpw/tenantNotifications')) load();
    };
    socket.on('data:change', onChange);

    const interval = setInterval(load, 60000);

    return () => {
      socket.off('data:change', onChange);
      clearInterval(interval);
    };
  }, [load]);

  // Close the dropdown when clicking outside of it.
  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const unread = items.filter((n) => !n.read).length;

  const handleClickItem = async (n) => {
    // Optimistically mark read so the UI updates immediately.
    if (!n.read) {
      setItems((prev) => prev.map((it) => (it.id === n.id ? { ...it, read: true } : it)));
      try {
        await meApi.readNotification(n.id);
      } catch {
        /* ignore — a later refetch corrects state */
      }
    }
    if (n.link) {
      setOpen(false);
      navigate(n.link);
    }
  };

  const handleMarkAll = async () => {
    setItems((prev) => prev.map((it) => ({ ...it, read: true })));
    try {
      await meApi.readAllNotifications();
    } catch {
      /* ignore — a later refetch corrects state */
    }
  };

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button
        type="button"
        className="btn btn-ghost"
        aria-label="Notifications"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        style={{ position: 'relative', padding: '6px 8px', fontSize: '18px', lineHeight: 1 }}
      >
        <span role="img" aria-hidden="true">🔔</span>
        {unread > 0 && (
          <span
            className="badge badge-red"
            style={{
              position: 'absolute',
              top: '-2px',
              right: '-2px',
              minWidth: '16px',
              height: '16px',
              padding: '0 4px',
              borderRadius: '999px',
              fontSize: '10px',
              lineHeight: '16px',
              textAlign: 'center',
            }}
          >
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="card"
          role="menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: '320px',
            maxHeight: '420px',
            overflowY: 'auto',
            zIndex: 1000,
            padding: 0,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 12px',
              borderBottom: '1px solid var(--border)',
              position: 'sticky',
              top: 0,
              background: 'var(--surface)',
            }}
          >
            <strong style={{ color: 'var(--text)' }}>Notifications</strong>
            {unread > 0 && (
              <button type="button" className="btn btn-ghost btn-xs" onClick={handleMarkAll}>
                Mark all read
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--text3)' }}>
              No notifications yet.
            </div>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => handleClickItem(n)}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      border: 'none',
                      borderBottom: '1px solid var(--border)',
                      padding: '10px 12px',
                      cursor: n.link ? 'pointer' : 'default',
                      background: n.read ? 'transparent' : 'var(--surface2)',
                      color: 'var(--text)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'baseline',
                        justifyContent: 'space-between',
                        gap: '8px',
                      }}
                    >
                      <span
                        style={{
                          fontWeight: n.read ? 500 : 700,
                          color: 'var(--text)',
                          flex: 1,
                          minWidth: 0,
                        }}
                      >
                        {n.title}
                      </span>
                      {!n.read && (
                        <span
                          aria-hidden="true"
                          style={{
                            flex: '0 0 auto',
                            width: '8px',
                            height: '8px',
                            borderRadius: '999px',
                            background: 'var(--blue)',
                            marginTop: '4px',
                          }}
                        />
                      )}
                    </div>
                    {n.body && (
                      <div style={{ color: 'var(--text2)', fontSize: '13px', marginTop: '2px' }}>
                        {n.body}
                      </div>
                    )}
                    <div style={{ color: 'var(--text3)', fontSize: '11px', marginTop: '4px' }}>
                      {relativeTime(n.ts)}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
