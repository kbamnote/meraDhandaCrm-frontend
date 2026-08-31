/**
 * Smoke-test environment.
 *
 * The point of these tests is to catch RENDER-TIME crashes — the class of bug
 * that shipped three times: a name resolved from the wrong scope, a const read
 * before its declaration, and a missing translation dereferenced. All three
 * parse, build green, and only fail when React actually renders the component.
 *
 * So the harness stubs everything a screen touches at module load (sockets,
 * network, storage) and lets the component itself run for real. Nothing here
 * should mock the code under test — only the outside world.
 */
import { vi, afterEach, expect } from 'vitest';
import { cleanup } from '@testing-library/react';

// ── Socket.IO ────────────────────────────────────────────────────────────────
// services/realtime.js opens a socket at import time. In jsdom that would try a
// real connection and hang the suite.
vi.mock('socket.io-client', () => {
  const noop = () => {};
  const socket = {
    on: noop, off: noop, emit: noop, connect: noop, disconnect: noop,
    once: noop, removeAllListeners: noop, connected: false, id: 'test-socket',
    io: { on: noop, off: noop },
  };
  return { io: () => socket, default: () => socket, Manager: class {} };
});

// ── Network ──────────────────────────────────────────────────────────────────
// Every request resolves to an empty-but-well-shaped payload. A screen must
// render correctly BEFORE its data arrives — that first paint is exactly where
// the crashes happened.
vi.mock('axios', () => {
  const empty = { data: [] };
  const client = {
    get: vi.fn(() => Promise.resolve(empty)),
    post: vi.fn(() => Promise.resolve(empty)),
    put: vi.fn(() => Promise.resolve(empty)),
    patch: vi.fn(() => Promise.resolve(empty)),
    delete: vi.fn(() => Promise.resolve(empty)),
    interceptors: { request: { use: () => {} }, response: { use: () => {} } },
    defaults: { headers: { common: {} } },
  };
  return { default: { create: () => client, ...client } };
});

// jsdom implements neither, and several screens call them on mount.
window.matchMedia = window.matchMedia || ((query) => ({
  matches: false, media: query, onchange: null,
  addListener: () => {}, removeListener: () => {},
  addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
}));
window.scrollTo = window.scrollTo || (() => {});
global.ResizeObserver = global.ResizeObserver || class {
  observe() {} unobserve() {} disconnect() {}
};
if (!window.URL.createObjectURL) window.URL.createObjectURL = () => 'blob:test';
if (!window.URL.revokeObjectURL) window.URL.revokeObjectURL = () => {};

// ── Fail loudly on a React render error ──────────────────────────────────────
// React catches errors during render and re-throws them asynchronously, so a
// crashed component can otherwise leave the test passing with only a console
// message. Collect them and let each test assert none occurred.
const renderErrors = [];
export const takeRenderErrors = () => renderErrors.splice(0, renderErrors.length);

const realError = console.error;
console.error = (...args) => {
  const text = args.map((a) => (a && a.message) || String(a)).join(' ');
  // React logs the component stack separately; only record the real failure.
  if (/Error|Cannot |undefined is not|is not a function|before initialization/i.test(text)) {
    renderErrors.push(text);
  }
  realError(...args);
};

afterEach(() => {
  cleanup();
  renderErrors.length = 0;
});

expect.extend({});
