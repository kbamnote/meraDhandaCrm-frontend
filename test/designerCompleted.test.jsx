/**
 * A designer's finished work, and how long each job took.
 *
 * The number is the point, so the maths is pinned hard:
 *   * time WORKED excludes the stretches spent waiting on the client — a
 *     designer is not answerable for the client's delay, and counting it would
 *     make a 40-minute design look like a two-day one
 *   * jobs finished before the server stamped these figures still show a time,
 *     reconstructed from the claim and the stage history, instead of a blank
 *   * only this designer's finished jobs are listed, and a job still being
 *     designed is not among them
 *   * the average ignores jobs whose time is unknown rather than counting them
 *     as zero, which would quietly drag it down
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent, within } from '@testing-library/react';
import { renderScreen, OWNER } from './renderScreen.jsx';

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const T0 = Date.parse('2026-09-20T09:00:00Z');

let feed = [];
vi.mock('../src/services/realtime.js', () => ({
  db: { __backend: 'test' }, socket: { on() {}, off() {}, emit() {} },
  ref: (_db, path) => ({ path }), onValue: (_r, cb) => { cb({ val: () => ({}) }); return () => {}; },
  authSocket: () => {},
}));
vi.mock('../src/services/api.js', async () => {
  const actual = await vi.importActual('../src/services/api.js');
  return {
    ...actual,
    ordersApi: { ...actual.ordersApi, designerFeed: vi.fn(async () => feed) },
  };
});

const { designDuration, formatDuration, averageWorkMs, designCompletedAt } = await import('../src/utils/designTime.js');
const { default: DesignerPanelPage } = await import('../src/pages/DesignerPanelPage.jsx');

const ME = 'u1'; // renderScreen's OWNER profile id

describe('formatDuration', () => {
  it('reads the way a person would say it', () => {
    expect(formatDuration(45 * MIN)).toBe('45m');
    expect(formatDuration(2 * HOUR + 15 * MIN)).toBe('2h 15m');
    expect(formatDuration(3 * DAY + 4 * HOUR)).toBe('3d 4h');
    expect(formatDuration(30 * 1000), 'not "0m", which looks broken').toBe('under a minute');
    expect(formatDuration(null)).toBe('—');
  });
});

describe('designDuration', () => {
  const stamped = {
    designerClaimedAt: T0, designCompletedAt: T0 + 5 * HOUR,
    designElapsedMs: 5 * HOUR, designWorkMs: 2 * HOUR, designPausedTotal: 3 * HOUR,
  };

  it('uses the figures the server stamped', () => {
    const d = designDuration(stamped);
    expect(d.workMs).toBe(2 * HOUR);
    expect(d.elapsedMs).toBe(5 * HOUR);
    expect(d.pausedMs, 'the three hours waiting on the client').toBe(3 * HOUR);
  });

  it('reconstructs a job finished before those figures existed', () => {
    // Claimed, waited an hour on the client, moved on after three.
    const old = {
      designerClaimedAt: T0,
      designPausedTotal: HOUR,
      stageHistory: [
        { from: 'designer', stage: 'designer', at: T0, note: 'Designer accepted' },
        { from: 'designer', stage: 'jobsetter', at: T0 + 3 * HOUR, note: 'Design ready' },
      ],
    };
    const d = designDuration(old);
    expect(d.completedAt).toBe(T0 + 3 * HOUR);
    expect(d.elapsedMs).toBe(3 * HOUR);
    expect(d.workMs).toBe(2 * HOUR);
  });

  it('takes the LAST move off designer, for a job that came back for changes', () => {
    const redone = {
      designerClaimedAt: T0,
      stageHistory: [
        { from: 'designer', stage: 'jobsetter', at: T0 + HOUR },
        { from: 'jobsetter', stage: 'designer', at: T0 + 2 * HOUR },
        { from: 'designer', stage: 'jobsetter', at: T0 + 6 * HOUR },
      ],
    };
    expect(designCompletedAt(redone)).toBe(T0 + 6 * HOUR);
  });

  it('a re-claimed job is not "complete" just because it has history', () => {
    // Accepting pushes { from: 'designer', stage: 'designer' }. Treating any
    // entry whose `from` is designer as the finish would date a job that is
    // being redesigned right now to the moment it was picked up again.
    const reclaimed = {
      stage: 'designer', designerClaimedAt: T0 + 2 * HOUR,
      stageHistory: [
        { from: 'designer', stage: 'jobsetter', at: T0 + HOUR },
        { from: 'jobsetter', stage: 'designer', at: T0 + 90 * MIN },
        { from: 'designer', stage: 'designer', at: T0 + 2 * HOUR, note: 'Designer accepted' },
      ],
    };
    expect(designCompletedAt(reclaimed)).toBe(T0 + HOUR);
  });

  it('is null while the design is still being worked on', () => {
    expect(designDuration({ stage: 'designer', designerClaimedAt: T0, stageHistory: [] })).toBeNull();
    expect(designDuration(null)).toBeNull();
  });

  it('survives a job completed with no claim time at all', () => {
    const d = designDuration({ stageHistory: [{ from: 'designer', stage: 'jobsetter', at: T0 }] });
    expect(d.completedAt).toBe(T0);
    expect(d.workMs).toBeNull();
  });
});

describe('averageWorkMs', () => {
  it('averages the times it knows', () => {
    expect(averageWorkMs([
      { designCompletedAt: T0, designWorkMs: HOUR },
      { designCompletedAt: T0, designWorkMs: 3 * HOUR },
    ])).toBe(2 * HOUR);
  });

  it('leaves out jobs with no time rather than counting them as zero', () => {
    expect(averageWorkMs([
      { designCompletedAt: T0, designWorkMs: 2 * HOUR },
      { stageHistory: [{ from: 'designer', stage: 'jobsetter', at: T0 }] }, // no claim time
    ])).toBe(2 * HOUR);
    expect(averageWorkMs([])).toBeNull();
  });
});

describe('the designer panel', () => {
  beforeEach(() => {
    feed = [
      // Mine, finished: 2h of work after 3h waiting on the client.
      {
        id: 'j1', jobNo: 'JOB-1', work: 'Wedding card', clientName: 'Sharma', stage: 'jobsetter',
        designerId: ME, designerClaimedAt: T0, designCompletedAt: T0 + 5 * HOUR,
        designElapsedMs: 5 * HOUR, designWorkMs: 2 * HOUR, designPausedTotal: 3 * HOUR,
        designApprovals: 2,
      },
      // Mine, finished long ago and already delivered — still my work.
      {
        id: 'j2', jobNo: 'JOB-2', work: 'Visiting cards', clientName: 'Mehta', stage: 'delivered',
        designerId: ME, designerClaimedAt: T0 - DAY, designCompletedAt: T0 - DAY + 40 * MIN,
        designElapsedMs: 40 * MIN, designWorkMs: 40 * MIN,
      },
      // Mine, still on my desk.
      { id: 'j3', jobNo: 'JOB-3', work: 'Banner', stage: 'designer', designerId: ME, designerClaimedAt: T0 },
      // Someone else's finished job.
      {
        id: 'j4', jobNo: 'JOB-4', work: 'Flyer', stage: 'production', designerId: 'someone-else',
        designerClaimedAt: T0, designCompletedAt: T0 + HOUR, designWorkMs: HOUR, designElapsedMs: HOUR,
      },
      // Open pool.
      { id: 'j5', jobNo: 'JOB-5', work: 'Menu card', stage: 'designer' },
    ];
  });

  it('lists what I finished, with the time each one took', async () => {
    renderScreen(DesignerPanelPage, { auth: OWNER });
    await waitFor(() => expect(screen.getAllByTestId('completed-job').length).toBeGreaterThan(0));
    const rows = screen.getAllByTestId('completed-job');
    expect(rows).toHaveLength(2);
    // Newest first.
    expect(rows[0].textContent).toContain('JOB-1');
    expect(within(rows[0]).getByTestId('time-taken').textContent).toBe('2h 0m');
    expect(within(rows[0]).getByTestId('time-waited').textContent).toContain('3h 0m');
    expect(rows[1].textContent).toContain('JOB-2');
    expect(within(rows[1]).getByTestId('time-taken').textContent).toBe('40m');
    expect(within(rows[1]).queryByTestId('time-waited'), 'nothing was waited on').toBeNull();
  });

  it("leaves out other designers' work and my unfinished job", async () => {
    renderScreen(DesignerPanelPage, { auth: OWNER });
    await waitFor(() => expect(screen.getAllByTestId('completed-job').length).toBe(2));
    const text = screen.getAllByTestId('completed-job').map((r) => r.textContent).join(' ');
    expect(text, "another designer's job").not.toContain('JOB-4');
    expect(text, 'still being designed').not.toContain('JOB-3');
    expect(text, 'never claimed by me').not.toContain('JOB-5');
  });

  it('shows the average of my completed work', async () => {
    renderScreen(DesignerPanelPage, { auth: OWNER });
    // (2h + 40m) / 2 = 1h 20m
    await waitFor(() => expect(screen.getByTestId('design-average').textContent).toContain('1h 20m'));
  });

  it('says so plainly when nothing is finished yet', async () => {
    feed = [{ id: 'j3', jobNo: 'JOB-3', stage: 'designer', designerId: ME, designerClaimedAt: T0 }];
    renderScreen(DesignerPanelPage, { auth: OWNER });
    await waitFor(() => expect(screen.getByText(/Nothing finished yet|complete nahi/i)).toBeTruthy());
    expect(screen.queryAllByTestId('completed-job')).toHaveLength(0);
  });

  it('folds a long history behind Show all', async () => {
    feed = Array.from({ length: 14 }, (_, i) => ({
      id: `d${i}`, jobNo: `DONE-${i}`, stage: 'delivered', designerId: ME,
      designerClaimedAt: T0 - i * HOUR, designCompletedAt: T0 - i * HOUR + 30 * MIN,
      designWorkMs: 30 * MIN, designElapsedMs: 30 * MIN,
    }));
    renderScreen(DesignerPanelPage, { auth: OWNER });
    await waitFor(() => expect(screen.getAllByTestId('completed-job').length).toBe(10));
    fireEvent.click(screen.getByRole('button', { name: /Show all|Sab dekhein/i }));
    await waitFor(() => expect(screen.getAllByTestId('completed-job').length).toBe(14));
  });
});
