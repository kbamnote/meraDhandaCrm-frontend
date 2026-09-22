/**
 * Purchases and Purchase Orders, laid out like Sales Invoices.
 *
 * What these pin down is the part that can be wrong while the page still
 * renders fine:
 *   * the Purchases KPIs come from the BILLS — a figure read from the wrong
 *     ledger account showed ₹0 against ₹96 lakh of bills
 *   * a bill's standing (paid / partial / unpaid) comes from paidAmount; its
 *     `status` is the order lifecycle, and an order is not a debt yet
 *   * the actions offered match what the server will accept — Edit/Delete
 *     hidden once paid against, Record payment only on a received bill with
 *     something outstanding
 *   * a long rupee figure shrinks inside its KPI card instead of spilling out
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent, within, render } from '@testing-library/react';
import { renderScreen } from './renderScreen.jsx';

const BILLS = {
  b1: { poNo: 'B-1', vendorName: 'Kagaz Mart', status: 'received', date: '2026-09-01', dueDate: '2020-01-01', total: 1000, taxTotal: 180, taxable: 820, paidAmount: 0 },
  b2: { poNo: 'B-2', vendorName: 'Ink House', status: 'received', date: '2026-09-02', total: 500, taxTotal: 90, taxable: 410, paidAmount: 200 },
  b3: { poNo: 'B-3', vendorName: 'Film Co', status: 'received', date: '2026-09-03', total: 300, taxTotal: 54, taxable: 246, paidAmount: 300 },
  o1: { poNo: 'PO-9', vendorName: 'Board Traders', status: 'sent', date: '2026-09-04', total: 7777, taxTotal: 0, taxable: 7777, paidAmount: 0 },
};
let ledgerAccounts = [];
const payCalls = [];

vi.mock('../src/services/realtime.js', () => ({
  db: {}, socket: { on() {}, off() {}, emit() {} },
  ref: (_db, path) => ({ path }),
  onValue: (refObj, cb) => {
    cb({ val: () => (refObj.path === 'mpw/purchaseOrders' ? BILLS : {}) });
    return () => {};
  },
  authSocket: () => {},
}));

vi.mock('../src/services/api.js', async () => {
  const actual = await vi.importActual('../src/services/api.js');
  const poList = () => Object.entries(BILLS).map(([id, p]) => ({ ...p, id }));
  return {
    ...actual,
    ledgerApi: { ...actual.ledgerApi, accounts: vi.fn(async () => ledgerAccounts) },
    accountingApi: {
      ...actual.accountingApi,
      purchaseOrders: vi.fn(async () => poList()),
      bankAccounts: vi.fn(async () => []),
      payPurchaseInvoice: vi.fn(async (id, body) => { payCalls.push({ id, body }); return {}; }),
    },
  };
});

const { default: PurchasesPage, purchaseStanding } = await import('../src/pages/accounting/PurchasesPage.jsx');
const { default: PurchaseOrdersPage } = await import('../src/pages/accounting/PurchaseOrdersPage.jsx');
const { Kpi } = await import('../src/components/common/DashboardCharts.jsx');

const kpi = (label) => {
  const card = screen.getAllByText(label).map((n) => n.closest('.card')).find((c) => c && within(c).queryByTestId('kpi-value'));
  return within(card).getByTestId('kpi-value').textContent;
};
// Tests render in the default language (Hinglish); 'Record payment' reads
// 'Payment record karein' there.
const PAY = 'Payment record karein';
const row = (no, testId) => screen.getAllByTestId(testId).find((r) => within(r).queryByText(no));

beforeEach(() => { ledgerAccounts = []; payCalls.length = 0; });

describe('purchaseStanding', () => {
  it('reads payment progress from paidAmount, and an order is not a debt', () => {
    expect(purchaseStanding({ status: 'received', total: 100, paidAmount: 0 })).toBe('unpaid');
    expect(purchaseStanding({ status: 'received', total: 100, paidAmount: 40 })).toBe('partial');
    expect(purchaseStanding({ status: 'received', total: 100, paidAmount: 100 })).toBe('paid');
    expect(purchaseStanding({ status: 'sent', total: 100, paidAmount: 0 })).toBe('sent');
    expect(purchaseStanding({ total: 100 })).toBe('draft');
  });
});

describe('Purchases page', () => {
  it('KPIs add up the received bills only', async () => {
    renderScreen(PurchasesPage);
    // 1000 + 500 + 300; the unreceived order's ₹7,777 must not be in it.
    expect(kpi('Purchases')).toBe('₹1,800');
    // 1000 + 300 still owed on B-2; B-3 is settled.
    expect(kpi('Payable')).toBe('₹1,300');
    expect(kpi('Overdue')).toBe('1');
    expect(kpi('Paid')).toBe('1');
  });

  it('explains when the supplier ledger disagrees with the unpaid bills', async () => {
    ledgerAccounts = [{ key: 'ap', balance: 414 }];
    renderScreen(PurchasesPage);
    expect(await screen.findByText(/₹886 already paid to suppliers, not yet against a bill/)).toBeTruthy();
  });

  it('offers only the actions the server will accept', () => {
    renderScreen(PurchasesPage);
    const unpaid = row('B-1', 'purchase-row');
    const partial = row('B-2', 'purchase-row');
    const order = row('PO-9', 'purchase-row');
    expect(within(unpaid).queryByText('Edit')).toBeTruthy();
    expect(within(unpaid).queryByText(PAY)).toBeTruthy();
    expect(within(partial).queryByText('Edit'), 'paid against: editing would be refused').toBeNull();
    expect(within(partial).queryByText('Delete')).toBeNull();
    expect(within(order).queryByText(PAY), 'an order is not payable yet').toBeNull();
    expect(within(order).queryByText('Mark received')).toBeTruthy();
    expect(within(row('B-3', 'purchase-row')).queryByText(PAY), 'nothing outstanding').toBeNull();
  });

  it('the Paid chip shows only settled bills', () => {
    renderScreen(PurchasesPage);
    fireEvent.click(screen.getByRole('button', { name: 'Paid' }));
    const nos = screen.getAllByTestId('purchase-row').map((r) => r.textContent);
    expect(nos).toHaveLength(1);
    expect(nos[0]).toContain('B-3');
  });

  it('records a payment against the bill, defaulting to what is outstanding', async () => {
    renderScreen(PurchasesPage);
    fireEvent.click(within(row('B-2', 'purchase-row')).getByText(PAY));
    const modal = screen.getByText(/₹300 outstanding/).closest('.card');
    fireEvent.click(within(modal).getByRole('button', { name: PAY }));
    await waitFor(() => expect(payCalls).toHaveLength(1));
    expect(payCalls[0].id).toBe('b2');
    expect(payCalls[0].body.amount).toBe(300);
  });
});

describe('Purchase Orders page', () => {
  it('KPIs split open orders from received ones', async () => {
    renderScreen(PurchaseOrdersPage);
    await screen.findAllByTestId('po-row');
    expect(kpi('Open orders')).toBe('₹7,777');
    expect(kpi('Awaiting delivery')).toBe('1');
    expect(kpi('Received')).toBe('₹1,800');
  });

  it('status chips filter, and a received order cannot be received or deleted again', async () => {
    renderScreen(PurchaseOrdersPage);
    await screen.findAllByTestId('po-row');
    const recv = row('B-1', 'po-row');
    expect(within(recv).queryByText('Receive')).toBeNull();
    expect(within(recv).queryByText('Delete')).toBeNull();
    expect(within(row('B-2', 'po-row')).queryByText('Edit'), 'paid against').toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Sent' }));
    const rows = screen.getAllByTestId('po-row');
    expect(rows).toHaveLength(1);
    expect(within(rows[0]).queryByText('Receive')).toBeTruthy();
  });
});

describe('KPI card', () => {
  it('shrinks a long figure instead of letting it overflow', () => {
    const { getAllByTestId } = render(<><Kpi label="a" value="₹900" /><Kpi label="b" value="₹96,66,550" /></>);
    const [short, long] = getAllByTestId('kpi-value');
    expect(parseInt(short.style.fontSize, 10)).toBe(24);
    expect(parseInt(long.style.fontSize, 10)).toBeLessThan(24);
    expect(parseInt(long.style.minWidth, 10)).toBe(0);
  });
});
