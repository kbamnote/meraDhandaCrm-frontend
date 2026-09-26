/**
 * Job counts on the sidebar.
 *
 * The point is seeing that eleven jobs are waiting in Designing without opening
 * the page, so what matters is: the right number against the right row, nothing
 * against rows it would mislead, and no badge at all on an empty queue. Also
 * pinned: the sidebar asks the server to COUNT rather than downloading every job
 * — it is mounted on every screen, so that distinction is the difference between
 * one small query and the whole jobs collection on every page load.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, act, fireEvent } from '@testing-library/react';
import { renderScreen } from './renderScreen.jsx';

const calls = { stageCounts: 0, dbGets: [] };
let counts = {
  byStage: { enquiry: 2, designer: 11, jobsetter: 1, production: 4, qc: 1, dispatch: 1, hold: 3 },
  active: 20, total: 26,
};
const handlers = new Set();

vi.mock('../src/services/realtime.js', () => ({
  db: { __backend: 'test' },
  socket: {
    on: (evt, fn) => { if (evt === 'data:change') handlers.add(fn); },
    off: (evt, fn) => handlers.delete(fn),
    emit() {},
  },
  ref: (_db, path) => ({ path }),
  onValue: (_r, cb) => { cb({ val: () => ({}) }); return () => {}; },
  authSocket: () => {},
}));

vi.mock('../src/services/api.js', async () => {
  const actual = await vi.importActual('../src/services/api.js');
  return {
    ...actual,
    default: { ...actual.default, get: vi.fn(async (url) => { calls.dbGets.push(url); return { data: {} }; }) },
    ordersApi: {
      ...actual.ordersApi,
      stageCounts: vi.fn(async () => { calls.stageCounts += 1; return counts; }),
    },
  };
});

const { default: Sidebar } = await import('../src/components/layout/Sidebar.jsx');

const badge = (to) => screen.queryByTestId(`nav-count-${to}`);
const row = (label) => screen.getByText(label).closest('a');

// Sections start collapsed, so the rows only exist once their heading is open.
const openSections = () => {
  ['Workspace', 'Design & Production'].forEach((title) => {
    const head = screen.queryByText(title);
    if (head) fireEvent.click(head);
  });
};
const render = async () => {
  renderScreen(Sidebar, { props: { open: true, onClose: () => {} } });
  openSections();
};

beforeEach(() => { calls.stageCounts = 0; calls.dbGets.length = 0; handlers.clear(); });

describe('the sidebar', () => {
  it('shows how many jobs are at each stage', async () => {
    await render();
    await waitFor(() => expect(badge('/designers')).toBeTruthy());
    expect(badge('/designers').textContent).toBe('11');
    expect(badge('/production').textContent).toBe('4');
    expect(badge('/jobsetter').textContent).toBe('1');
    expect(badge('/qc').textContent).toBe('1');
    expect(badge('/dispatch').textContent).toBe('1');
    expect(badge('/hold').textContent).toBe('3');
    // Job Cards carries everything still in progress, not the total ever raised.
    expect(badge('/job-cards').textContent).toBe('20');
  });

  it('puts the number inside the row it belongs to', async () => {
    await render();
    await waitFor(() => expect(badge('/production')).toBeTruthy());
    expect(row('🏭 Production').contains(badge('/production'))).toBe(true);
    expect(row('🏭 Production').textContent).toContain('4');
  });

  it('leaves an empty queue unmarked', async () => {
    counts = { byStage: { designer: 0, production: 2 }, active: 2, total: 9 };
    await render();
    await waitFor(() => expect(badge('/production')).toBeTruthy());
    expect(badge('/designers'), 'no grey 0 on every idle row').toBeNull();
    counts = {
      byStage: { enquiry: 2, designer: 11, jobsetter: 1, production: 4, qc: 1, dispatch: 1, hold: 3 },
      active: 20, total: 26,
    };
  });

  it('carries no number on rows that are not job queues', async () => {
    await render();
    await waitFor(() => expect(badge('/production')).toBeTruthy());
    expect(badge('/accounting/items')).toBeNull();
    expect(badge('/profile')).toBeNull();
    expect(badge('/machines')).toBeNull();
  });

  it('counts on the server instead of downloading the jobs', async () => {
    await render();
    await waitFor(() => expect(calls.stageCounts).toBe(1));
    expect(calls.dbGets.filter((u) => String(u).includes('/db/jobs')),
      'the whole jobs collection must not be pulled to draw a badge').toEqual([]);
  });

  it('re-counts when a job changes, once per burst', async () => {
    vi.useFakeTimers();
    try {
      renderScreen(Sidebar, { props: { open: true, onClose: () => {} } });
      await vi.waitFor(() => expect(calls.stageCounts).toBe(1));
      // A stage move fires several changes at once.
      act(() => { handlers.forEach((h) => { h({ path: 'mpw/jobs' }); h({ path: 'mpw/jobs/j1' }); }); });
      act(() => { vi.advanceTimersByTime(500); });
      await vi.waitFor(() => expect(calls.stageCounts).toBe(2));
    } finally { vi.useRealTimers(); }
  });

  it('ignores changes to other collections', async () => {
    vi.useFakeTimers();
    try {
      renderScreen(Sidebar, { props: { open: true, onClose: () => {} } });
      await vi.waitFor(() => expect(calls.stageCounts).toBe(1));
      act(() => { handlers.forEach((h) => h({ path: 'mpw/invoices' })); });
      act(() => { vi.advanceTimersByTime(500); });
      expect(calls.stageCounts).toBe(1);
    } finally { vi.useRealTimers(); }
  });
});
