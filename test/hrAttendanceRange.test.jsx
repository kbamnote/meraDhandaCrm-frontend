/**
 * Team Attendance — custom date range.
 *
 * Alongside the one-day view, owners/HR can pick any From/To period (or a
 * preset) and see each teammate's totals for it; clicking a name lists that
 * person's days in the same period.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent, within } from '@testing-library/react';
import { renderScreen } from './renderScreen.jsx';

const calls = { summary: [], userRange: [], user: [] };

vi.mock('../src/services/realtime.js', () => ({
  db: { __backend: 'test' }, socket: { on() {}, off() {}, emit() {} },
  ref: (_db, path) => ({ path }), onValue: (_r, cb) => { cb({ val: () => ({}) }); return () => {}; },
  authSocket: () => {},
}));
vi.mock('../src/services/api.js', async () => {
  const actual = await vi.importActual('../src/services/api.js');
  return {
    ...actual,
    hrApi: {
      ...actual.hrApi,
      attendance: vi.fn(async (date) => ({ date, rows: [{ userId: 'u1', username: 'Asha', status: 'present', date }] })),
      attendanceSummary: vi.fn(async (from, to) => {
        calls.summary.push([from, to]);
        return {
          from, to, workingDays: 6,
          rows: [
            { userId: 'u1', username: 'Asha', present: 2, late: 1, halfDay: 0, leave: 1, attended: 3, absent: 2, hours: 19.5 },
            { userId: 'u2', username: 'Bilal', department: 'Print', present: 0, late: 0, halfDay: 1, leave: 0, attended: 1, absent: 5, hours: 4 },
          ],
        };
      }),
      userAttendanceRange: vi.fn(async (uid, from, to) => {
        calls.userRange.push([uid, from, to]);
        return [{ id: 'a1', date: from, status: 'present' }];
      }),
      userAttendance: vi.fn(async (uid, month) => { calls.user.push([uid, month]); return []; }),
    },
  };
});

const { default: HrAttendancePage, rangePreset, listDays } = await import('../src/pages/HrAttendancePage.jsx');

beforeEach(() => { calls.summary.length = 0; calls.userRange.length = 0; calls.user.length = 0; });

describe('range helpers', () => {
  it('presets', () => {
    expect(rangePreset('last7', '2026-09-25')).toEqual({ from: '2026-09-19', to: '2026-09-25' });
    expect(rangePreset('thisMonth', '2026-09-25')).toEqual({ from: '2026-09-01', to: '2026-09-25' });
    expect(rangePreset('lastMonth', '2026-09-25')).toEqual({ from: '2026-08-01', to: '2026-08-31' });
    expect(rangePreset('lastMonth', '2026-01-10')).toEqual({ from: '2025-12-01', to: '2025-12-31' });
  });
  it('listDays is newest first, marks Sundays and stops at today', () => {
    const days = listDays('2026-09-05', '2026-09-30', '2026-09-07');
    expect(days.map((d) => d.date)).toEqual(['2026-09-07', '2026-09-06', '2026-09-05']);
    expect(days.find((d) => d.date === '2026-09-06').isSunday).toBe(true);
  });
});

describe('the page', () => {
  it('still opens on the one-day view', async () => {
    renderScreen(HrAttendancePage);
    await waitFor(() => expect(screen.getByText('Asha')).toBeTruthy());
    expect(screen.queryByTestId('range-table')).toBeNull();
    expect(calls.summary).toHaveLength(0);
  });

  it('Date range shows each teammate’s totals for the chosen period', async () => {
    renderScreen(HrAttendancePage);
    fireEvent.click(screen.getByRole('button', { name: 'Date range' }));
    await waitFor(() => expect(screen.getByTestId('range-table')).toBeTruthy());
    const rows = within(screen.getByTestId('range-table')).getAllByRole('row').map((r) => r.textContent);
    expect(rows.some((r) => r.includes('Asha') && r.includes('19.5h'))).toBe(true);
    expect(rows.some((r) => r.includes('Bilal') && r.includes('Print'))).toBe(true);
    expect(screen.getByTestId('working-days').textContent).toContain('6');
    // Defaults to this month.
    const [from, to] = calls.summary[0];
    expect(from.endsWith('-01')).toBe(true);
    expect(to >= from).toBe(true);
  });

  it('custom From / To refetches for exactly that period', async () => {
    renderScreen(HrAttendancePage);
    fireEvent.click(screen.getByRole('button', { name: 'Date range' }));
    await waitFor(() => expect(screen.getByTestId('range-table')).toBeTruthy());
    fireEvent.change(screen.getByTestId('range-from'), { target: { value: '2026-08-10' } });
    fireEvent.change(screen.getByTestId('range-to'), { target: { value: '2026-08-20' } });
    await waitFor(() => expect(calls.summary.at(-1)).toEqual(['2026-08-10', '2026-08-20']));
  });

  it('a reversed range asks for a valid one instead of calling the server', async () => {
    renderScreen(HrAttendancePage);
    fireEvent.click(screen.getByRole('button', { name: 'Date range' }));
    await waitFor(() => expect(screen.getByTestId('range-table')).toBeTruthy());
    const before = calls.summary.length;
    fireEvent.change(screen.getByTestId('range-from'), { target: { value: '2026-09-20' } });
    fireEvent.change(screen.getByTestId('range-to'), { target: { value: '2026-09-10' } });
    await waitFor(() => expect(screen.queryByTestId('range-table')).toBeNull());
    expect(calls.summary.length).toBe(before + 1); // only the valid "from" change fetched
  });

  it('clicking a teammate lists their days in the same period', async () => {
    renderScreen(HrAttendancePage);
    fireEvent.click(screen.getByRole('button', { name: 'Date range' }));
    await waitFor(() => expect(screen.getByTestId('range-table')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Last month' }));
    await waitFor(() => expect(calls.summary.length).toBeGreaterThan(1));
    const [from, to] = calls.summary.at(-1);
    fireEvent.click(screen.getByText('Bilal'));
    await waitFor(() => expect(calls.userRange).toEqual([['u2', from, to]]));
    expect(screen.getByTestId('modal-range').textContent).toContain(from);
    expect(calls.user).toHaveLength(0);
  });
});
