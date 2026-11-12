/**
 * Parties → a party → Transactions: the period dropdown has "Custom date…",
 * which shows From / To pickers and filters to that range (inclusive). The
 * month presets use local dates, so an invoice on the last day of the month
 * belongs to that month.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../src/services/realtime.js', () => ({
  db: {}, socket: { on() {}, off() {}, emit() {} },
  ref: (_db, path) => ({ path }), onValue: (_r, cb) => { cb({ val: () => ({}) }); return () => {}; },
  authSocket: () => {},
}));

const { TransactionsTab } = await import('../src/pages/accounting/PartiesPage.jsx');

const pad = (n) => String(n).padStart(2, '0');
const local = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const now = new Date();
const lastDayPrevMonth = local(new Date(now.getFullYear(), now.getMonth(), 0));
const firstDayThisMonth = local(new Date(now.getFullYear(), now.getMonth(), 1));

const ROWS = [
  { id: 'a', docType: 'invoice', collectionName: 'invoices', number: 'MW-1', date: '2026-09-15', amount: 100, status: 'unpaid', label: 'Sales Invoice' },
  { id: 'b', docType: 'invoice', collectionName: 'invoices', number: 'MW-2', date: '2026-10-01', amount: 200, status: 'unpaid', label: 'Sales Invoice' },
  { id: 'c', docType: 'invoice', collectionName: 'invoices', number: 'MW-3', date: '2026-10-31', amount: 300, status: 'unpaid', label: 'Sales Invoice' },
  { id: 'd', docType: 'invoice', collectionName: 'invoices', number: 'MW-LAST', date: lastDayPrevMonth, amount: 400, status: 'unpaid', label: 'Sales Invoice' },
  { id: 'e', docType: 'invoice', collectionName: 'invoices', number: 'MW-FIRST', date: firstDayThisMonth, amount: 500, status: 'unpaid', label: 'Sales Invoice' },
];
const t = (k) => k;

function renderTab() {
  render(<MemoryRouter><TransactionsTab rows={ROWS} t={t} party={{ id: 'p1', type: 'client', name: 'X' }} onChanged={() => {}} /></MemoryRouter>);
  return screen.getAllByRole('combobox')[0];   // the period dropdown
}
const shown = () => ROWS.map((r) => r.number).filter((n) => screen.queryByText(n));

describe('Transactions period filter', () => {
  it('offers Custom date, which shows From / To prefilled with this month', () => {
    const period = renderTab();
    expect([...period.options].map((o) => o.value)).toContain('custom');
    expect(screen.queryByTestId('custom-range')).toBeNull();
    fireEvent.change(period, { target: { value: 'custom' } });
    expect(screen.getByTestId('range-from').value).toBe(firstDayThisMonth);
    expect(screen.getByTestId('range-to').value).toBe(local(now));
  });

  it('filters to the custom range, both ends inclusive; an empty end is open', () => {
    const period = renderTab();
    fireEvent.change(period, { target: { value: 'custom' } });
    // 15 Sep → 1 Oct: both boundary days are in.
    fireEvent.change(screen.getByTestId('range-from'), { target: { value: '2026-09-15' } });
    fireEvent.change(screen.getByTestId('range-to'), { target: { value: '2026-10-01' } });
    expect(shown()).toEqual(['MW-1', 'MW-2']);
    // No end date: everything from 15 Sep on.
    fireEvent.change(screen.getByTestId('range-to'), { target: { value: '' } });
    expect(shown()).toContain('MW-FIRST');
    expect(shown()).toContain('MW-3');
  });

  it('Last Month includes its last day (local dates, not UTC)', () => {
    const period = renderTab();
    fireEvent.change(period, { target: { value: 'lastMonth' } });
    expect(shown()).toContain('MW-LAST');
    expect(shown()).not.toContain('MW-FIRST');
  });
});
