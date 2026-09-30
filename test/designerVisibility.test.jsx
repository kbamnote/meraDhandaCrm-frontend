/**
 * Why a designer's job list looks the way it does.
 *
 * The reported problem: one designer saw no new jobs while her colleagues did,
 * and nothing on her screen said why. There are two reasons by design — she is
 * on leave, or she passed those jobs — and both are now stated, with a way back
 * from a pass.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent, within } from '@testing-library/react';
import { renderScreen, OWNER } from './renderScreen.jsx';

let feed = [];
let status = { onLeave: false, pool: 0, passed: 0, mine: 0 };
let passedJobs = [];
const unpassed = [];

vi.mock('../src/services/realtime.js', () => ({
  db: { __backend: 'test' }, socket: { on() {}, off() {}, emit() {} },
  ref: (_db, path) => ({ path }), onValue: (_r, cb) => { cb({ val: () => ({}) }); return () => {}; },
  authSocket: () => {},
}));
vi.mock('../src/services/api.js', async () => {
  const actual = await vi.importActual('../src/services/api.js');
  return {
    ...actual,
    ordersApi: {
      ...actual.ordersApi,
      designerFeed: vi.fn(async () => feed),
      designerStatus: vi.fn(async () => status),
      designerPassed: vi.fn(async () => passedJobs),
      designerUnpass: vi.fn(async (id) => { unpassed.push(id); return { unpassed: true }; }),
      designerLeave: vi.fn(async () => ({})),
    },
  };
});

const { default: DesignerPanelPage } = await import('../src/pages/DesignerPanelPage.jsx');

const POOL_JOB = { id: 'j1', jobNo: 'JOB-1', work: 'Wedding cards', clientName: 'Sharma', stage: 'designer' };
const PASSED_JOB = { id: 'j2', jobNo: 'JOB-2', work: 'Flyers', clientName: 'Mehta', stage: 'designer' };

beforeEach(() => {
  unpassed.length = 0;
  feed = [POOL_JOB];
  status = { onLeave: false, pool: 1, passed: 0, mine: 0 };
  passedJobs = [];
});

describe('the designer panel', () => {
  it('offers the jobs waiting in the pool', async () => {
    renderScreen(DesignerPanelPage, { auth: OWNER });
    await waitFor(() => expect(screen.getByText('JOB-1')).toBeTruthy());
    expect(screen.queryByTestId('on-leave-msg')).toBeNull();
  });

  it('says so when the list is empty because the designer is on leave', async () => {
    // This is the case that made one designer's screen look broken: her
    // colleagues had jobs, she had none, and nothing said why.
    feed = [];
    status = { onLeave: true, pool: 4, passed: 0, mine: 0 };
    renderScreen(DesignerPanelPage, { auth: OWNER });
    const msg = await screen.findByTestId('on-leave-msg');
    expect(msg.textContent).toMatch(/on leave|leave par/i);
    // …and how much work she is missing, so it is obvious this matters.
    expect(msg.textContent).toContain('4');
  });

  it('follows the server, not the profile it loaded with', async () => {
    // An admin can put someone on leave while the panel is open.
    status = { onLeave: true, pool: 2, passed: 0, mine: 0 };
    feed = [];
    renderScreen(DesignerPanelPage, { auth: OWNER });
    await waitFor(() => expect(screen.getByTestId('on-leave-msg')).toBeTruthy());
  });

  it('lists the jobs hidden only because they were passed', async () => {
    passedJobs = [PASSED_JOB];
    status = { onLeave: false, pool: 1, passed: 1, mine: 0 };
    renderScreen(DesignerPanelPage, { auth: OWNER });
    await waitFor(() => expect(screen.getAllByTestId('passed-job').length).toBe(1));
    const card = screen.getAllByTestId('passed-job')[0];
    expect(card.textContent).toContain('JOB-2');
    expect(screen.getByText(/hidden from your list|nahi dikhte/i)).toBeTruthy();
  });

  it('a passed job can be taken another look at', async () => {
    passedJobs = [PASSED_JOB];
    renderScreen(DesignerPanelPage, { auth: OWNER });
    await waitFor(() => expect(screen.getAllByTestId('passed-job').length).toBe(1));
    fireEvent.click(within(screen.getAllByTestId('passed-job')[0]).getByTestId('unpass-btn'));
    await waitFor(() => expect(unpassed).toEqual(['j2']));
  });

  it('shows no passed section when nothing was passed', async () => {
    renderScreen(DesignerPanelPage, { auth: OWNER });
    await waitFor(() => expect(screen.getByText('JOB-1')).toBeTruthy());
    expect(screen.queryAllByTestId('passed-job')).toHaveLength(0);
    expect(screen.queryByTestId('unpass-btn')).toBeNull();
  });
});
