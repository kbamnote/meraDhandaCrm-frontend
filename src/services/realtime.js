/**
 * Realtime data shim — Socket.IO + REST, replacing the Firebase client SDK.
 *
 * Keeps the SAME `ref()` / `onValue()` API the pages already use, so porting a
 * page is a one-line import change:
 *
 *     // before
 *     import { ref, onValue } from 'firebase/database';
 *     import { db } from '../services/firebase';
 *     // after
 *     import { ref, onValue, db } from '../services/realtime';
 *
 * onValue() loads the current value over the authenticated REST API, then
 * re-loads whenever the server emits a `data:change` for an overlapping path.
 * The callback receives a Firebase-like snapshot: { val(), exists() }.
 *
 * NOTE: this shim only serves the generic /api/db/<collection> collections.
 * Chat (mpw/chat/*) is REST-only — use chatApi (services/api.js), NOT ref()/onValue().
 */
import { io } from 'socket.io-client';
import api from './api';

// Default: same origin (Vite proxies /socket.io to the backend in dev).
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || undefined;

export const socket = io(SOCKET_URL, {
  autoConnect: true,
  transports: ['websocket', 'polling'],
});

// Marker object so existing `ref(db, path)` calls still read naturally.
export const db = { __backend: 'mongo-rest' };

export function ref(_db, path) {
  // Supports both ref(db, 'mpw/x') and ref('mpw/x')
  const p = typeof _db === 'string' ? _db : path;
  return { path: String(p) };
}

function parsePath(path) {
  const clean = String(path).replace(/^\/+|\/+$/g, '').replace(/^mpw\//, '');
  const parts = clean.split('/');
  return { collection: parts[0], id: parts[1] || null, clean };
}

export function onValue(refObj, cb) {
  const path = refObj && refObj.path ? refObj.path : String(refObj);
  const { collection, id, clean } = parsePath(path);
  let current = null;
  let active = true;
  let seq = 0;          // guards against out-of-order responses
  let pendingTimer = null;

  async function doLoad() {
    const mySeq = ++seq;
    let data = null;
    try {
      const url = id ? `/db/${collection}/${id}` : `/db/${collection}`;
      const res = await api.get(url);
      data = res.data;
    } catch {
      data = null; // not found / unauthorized → null, like Firebase
    }
    // Ignore a stale response if a newer load was issued meanwhile.
    if (!active || mySeq !== seq) return;
    current = data;
    cb({ val: () => current, exists: () => current != null });
  }

  // Coalesce bursts of change events into a single fetch.
  function scheduleLoad() {
    if (pendingTimer) return;
    pendingTimer = setTimeout(() => { pendingTimer = null; doLoad(); }, 60);
  }

  doLoad(); // initial value, immediately

  const onChange = (msg) => {
    const cp = String((msg && msg.path) || '').replace(/^mpw\//, '');
    if (
      cp === clean ||
      cp === collection ||
      cp.startsWith(clean + '/') ||
      clean.startsWith(cp + '/')
    ) {
      scheduleLoad();
    }
  };
  socket.on('data:change', onChange);

  // Re-sync on reconnect — changes emitted while disconnected are otherwise lost.
  const onReconnect = () => { if (active) doLoad(); };
  socket.on('connect', onReconnect);

  // Unsubscribe (matches the function Firebase's onValue returns).
  return () => {
    active = false;
    if (pendingTimer) clearTimeout(pendingTimer);
    socket.off('data:change', onChange);
    socket.off('connect', onReconnect);
  };
}

// Let the socket announce the logged-in user (optional; not required to receive
// change events). Safe to call repeatedly.
export function authSocket(token) {
  try { socket.emit('auth', { token }); } catch { /* ignore */ }
}
