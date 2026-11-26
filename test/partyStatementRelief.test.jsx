/**
 * Parties → a party → Ledger (Statement): a receipt credits the party by the
 * RELIEF, not by the cash.
 *
 * Found on a live account. Two receipts carried TDS the customer had withheld
 * — ₹922 and ₹330 — and the statement credited only the ₹53,500 and ₹19,140
 * that reached the bank. The bills were correctly marked paid and the ledger
 * correctly credited ₹54,422 and ₹19,470, so the statement handed to the
 * customer showed them owing ₹1,252 they had already paid the government:
 * closing ₹21,50,377 where the ledger said ₹21,49,125.
 *
 * The server now sends `relief` (cash + TDS + write-off) on every payment row
 * and the statement balances on that. `amount` stays the cash, because Total
 * Received means money in — which the last test here pins down.
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../src/services/realtime.js', () => ({
  db: {}, socket: { on() {}, off() {}, emit() {} },
  ref: (_db, path) => ({ path }), onValue: (_r, cb) => { cb({ val: () => ({}) }); return () => {}; },
  authSocket: () => {},
}));

const { LedgerTab } = await import('../src/pages/accounting/PartiesPage.jsx');

const t = (k) => k;
const PARTY = { id: 'c1', name: 'U and I', type: 'client' };

// The live account, trimmed to the rows that matter.
const FEED = [
  { id: 'i1', docType: 'invoice', collectionName: 'invoices', label: 'Sales Invoice', number: 'MW-24-25-7', date: '2024-08-27', amount: 47578, unpaid: 0 },
  { id: 'i2', docType: 'invoice', collectionName: 'invoices', label: 'Sales Invoice', number: 'MW-24-25-8', date: '2024-08-29', amount: 6844, unpaid: 0 },
  // ₹53,500 banked, ₹922 withheld as TDS → the bills were relieved by ₹54,422.
  { id: 'p1', docType: 'payment_in', collectionName: 'payments', label: 'Payment In', number: 'RCPT-1', date: '2024-10-01', amount: 53500, relief: 54422, tds: 922, writeOff: 0, unpaid: 0 },
  { id: 'i3', docType: 'invoice', collectionName: 'invoices', label: 'Sales Invoice', number: 'MW-24-25-19', date: '2024-10-13', amount: 19470, unpaid: 0 },
  { id: 'p2', docType: 'payment_in', collectionName: 'payments', label: 'Payment In', number: 'RCPT-2', date: '2024-11-22', amount: 19140, relief: 19470, tds: 330, writeOff: 0, unpaid: 0 },
];

const mount = (feed = FEED, openingBalance = 0) => render(
  <MemoryRouter>
    <LedgerTab party={PARTY} t={t} feed={feed} openingBalance={openingBalance} />
  </MemoryRouter>
);

/**
 * The statement grid, read positionally: every row is eight cells —
 * date, voucher, no., mode, DEBIT, CREDIT, BALANCE, due date. Reading the
 * cells rather than searching the page for a figure matters here, because
 * ₹54,422 is also what the two invoices come to and would be "on screen"
 * either way.
 */
const statement = () => [...document.querySelectorAll('div')]
  .filter((d) => d.style.display === 'grid' && d.children.length === 8)
  .map((d) => [...d.children].map((c) => c.textContent.trim()))
  .filter((c) => c[0] !== 'date')                       // drop the header
  .map(([date, voucher, no, mode, debit, credit, balance]) =>
    ({ date, voucher, no, mode, debit, credit, balance }));

const rowNo = (no) => statement().find((r) => r.no === no);
// A summary tile's value, by its label.
const tile = (label) => [...document.querySelectorAll('div')]
  .filter((d) => [...d.children].some((c) => c.textContent.trim() === label))
  .map((d) => d.textContent.trim().replace(label, ''))
  .sort((a, b) => a.length - b.length)[0];

const closing = () => statement().find((r) => r.voucher === 'closingBalance').balance;

describe('Party statement credits the relief, not the cash', () => {
  it('credits ₹54,422 for a receipt of ₹53,500 that carried ₹922 of TDS', () => {
    mount();
    expect(rowNo('RCPT-1').credit).toBe('₹54,422');
  });

  it('credits ₹19,470 for the ₹19,140 receipt that carried ₹330', () => {
    mount();
    expect(rowNo('RCPT-2').credit).toBe('₹19,470');
  });

  it('closes at zero — every bill is settled, so nothing is left owing', () => {
    mount();
    expect(closing()).toBe('₹0');
  });

  it('the invoices are untouched: they still debit their own amount', () => {
    mount();
    expect(rowNo('MW-24-25-7').debit).toBe('₹47,578');
    expect(rowNo('MW-24-25-7').credit).toBe('');
    expect(rowNo('MW-24-25-19').debit).toBe('₹19,470');
  });

  it('Total Received still reports the CASH, not the relief', () => {
    mount();
    // 53,500 + 19,140 reached the bank; the ₹1,252 of TDS never did, so it
    // belongs in the balance but not in what was received.
    expect(tile('totalReceived')).toBe('₹72,640');
    // Total Invoiced is the three bills, untouched by any of this.
    expect(tile('totalInvoiced')).toBe('₹73,892');
  });

  it('a receipt with no relief on it still credits its own amount', () => {
    // Receipts recorded before the server sent `relief`, and any receipt that
    // was pure cash, are unchanged.
    mount([
      { id: 'i1', docType: 'invoice', collectionName: 'invoices', label: 'Sales Invoice', number: 'A', date: '2024-01-01', amount: 1000, unpaid: 0 },
      { id: 'p1', docType: 'payment_in', collectionName: 'payments', label: 'Payment In', number: 'R', date: '2024-01-02', amount: 400, unpaid: 0 },
    ]);
    expect(rowNo('R').credit).toBe('₹400');
    expect(closing()).toBe('₹600');
  });

  it('a write-off relieves the party the same way TDS does', () => {
    mount([
      { id: 'i1', docType: 'invoice', collectionName: 'invoices', label: 'Sales Invoice', number: 'A', date: '2024-01-01', amount: 10000, unpaid: 0 },
      { id: 'p1', docType: 'payment_in', collectionName: 'payments', label: 'Payment In', number: 'R', date: '2024-01-02', amount: 9800, relief: 10000, tds: 0, writeOff: 200, unpaid: 0 },
    ]);
    expect(rowNo('R').credit).toBe('₹10,000');
    expect(closing()).toBe('₹0');
  });
});
