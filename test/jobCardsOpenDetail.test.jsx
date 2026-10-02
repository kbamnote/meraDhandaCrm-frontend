/**
 * Job Cards → job detail.
 *
 * Clicking a job card opens its full detail (Job View) showing the current
 * stage; a cancelled / held job says who did it, when and why; every Timeline
 * step names who made it. The "Move to" control lives on that page now (opened
 * from Job Cards), not on every card, and hold / cancel still need a reason.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor, render } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { createElement } from 'react';
import { LanguageProvider } from '../src/i18n/LanguageContext';
import { AuthContext } from '../src/context/AuthContext';
import { OWNER } from './renderScreen.jsx';

const T0 = new Date(2026, 8, 20, 10, 30).getTime();
const JOBS = {
  j1: { jobNo: 'JC-001', clientName: 'Asha', stage: 'production', createdAt: T0,
    stageHistory: [{ stage: 'enquiry', at: T0, by: 'u1' }, { from: 'enquiry', stage: 'production', at: T0 + 1000, by: 'u2' }] },
  j2: { jobNo: 'JC-002', clientName: 'Bilal', stage: 'cancelled', createdAt: T0,
    stageHistory: [{ stage: 'enquiry', at: T0, by: 'u1' }, { from: 'enquiry', stage: 'cancelled', at: T0 + 5000, by: 'u2', note: 'Client backed out' }] },
};
const USERS = { u1: { name: 'Owner Om' }, u2: { name: 'Manager Meena' } };
const transitions = [];

vi.mock('../src/services/realtime.js', () => ({
  db: { __backend: 'test' }, socket: { on() {}, off() {}, emit() {} },
  ref: (_db, path) => ({ path }),
  onValue: (r, cb) => { cb({ val: () => (r.path === 'mpw/jobs' ? JOBS : r.path === 'mpw/users' ? USERS : {}) }); return () => {}; },
  authSocket: () => {},
}));
vi.mock('../src/services/api.js', async () => {
  const actual = await vi.importActual('../src/services/api.js');
  return { ...actual, ordersApi: { ...actual.ordersApi, transition: vi.fn(async (id, body) => { transitions.push([id, body]); return {}; }) } };
});

const { default: JobCardsPage } = await import('../src/pages/JobCardsPage.jsx');
const { default: JobViewPage } = await import('../src/pages/JobViewPage.jsx');

function renderApp(path) {
  return render(
    createElement(MemoryRouter, { initialEntries: [path] },
      createElement(AuthContext.Provider, { value: OWNER },
        createElement(LanguageProvider, null,
          createElement(Routes, null,
            createElement(Route, { path: '/job-cards', element: createElement(JobCardsPage) }),
            createElement(Route, { path: '/job-view', element: createElement(JobViewPage) }),
          )))),
  );
}

beforeEach(() => { transitions.length = 0; });

describe('Job Cards', () => {
  it('cards no longer carry a Move-to dropdown, and Cancelled / Hold have chips', async () => {
    renderApp('/job-cards');
    await waitFor(() => expect(screen.getAllByTestId('job-card').length).toBe(2));
    expect(screen.queryByTestId('move-to')).toBeNull();
    expect(document.querySelectorAll('[data-testid="job-card"] select').length).toBe(0);
    fireEvent.click(screen.getByText(/Cancelled \(1\)/));
    await waitFor(() => expect(screen.getAllByTestId('job-card').length).toBe(1));
    expect(screen.getByText('JC-002')).toBeTruthy();
    expect(screen.getByText(/Hold \(0\)/)).toBeTruthy();
  });

  it('clicking a card opens its detail with the current stage', async () => {
    renderApp('/job-cards');
    await waitFor(() => expect(screen.getByText('JC-001')).toBeTruthy());
    fireEvent.click(screen.getByText('JC-001'));
    await waitFor(() => expect(screen.getByTestId('current-stage').textContent).toContain('Production'));
    expect(screen.queryByTestId('closed-banner')).toBeNull();
    // Timeline names who made each step.
    const by = screen.getAllByTestId('timeline-by').map((n) => n.textContent);
    expect(by).toEqual(['by Owner Om', 'by Manager Meena']);
  });
});

describe('Job View', () => {
  it('a cancelled job shows who cancelled it, when and why', async () => {
    renderApp('/job-view?id=j2');
    await waitFor(() => expect(screen.getByTestId('closed-banner')).toBeTruthy());
    const banner = screen.getByTestId('closed-banner').textContent;
    expect(banner).toContain('Cancelled by: Manager Meena');
    expect(banner).toContain('Client backed out');
    expect(screen.getByTestId('current-stage').textContent).toContain('Cancelled');
  });

  it('Move to is only offered when opened from Job Cards', async () => {
    renderApp('/job-view?id=j1');
    await waitFor(() => expect(screen.getByTestId('current-stage')).toBeTruthy());
    expect(screen.queryByTestId('move-to')).toBeNull();
  });

  it('moving a job sends the transition; cancelling needs a reason', async () => {
    renderApp('/job-view?id=j1&manage=1');
    await waitFor(() => expect(screen.getByTestId('move-to')).toBeTruthy());
    const options = [...screen.getByTestId('move-to').options].map((o) => o.value);
    expect(options).not.toContain('production');
    fireEvent.change(screen.getByTestId('move-to'), { target: { value: 'cancelled' } });
    expect(screen.getByTestId('move-submit').disabled).toBe(true);
    fireEvent.change(screen.getByTestId('move-reason'), { target: { value: 'Duplicate order' } });
    fireEvent.click(screen.getByTestId('move-submit'));
    await waitFor(() => expect(transitions).toHaveLength(1));
    expect(transitions[0]).toEqual(['j1', { to: 'cancelled', resetSteps: false, note: 'Duplicate order' }]);
  });
});
