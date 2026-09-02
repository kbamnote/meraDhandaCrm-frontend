/**
 * Cash & Bank — the statement reads like a passbook.
 *
 * The behaviour under test is the one a bank statement is judged on: the
 * balance runs down the page, updating after every transaction, and it opens
 * and closes with a brought-forward / carried-forward line so the first
 * transaction's balance has something to be read against.
 *
 * The running balance is asserted from the RENDERED cells, row by row —
 * balance[n] must equal balance[n-1] + received - paid. Asserting the numbers
 * individually would pass on a table that happens to contain the right figures
 * in the wrong order, which is precisely what a passbook must not do.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within, fireEvent } from '@testing-library/react';
import { renderScreen } from './renderScreen.jsx';

const OPENING = 2000;
const ROWS = [
  { id: 'e1', date: '2026-08-24', type: 'payment', party: 'ABC', mode: null, paid: 0, received: 28.98, balance: 2028.98 },
  { id: 'e2', date: '2026-08-31', type: 'payment', party: 'PRABHAAV FOODS', mode: null, paid: 0, received: 4602, balance: 6630.98 },
  { id: 'e3', date: '2026-09-02', type: 'payment-out', party: 'Vibgyor Pixel Print', mode: 'Bank Transfer', paid: 886, received: 0, balance: 5744.98 },
];
const CLOSING = 5744.98;

const ACCOUNTS = [
  { id: 'cash', key: 'cash', type: 'cash', name: 'Cash in hand', balance: 1200, deletable: false },
  { id: 'b1', key: 'bank:b1', type: 'bank', name: 'IDFC Current', accountNumber: '10189326206', balance: CLOSING, deletable: true },
];

vi.mock('../src/services/api.js', async () => {
  const actual = await vi.importActual('../src/services/api.js');
  return {
    ...actual,
    accountingApi: {
      bankAccounts: vi.fn(() => Promise.resolve({ accounts: ACCOUNTS, totalBalance: 6944.98 })),
      bankTransactions: vi.fn(() => Promise.resolve({
        key: 'bank:b1', from: '2026-08-04', to: '2026-09-02',
        opening: OPENING, closing: CLOSING, rows: ROWS,
      })),
      bankEntry: vi.fn(), bankReassign: vi.fn(), bankTransfer: vi.fn(), bankAdjust: vi.fn(),
      createBankAccount: vi.fn(), updateBankAccount: vi.fn(), deleteBankAccount: vi.fn(),
    },
  };
});

const money = (s) => Number(String(s).replace(/[₹,\s]/g, '').replace(/(Cr|Dr)$/i, ''));

// [paid, received, balance] read out of one rendered row.
//
// Taken from the END of the row, not by fixed index: a brought-forward line
// spans the descriptive columns into one cell, so it has fewer children than a
// transaction row while still ending in the same three money columns.
function cellsOf(row) {
  const cells = [...row.children];
  const [paid, received, balance] = cells.slice(-3);
  return {
    paid: paid.textContent.trim(),
    received: received.textContent.trim(),
    balance: money(balance.textContent),
    balanceText: balance.textContent.trim(),
  };
}

const txnRows = () => screen.getAllByTestId('statement-row');
const carriedRows = () => screen.getAllByTestId('carried-row');

describe('Cash & Bank statement reads like a passbook', () => {
  beforeEach(async () => {
    const { default: CashBankPage } = await import('../src/pages/accounting/CashBankPage.jsx');
    renderScreen(CashBankPage);
    await waitFor(() => expect(txnRows().length).toBe(ROWS.length));
  });

  it('opens with a brought-forward line carrying the opening balance', () => {
    const first = carriedRows()[0];
    expect(within(first).getByText(/Opening Balance \(B\/F\)/i)).toBeTruthy();
    expect(cellsOf(first).balance).toBe(OPENING);
  });

  it('closes with a carried-forward line carrying the closing balance', () => {
    const rows = carriedRows();
    const last = rows[rows.length - 1];
    expect(within(last).getByText(/Closing Balance \(C\/F\)/i)).toBeTruthy();
    expect(cellsOf(last).balance).toBe(CLOSING);
  });

  it('the brought-forward line has no paid or received figure', () => {
    // It is not a transaction. Showing 0 there would invite it being summed.
    const c = cellsOf(carriedRows()[0]);
    expect(c.paid).toBe('-');
    expect(c.received).toBe('-');
  });

  it('the balance updates after every transaction, row by row', () => {
    // The heart of a passbook: each balance follows from the one above it.
    let running = OPENING;
    txnRows().forEach((row, i) => {
      const c = cellsOf(row);
      const paid = c.paid === '-' ? 0 : money(c.paid);
      const received = c.received === '-' ? 0 : money(c.received);
      running = Math.round((running + received - paid) * 100) / 100;
      expect(c.balance, `row ${i + 1} (${ROWS[i].party})`).toBe(running);
    });
    expect(running).toBe(CLOSING);
  });

  it('marks the balance Cr when there is money in the account', () => {
    expect(cellsOf(txnRows()[0]).balanceText).toMatch(/Cr$/);
  });

  it('marks an overdrawn balance Dr, not a bare minus', async () => {
    const { accountingApi } = await import('../src/services/api.js');
    accountingApi.bankTransactions.mockResolvedValueOnce({
      key: 'bank:b1', from: '2026-08-04', to: '2026-09-02', opening: 0, closing: -500,
      rows: [{ id: 'x1', date: '2026-08-24', type: 'payment-out', party: 'X', paid: 500, received: 0, balance: -500 }],
    });
    const { default: CashBankPage } = await import('../src/pages/accounting/CashBankPage.jsx');
    renderScreen(CashBankPage);
    await waitFor(() => {
      const overdrawn = screen.getAllByTestId('statement-row').filter((r) => /Dr$/.test(cellsOf(r).balanceText));
      expect(overdrawn.length).toBeGreaterThan(0);
    });
  });

  it('reversing the order keeps each row\'s own balance', () => {
    // A row's balance is the balance AFTER that transaction. It must not be
    // recomputed from whatever now sits above it on screen.
    const ascending = txnRows().map((r) => cellsOf(r).balance);
    fireEvent.click(screen.getByRole('button', { name: /Oldest first/i }));
    const descending = txnRows().map((r) => cellsOf(r).balance);
    expect(descending).toEqual([...ascending].reverse());
  });

  it('newest-first puts the carried-forward line at the top', () => {
    fireEvent.click(screen.getByRole('button', { name: /Oldest first/i }));
    const first = carriedRows()[0];
    expect(within(first).getByText(/Closing Balance \(C\/F\)/i)).toBeTruthy();
  });
});
