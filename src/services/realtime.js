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
 * When a whole collection is being watched and the change names the record
 * (`data:change` carries { id }, or the path ends in it), only that record is
 * fetched and patched in: one small request instead of re-downloading the
 * collection (for jobs, every job ever created).
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
  // Don't connect immediately on import — authSocket() connects after login so
  // unauthenticated pages (Login, Signup, Pay link) don't open a socket at all.
  autoConnect: false,
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

// More changed records than this in one burst → reload the collection instead.
const MAX_PATCH = 15;

export function onValue(refObj, cb) {
  const path = refObj && refObj.path ? refObj.path : String(refObj);
  const { collection, id, clean } = parsePath(path);
  let current = null;
  let active = true;
  let seq = 0;          // guards against out-of-order responses
  let pendingTimer = null;

  let fullInFlight = false;  // a full load has been sent and not yet applied

  async function doLoad() {
    const mySeq = ++seq;
    fullInFlight = true;
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
    fullInFlight = false;
    current = data;
    cb({ val: () => current, exists: () => current != null });
  }

  // Coalesce bursts of change events into a single fetch. Changes that name a
  // record collect their ids; any change that doesn't forces a full reload.
  let pendingIds = new Set();
  let needFull = false;
  function scheduleLoad(changedId) {
    if (changedId && !id) pendingIds.add(changedId);
    else needFull = true;
    if (pendingTimer) return;
    pendingTimer = setTimeout(flush, 60);
  }

  async function flush() {
    pendingTimer = null;
    const ids = [...pendingIds];
    const full = needFull;
    pendingIds = new Set();
    needFull = false;
    // A full reload is cheaper than many single fetches, and needed when we
    // have nothing yet to patch.
    // A full load already on its way was sent before these changes and may not
    // include them; one sent now will.
    if (full || fullInFlight || !ids.length || ids.length > MAX_PATCH || !current || typeof current !== 'object') {
      doLoad();
      return;
    }
    // Not a new seq: a full load issued while this patch is in flight was sent
    // after the change, so it already has it and this patch is dropped.
    const mySeq = seq;
    const results = await Promise.all(ids.map(async (rid) => {
      try {
        const res = await api.get(`/db/${collection}/${encodeURIComponent(rid)}`);
        return [rid, res.data];
      } catch (e) {
        // 404 = deleted; anything else = unknown, so fall back to a reload.
        return [rid, e && e.response && e.response.status === 404 ? null : undefined];
      }
    }));
    if (!active || mySeq !== seq) return;
    if (results.some(([, d]) => d === undefined)) { doLoad(); return; }
    const next = { ...current };
    for (const [rid, d] of results) {
      if (d == null) delete next[rid]; else next[rid] = d;
    }
    current = next;
    cb({ val: () => current, exists: () => current != null });
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
      // The changed record: sent as `id`, or the path's second segment.
      const parts = cp.split('/');
      const changedId = (msg && msg.id) || (parts[0] === collection && parts.length === 2 ? parts[1] : null);
      scheduleLoad(changedId ? String(changedId) : null);
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
// change events). Safe to call repeatedly. Also opens the connection if it was
// deferred (autoConnect: false) — this is the ONLY place connect() is called so
// unauthenticated pages (Login, Signup, /pay) never open a socket at all.
export function authSocket(token) {
  try {
    if (!socket.connected) socket.connect();
    socket.emit('auth', { token });
  } catch { /* ignore */ }
}
