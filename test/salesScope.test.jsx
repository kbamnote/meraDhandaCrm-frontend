/**
 * What a salesperson can reach, and what their dashboard opens with.
 *
 * The reported problem: a sales login could see the whole Accounting menu
 * without anyone granting it. The cause was the role's own defaults —
 * `invoices`, `parties` and `reports` between them unlock the accounting
 * dashboard, the notes, Profitability, Job Profit, Year-End Close and Branches.
 * A rep's defaults are now their customers, their tasks and their shop visits.
 *
 * Also here: the lead KPIs are gone from their dashboard, because the Leads CRM
 * is no longer in their nav and figures nobody can open are just noise.
 */
import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { PERM_OF, ROLE_READ_DEFAULTS, canViewModule, isSectionHidden } from '../src/config/access.js';
import { renderScreen, OWNER } from './renderScreen.jsx';

vi.mock('../src/services/realtime.js', () => ({
  db: { __backend: 'test' }, socket: { on() {}, off() {}, emit() {} },
  ref: (_db, path) => ({ path }), onValue: (_r, cb) => { cb({ val: () => ({}) }); return () => {}; },
  authSocket: () => {},
}));
vi.mock('../src/services/api.js', async () => {
  const actual = await vi.importActual('../src/services/api.js');
  return {
    ...actual,
    salesApi: {
      ...actual.salesApi,
      myPerformance: vi.fn(async () => ({
        userId: 'u1', orders: 2, orderValue: 9000, billed: 5310, collected: 2000,
        pending: 3310, visits: 7, ordersFromVisits: 2, conversion: 29,
        recent: [{ id: 'j1', jobNo: 'JOB-1', clientName: 'Sharma', amount: 4500 }],
      })),
      targets: vi.fn(async () => []),
      report: vi.fn(async () => { throw new Error('a rep should not need the lead report'); }),
      leaderboard: vi.fn(async () => { throw new Error('a rep should not need the leaderboard'); }),
    },
  };
});

const { default: SalesDashboard } = await import('../src/pages/dashboards/SalesDashboard.jsx');

const SALES = { role: 'sales', permissions: {} };

// Every accounting route the sidebar offers, with the module that guards it.
const ACCOUNTING = [
  '/accounting', '/accounting/sales', '/accounting/parties', '/accounting/items',
  '/accounting/purchases', '/accounting/reports', '/accounting/gst', '/accounting/cash',
  '/accounting/entries', '/accounting/daybook', '/accounting/profit', '/accounting/year-end',
  '/accounting/job-profit', '/accounting/recon', '/accounting/tds', '/accounting/credit-notes',
  '/accounting/debit-notes', '/accounting/challans', '/accounting/recurring',
  '/accounting/branches', '/accounting/inventory', '/expenses', '/purchase-orders',
  '/invoice-view', '/client-ledger',
];

describe('a salesperson’s access', () => {
  it('reaches no accounting page by default', () => {
    const open = ACCOUNTING.filter((p) => !isSectionHidden(p, SALES));
    expect(open).toEqual([]);
  });

  it('every accounting route is gated at all (an ungated one is open to everybody)', () => {
    const ungated = ACCOUNTING.filter((p) => !PERM_OF[p]);
    expect(ungated).toEqual([]);
  });

  it('cannot reach Leads CRM or the Sales Panel any more', () => {
    expect(isSectionHidden('/leads-crm', SALES)).toBe(true);
    expect(isSectionHidden('/sales-panel', SALES)).toBe(true);
    expect(isSectionHidden('/sales-admin', SALES)).toBe(true);
  });

  it('keeps what the job actually needs', () => {
    expect(isSectionHidden('/visits', SALES)).toBe(false);
    expect(isSectionHidden('/tasks', SALES)).toBe(false);
    expect(isSectionHidden('/cust-dashboard', SALES)).toBe(false);
  });

  it('still shares a location while punched in', () => {
    expect(ROLE_READ_DEFAULTS.sales).toContain('fieldTrack');
  });

  it('does not watch the team map — that is a grant, not a default', () => {
    expect(canViewModule('sales', 'tracking', {})).toBe(false);
    expect(canViewModule('sales', 'tracking', { 'tracking.read': true })).toBe(true);
  });

  it('gets accounting back the moment an owner grants it', () => {
    const granted = { role: 'sales', permissions: { 'invoices.read': true } };
    expect(isSectionHidden('/accounting/sales', granted)).toBe(false);
    // ...and only what was granted: reports stays shut.
    expect(isSectionHidden('/accounting/profit', granted)).toBe(true);
  });

  it('other roles are untouched', () => {
    expect(isSectionHidden('/accounting/sales', { role: 'accountant', permissions: {} })).toBe(false);
    expect(isSectionHidden('/leads-crm', { role: 'manager', permissions: {} })).toBe(false);
  });
});

describe('the sales dashboard', () => {
  it('opens with orders, not the six lead figures', async () => {
    renderScreen(SalesDashboard, { auth: OWNER });
    await waitFor(() => expect(screen.getByText('My orders this month')).toBeTruthy());

    for (const gone of ['My leads', 'Won', 'Lost', 'Pending', 'Conversion', 'Lead outcomes']) {
      expect(screen.queryByText(gone), gone).toBeNull();
    }
    for (const kept of ['Orders won', 'Order value', 'Billed', 'Collected', 'Yet to collect', 'Shops visited']) {
      expect(screen.getByText(kept), kept).toBeTruthy();
    }
  });

  it('shows the money and what it came from', async () => {
    renderScreen(SalesDashboard, { auth: OWNER });
    await waitFor(() => expect(screen.getByText('Orders won')).toBeTruthy());
    expect(document.body.textContent).toContain('₹9,000');       // agreed
    expect(document.body.textContent).toContain('₹5,310');       // billed
    expect(document.body.textContent).toContain('₹2,000');       // collected
    expect(document.body.textContent).toContain('2 of 7 shop visits');
    expect(screen.getByText('JOB-1')).toBeTruthy();
  });

  it('points at the pages a rep actually uses', async () => {
    renderScreen(SalesDashboard, { auth: OWNER });
    await waitFor(() => expect(screen.getByText('Shop Visits')).toBeTruthy());
    expect(screen.getByText('My Attendance')).toBeTruthy();
    expect(screen.queryByText('Leads')).toBeNull();
    expect(screen.queryByText('Sales Panel')).toBeNull();
  });
});
