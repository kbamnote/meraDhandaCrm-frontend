/**
 * The live-data shim (services/realtime.js onValue).
 *
 * A change that names its record fetches just that record and patches it in,
 * instead of re-downloading the whole collection; anything it can't patch
 * falls back to the full reload.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// test/setup.js stubs the socket with no-ops; this test needs one that
// actually delivers events to the listeners onValue registers.
vi.mock('socket.io-client', () => {
  const handlers = new Map();
  const socket = {
    on(ev, fn) { if (!handlers.has(ev)) handlers.set(ev, new Set()); handlers.get(ev).add(fn); return socket; },
    off(ev, fn) { handlers.get(ev)?.delete(fn); return socket; },
    emit() {}, connect() {}, disconnect() {}, connected: false, io: { on() {}, off() {} },
    listeners: (ev) => [...(handlers.get(ev) || [])],
  };
  return { io: () => socket, default: () => socket, Manager: class {} };
});

const server = { jobs: {} };
const calls = [];
let slowFull = 0;   // ms to delay full-collection loads (to test overlap)
vi.mock('../src/services/api.js', () => ({
  default: {
    get: vi.fn(async (url) => {
      calls.push(url);
      const m = /^\/db\/jobs(?:\/(.+))?$/.exec(url);
      if (!m) throw Object.assign(new Error('nope'), { response: { status: 500 } });
      if (!m[1]) {
        const snap = JSON.parse(JSON.stringify(server.jobs));
        if (slowFull) await new Promise((r) => setTimeout(r, slowFull));
        return { data: snap };
      }
      const rec = server.jobs[decodeURIComponent(m[1])];
      if (!rec) throw Object.assign(new Error('nf'), { response: { status: 404 } });
      return { data: { ...rec } };
    }),
  },
}));

const { onValue, ref, db, socket } = await import('../src/services/realtime.js');
const fire = (msg) => socket.listeners('data:change').forEach((l) => l(msg));
const tick = (ms = 120) => new Promise((r) => setTimeout(r, ms));

beforeEach(() => {
  slowFull = 0;
  calls.length = 0;
  server.jobs = { a: { id: 'a', stage: 'production' }, b: { id: 'b', stage: 'qc' } };
});

async function watch() {
  const seen = [];
  const off = onValue(ref(db, 'mpw/jobs'), (snap) => seen.push(snap.val()));
  await tick(10);
  calls.length = 0;
  return { seen, off };
}

describe('onValue live updates', () => {
  it('a change with an id fetches only that record and patches it in', async () => {
    const { seen, off } = await watch();
    server.jobs.a = { id: 'a', stage: 'production', stepProgress: { '0:s1': { done: true } } };
    fire({ path: 'mpw/jobs', id: 'a', op: 'update' });
    await tick();
    expect(calls).toEqual(['/db/jobs/a']);
    const last = seen.at(-1);
    expect(last.a.stepProgress['0:s1'].done).toBe(true);
    expect(last.b).toEqual({ id: 'b', stage: 'qc' });
    off();
  });

  it('an id in the path works the same; a deleted record (404) is removed', async () => {
    const { seen, off } = await watch();
    delete server.jobs.b;
    fire({ path: 'mpw/jobs/b' });
    await tick();
    expect(calls).toEqual(['/db/jobs/b']);
    expect('b' in seen.at(-1)).toBe(false);
    off();
  });

  it('a change without an id still reloads the whole collection', async () => {
    const { off } = await watch();
    fire({ path: 'mpw/jobs' });
    await tick();
    expect(calls).toEqual(['/db/jobs']);
    off();
  });

  it('a burst of changes is coalesced; one without an id makes it a full reload', async () => {
    const { off } = await watch();
    fire({ path: 'mpw/jobs', id: 'a' });
    fire({ path: 'mpw/jobs', id: 'b' });
    await tick();
    expect(calls.sort()).toEqual(['/db/jobs/a', '/db/jobs/b']);
    calls.length = 0;
    fire({ path: 'mpw/jobs', id: 'a' });
    fire({ path: 'mpw/jobs' });
    await tick();
    expect(calls).toEqual(['/db/jobs']);
    off();
  });

  it('a named change arriving while a full reload is downloading is not lost', async () => {
    const { seen, off } = await watch();
    slowFull = 200;
    fire({ path: 'mpw/jobs' });            // full reload starts (slow)
    await tick(80);
    server.jobs.a = { id: 'a', stage: 'qc' };  // then job a changes
    fire({ path: 'mpw/jobs', id: 'a' });
    await tick(600);
    // The second change triggers a fresh full reload rather than a patch that
    // the slow, older reload would overwrite.
    expect(calls).toEqual(['/db/jobs', '/db/jobs']);
    expect(seen.at(-1).a.stage).toBe('qc');
    off();
  });

  it('other collections are ignored', async () => {
    const { off } = await watch();
    fire({ path: 'mpw/invoices', id: 'x' });
    await tick();
    expect(calls).toEqual([]);
    off();
  });
});
