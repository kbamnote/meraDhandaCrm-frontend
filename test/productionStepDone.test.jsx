/**
 * Production — marking a step Done shows at once (optimistic), the save's
 * reply is applied, and a failed save puts the step back.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderScreen } from './renderScreen.jsx';

const JOBS = {
  j1: {
    jobNo: 'PW-2627-0063', clientName: 'Shreya Mam', stage: 'production', currentDeptIndex: 0,
    plan: [{ dept: 'fabrication', steps: [{ id: 's1', name: 'Fabrication' }] }], stepProgress: {},
  },
};
let resolveSave; let failSave = false;
const marks = [];

vi.mock('../src/services/realtime.js', () => ({
  db: { __backend: 'test' }, socket: { on() {}, off() {}, emit() {} },
  ref: (_db, path) => ({ path }),
  onValue: (r, cb) => { cb({ val: () => (r.path === 'mpw/jobs' ? JOBS : {}) }); return () => {}; },
  authSocket: () => {},
}));
vi.mock('../src/services/api.js', async () => {
  const actual = await vi.importActual('../src/services/api.js');
  return {
    ...actual,
    ordersApi: {
      ...actual.ordersApi,
      departments: vi.fn(async () => [{ key: 'fabrication', name: 'Fabrication', emoji: '🏗', color: '#333' }]),
      markStep: vi.fn((id, body) => {
        marks.push([id, body]);
        return new Promise((res, rej) => {
          resolveSave = () => (failSave
            ? rej(Object.assign(new Error('x'), { response: { data: { error: 'Save failed' } } }))
            : res({ ...JOBS.j1, id, stepProgress: { '0:s1': { done: true, by: 'u1', at: 1 } } }));
        });
      }),
    },
  };
});

const { default: ProductionPage } = await import('../src/pages/ProductionPage.jsx');

async function openStep() {
  renderScreen(ProductionPage);
  await waitFor(() => expect(screen.getByText('Fabrication')).toBeTruthy());
  fireEvent.click(screen.getByText('Fabrication'));
  await waitFor(() => expect(screen.getByText('PW-2627-0063')).toBeTruthy());
  fireEvent.click(screen.getByText('PW-2627-0063'));
  await waitFor(() => expect(screen.getByTestId('step-done')).toBeTruthy());
}

beforeEach(() => { marks.length = 0; failSave = false; });

describe('Production step Done', () => {
  it('ticks immediately, before the server answers, and blocks a second click', async () => {
    await openStep();
    fireEvent.click(screen.getByTestId('step-done'));
    // Still waiting on the server, but already shown as done.
    expect(screen.getAllByText('✅').length).toBeGreaterThan(0);
    expect(marks).toEqual([['j1', { stepId: 's1', action: 'done' }]]);
    resolveSave();
    await waitFor(() => expect(screen.getByRole('button', { name: /QC|Next|bhej/i }).disabled).toBe(false));
  });

  it('a failed save puts the step back and says so', async () => {
    failSave = true;
    await openStep();
    fireEvent.click(screen.getByTestId('step-done'));
    expect(screen.getAllByText('✅').length).toBeGreaterThan(0);
    resolveSave();
    await waitFor(() => expect(screen.getByTestId('step-done')).toBeTruthy());
    expect(screen.queryAllByText('✅').length).toBe(0);
  });
});
