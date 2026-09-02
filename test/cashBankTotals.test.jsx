/**
 * Cash & Bank — the totals shown under the statement.
 *
 * Built against the real screen with the API stubbed, using the exact rows from
 * the IDFC account on screen. A footer that disagrees with the column above it
 * is worse than no footer, so what this asserts is that the two agree: the
 * totals are derived from the same rows the table renders, and opening plus the
 * net movement lands exactly on the closing balance.
 *
 * Each figure is read from ITS OWN LABEL, not scraped from the page. The first
 * version of this file collected every rupee amount on screen and asserted the
 * expected number appeared somewhere — which passed happily when Total Received
 * was made to sum the wrong column, because 15,630.98 also happens to be a
 * running-balance cell. An assertion satisfiable by an unrelated element is not
 * an assertion.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { renderScreen } from './renderScreen.jsx';

// The real statement from the account in question.
const ROWS = [
  { id: 'e1', date: '2026-08-24', type: 'payment', txnNo: null, party: 'ABC', mode: null, paid: 0, received: 28.98, balance: 28.98 },
  { id: 'e2', date: '2026-08-31', type: 'payment', txnNo: null, party: 'PRABHAAV FOODS', mode: null, paid: 0, received: 4602, balance: 4630.98 },
  { id: 'e3', date: '2026-09-02', type: 'payment', txnNo: null, party: 'ROKDE JEWELLERS', mode: null, paid: 0, received: 1000, balance: 5630.98 },
  { id: 'e4', date: '2026-09-02', type: 'opening', txnNo: null, party: null, memo: 'Opening balance', mode: null, paid: 0, received: 10000, balance: 15630.98 },
  { id: 'e5', date: '2026-09-02', type: 'payment-out', txnNo: null, party: 'Vibgyor Pixel Print', mode: 'Bank Transfer', paid: 886, received: 0, balance: 14744.98 },
];

const RECEIVED = 15630.98;   // 28.98 + 4602 + 1000 + 10000
const PAID = 886;
const CLOSING = 14744.98;
const TOTAL_BALANCE = 65213.58;   // 50468.60 cash + 14744.98 bank

const ACCOUNTS = [
  { id: 'cash', key: 'cash', type: 'cash', name: 'Cash in hand', balance: 50468.6, deletable: false },
  { id: 'b1', key: 'bank:b1', type: 'bank', name: 'MRPRINT WORLD PRIVATE LIMITED', accountNumber: '10189326206', balance: CLOSING, deletable: true },
  { id: 'unlinked', key: 'bank', type: 'unlinked', name: 'Unlinked Transactions', balance: 0, deletable: false },
];

vi.mock('../src/services/api.js', async () => {
  const actual = await vi.importActual('../src/services/api.js');
  return {
    ...actual,
    accountingApi: {
      bankAccounts: vi.fn(() => Promise.resolve({ accounts: ACCOUNTS, totalBalance: TOTAL_BALANCE })),
      bankTransactions: vi.fn(() => Promise.resolve({ key: 'bank:b1', opening: 0, closing: CLOSING, rows: ROWS })),
      bankEntry: vi.fn(), bankReassign: vi.fn(), bankTransfer: vi.fn(), bankAdjust: vi.fn(),
      createBankAccount: vi.fn(), updateBankAccount: vi.fn(), deleteBankAccount: vi.fn(),
    },
  };
});

const money = (s) => Number(String(s).replace(/[₹,+\s]/g, ''));

// The <Total> component renders the label and its value as two children of one
// wrapper, so the value is the wrapper's last child. Reading it this way ties
// each number to the label that explains it.
function totalFor(labelRe) {
  // Scoped to the footer. Page-wide lookups were ambiguous: "Opening Balance"
  // is also a transaction TYPE in the table, and several labels end in
  // "Balance", so a loose query matched the wrong element.
  const footer = screen.getByTestId('statement-totals');
  const label = within(footer).getByText(labelRe);
  const wrapper = label.parentElement;
  const value = wrapper.lastElementChild;
  expect(value, `no value rendered beside ${labelRe}`).toBeTruthy();
  expect(value).not.toBe(label);
  return money(value.textContent);
}

describe('Cash & Bank statement totals', () => {
  beforeEach(async () => {
    const { default: CashBankPage } = await import('../src/pages/accounting/CashBankPage.jsx');
    renderScreen(CashBankPage);
    await waitFor(() => expect(screen.getByText(/Total Received/i)).toBeTruthy());
  });

  it('Total Received is the sum of the received column', () => {
    expect(totalFor(/^Total Received$/i)).toBe(RECEIVED);
  });

  it('Total Paid is the sum of the paid column', () => {
    expect(totalFor(/^Total Paid$/i)).toBe(PAID);
  });

  it('the account balance matches the last running balance', () => {
    expect(totalFor(/^Closing Balance$/i)).toBe(CLOSING);
    expect(ROWS[ROWS.length - 1].balance).toBe(CLOSING);
  });

  it('the grand total across all accounts is shown', () => {
    expect(totalFor(/^Total Balance \(all accounts\)$/i)).toBe(TOTAL_BALANCE);
  });

  it('Net Change is received minus paid', () => {
    expect(totalFor(/^Net Change$/i)).toBe(Math.round((RECEIVED - PAID) * 100) / 100);
  });

  it('opening + net movement lands exactly on the closing balance', () => {
    const opening = totalFor(/^Opening Balance$/i);
    const net = totalFor(/^Net Change$/i);
    expect(Math.round((opening + net) * 100) / 100).toBe(totalFor(/^Closing Balance$/i));
  });

  it('every total is labelled, so no figure is unexplained', () => {
    for (const label of [/^Opening Balance$/i, /^Total Received$/i, /^Total Paid$/i, /^Net Change$/i, /^Total Balance \(all accounts\)$/i]) {
      const footer = screen.getByTestId('statement-totals');
      expect(within(footer).getAllByText(label).length, String(label)).toBeGreaterThan(0);
    }
  });
});
