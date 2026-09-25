/**
 * Job Cards — date-wise filter.
 *
 * Jobs can be narrowed to a day or range, by the date they were created or by
 * their delivery date; the stage chips then count within that range.
 */
import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderScreen } from './renderScreen.jsx';
import { presetRange, jobDate, inDateRange, isoDay } from '../src/utils/jobDateFilter.js';

const at = (day, h = 10) => { const [y, m, d] = day.split('-').map(Number); return new Date(y, m - 1, d, h).getTime(); };
const today = isoDay(new Date());
const shift = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return isoDay(d); };

const JOBS = {
  j1: { jobNo: 'JC-001', clientName: 'Asha', stage: 'production', createdAt: at(today), deliveryDate: shift(3) },
  j2: { jobNo: 'JC-002', clientName: 'Bilal', stage: 'enquiry', createdAt: at(shift(-1)), deliveryDate: today },
  j3: { jobNo: 'JC-003', clientName: 'Chirag', stage: 'production', createdAt: at('2025-01-15') },
};

vi.mock('../src/services/realtime.js', () => ({
  db: { __backend: 'test' }, socket: { on() {}, off() {}, emit() {} },
  ref: (_db, path) => ({ path }),
  onValue: (r, cb) => { cb({ val: () => (r.path === 'mpw/jobs' ? JOBS : {}) }); return () => {}; },
  authSocket: () => {},
}));

const { default: JobCardsPage } = await import('../src/pages/JobCardsPage.jsx');

describe('jobDateFilter', () => {
  it('presets', () => {
    expect(presetRange('today', '2026-09-25')).toEqual({ from: '2026-09-25', to: '2026-09-25' });
    expect(presetRange('yesterday', '2026-09-01')).toEqual({ from: '2026-08-31', to: '2026-08-31' });
    expect(presetRange('last7', '2026-09-25')).toEqual({ from: '2026-09-19', to: '2026-09-25' });
    expect(presetRange('thisMonth', '2026-09-25')).toEqual({ from: '2026-09-01', to: '2026-09-25' });
    expect(presetRange('lastMonth', '2026-03-10')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(presetRange('all', '2026-09-25')).toEqual({ from: '', to: '' });
    expect(presetRange('custom', '2026-09-25')).toBeNull();
  });
  it('reads created (timestamp or ISO) and delivery dates', () => {
    expect(jobDate({ createdAt: at('2026-09-05', 23) }, 'created')).toBe('2026-09-05');
    expect(jobDate({ createdAt: String(at('2026-09-05')) }, 'created')).toBe('2026-09-05');
    expect(jobDate({ deliveryDate: '2026-09-07' }, 'delivery')).toBe('2026-09-07');
    expect(jobDate({ deliveryDate: 'soon' }, 'delivery')).toBeNull();
    expect(jobDate({}, 'created')).toBeNull();
  });
  it('ranges are inclusive and open-ended; undated jobs drop out once a limit is set', () => {
    const j = { createdAt: at('2026-09-10') };
    expect(inDateRange(j, 'created', '2026-09-10', '2026-09-10')).toBe(true);
    expect(inDateRange(j, 'created', '2026-09-11', '')).toBe(false);
    expect(inDateRange(j, 'created', '', '2026-09-10')).toBe(true);
    expect(inDateRange({}, 'delivery', '', '')).toBe(true);
    expect(inDateRange({}, 'delivery', '2026-01-01', '')).toBe(false);
  });
});

describe('the Job Cards page', () => {
  const shown = () => ['JC-001', 'JC-002', 'JC-003'].filter((n) => screen.queryByText(n));

  it('shows every job until a date is picked', async () => {
    renderScreen(JobCardsPage);
    await waitFor(() => expect(shown()).toEqual(['JC-001', 'JC-002', 'JC-003']));
  });

  it('Today (created) shows only jobs created today, and the stage chips count within it', async () => {
    renderScreen(JobCardsPage);
    fireEvent.change(screen.getByTestId('date-preset'), { target: { value: 'today' } });
    await waitFor(() => expect(shown()).toEqual(['JC-001']));
    expect(screen.getByText(/Production \(1\)/)).toBeTruthy();
    expect(screen.getByTestId('job-total').textContent).toContain('3 total');
  });

  it('switching to delivery date uses the delivery date instead', async () => {
    renderScreen(JobCardsPage);
    fireEvent.change(screen.getByTestId('date-field'), { target: { value: 'delivery' } });
    fireEvent.change(screen.getByTestId('date-preset'), { target: { value: 'today' } });
    await waitFor(() => expect(shown()).toEqual(['JC-002']));
  });

  it('a custom range works and clearing brings everything back', async () => {
    renderScreen(JobCardsPage);
    fireEvent.change(screen.getByTestId('date-preset'), { target: { value: 'custom' } });
    fireEvent.change(screen.getByTestId('date-from'), { target: { value: '2025-01-01' } });
    fireEvent.change(screen.getByTestId('date-to'), { target: { value: '2025-01-31' } });
    await waitFor(() => expect(shown()).toEqual(['JC-003']));
    fireEvent.click(screen.getByText('✕'));
    await waitFor(() => expect(shown()).toEqual(['JC-001', 'JC-002', 'JC-003']));
  });
});
