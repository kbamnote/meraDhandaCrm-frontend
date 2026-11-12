/**
 * "Export Excel" on Sales Invoices and Purchase Invoices.
 *
 * The file holds exactly the rows the page is showing (filters applied), with
 * amounts as numbers so Excel can add them up.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { renderScreen } from './renderScreen.jsx';
import { salesInvoiceGrid, purchaseGrid } from '../src/utils/invoiceExport.js';

const INVOICES = {
  i1: { invoiceNo: 'MW-26-27-164', type: 'invoice', clientName: 'ROSHNI', date: '2026-11-06', status: 'unpaid',
    subtotal: 910, taxableValue: 910, cgst: 81.9, sgst: 81.9, igst: 0, taxTotal: 163.8, roundOff: 0.2, total: 1074, paidAmount: 0, createdAt: 3 },
  i2: { invoiceNo: 'MW-26-27-163', type: 'invoice', clientName: 'STAR SIGNS', date: '2026-11-04', status: 'paid',
    subtotal: 2350, cgst: 211.5, sgst: 211.5, taxTotal: 423, total: 2773, paidAmount: 2773, createdAt: 2 },
  i3: { invoiceNo: 'MW-26-27-160', type: 'invoice', clientName: 'Old Co', date: '2026-10-01', status: 'void',
    subtotal: 100, taxTotal: 18, total: 118, paidAmount: 0, createdAt: 1 },
};
const BILLS = {
  b1: { poNo: 'PB-2627-078', supplierInvoiceNo: 'KT/88', vendorName: 'KEYAL TRADERS', vendorGstNo: '27AAA', status: 'received',
    date: '2026-11-07', total: 1534, taxTotal: 234, taxable: 1300, cgst: 117, sgst: 117, paidAmount: 0 },
  b2: { poNo: 'PB-2627-077', vendorName: 'KEYAL TRADERS', status: 'received', date: '2026-11-06', total: 3221, taxTotal: 491.4, taxable: 2730, paidAmount: 3221 },
  o1: { poNo: 'PO-9', vendorName: 'Board Traders', status: 'sent', date: '2026-11-01', total: 7777, taxable: 7777, paidAmount: 0 },
};
const exported = [];

vi.mock('../src/components/common/reportExport.jsx', async () => {
  const actual = await vi.importActual('../src/components/common/reportExport.jsx');
  return { ...actual, downloadExcel: vi.fn((name, grid) => exported.push({ name, grid })) };
});
vi.mock('../src/services/realtime.js', () => ({
  db: {}, socket: { on() {}, off() {}, emit() {} },
  ref: (_db, path) => ({ path }),
  onValue: (r, cb) => {
    cb({ val: () => (r.path === 'mpw/invoices' ? INVOICES : r.path === 'mpw/purchaseOrders' ? BILLS : {}) });
    return () => {};
  },
  authSocket: () => {},
}));
vi.mock('../src/services/api.js', async () => {
  const actual = await vi.importActual('../src/services/api.js');
  return {
    ...actual,
    ledgerApi: { ...actual.ledgerApi, accounts: vi.fn(async () => []) },
    accountingApi: {
      ...actual.accountingApi,
      purchaseOrders: vi.fn(async () => Object.entries(BILLS).map(([id, p]) => ({ ...p, id }))),
      creditNotes: vi.fn(async () => []),
      bankAccounts: vi.fn(async () => []),
    },
  };
});

const { default: SalesInvoicesPage } = await import('../src/pages/accounting/SalesInvoicesPage.jsx');
const { default: PurchasesPage, purchaseStanding } = await import('../src/pages/accounting/PurchasesPage.jsx');

beforeEach(() => { exported.length = 0; });

describe('the rows', () => {
  it('sales: numbers stay numbers; cancelled and paid owe nothing', () => {
    const g = salesInvoiceGrid(Object.values(INVOICES));
    const col = (name) => g.headers.indexOf(name);
    expect(g.rows).toHaveLength(3);
    const [a, b, c] = g.rows;
    expect(a[col('Invoice No')]).toBe('MW-26-27-164');
    expect(a[col('Total (₹)')]).toBe(1074);
    expect(a[col('Taxable (₹)')]).toBe(910);
    expect(a[col('Balance (₹)')]).toBe(1074);
    expect(b[col('Taxable (₹)')]).toBe(2350);   // falls back to subtotal − discount
    expect(b[col('Balance (₹)')]).toBe(0);
    expect(c[col('Status')]).toBe('Cancelled');
    expect(c[col('Balance (₹)')]).toBe(0);
  });

  it('purchases: status matches the page; an order is not owed', () => {
    const g = purchaseGrid(Object.values(BILLS), purchaseStanding);
    const col = (name) => g.headers.indexOf(name);
    expect(g.rows.map((r) => r[col('Status')])).toEqual(['Unpaid', 'Paid', 'Order sent']);
    expect(g.rows[0][col('Supplier Bill No')]).toBe('KT/88');
    expect(g.rows[0][col('Balance (₹)')]).toBe(1534);
    expect(g.rows[2][col('Balance (₹)')]).toBe(0);
  });
});

describe('the buttons', () => {
  it('Sales Invoices exports what the list shows (with a chip filter on)', async () => {
    renderScreen(SalesInvoicesPage);
    await waitFor(() => expect(screen.getByTestId('export-excel').disabled).toBe(false));
    fireEvent.click(screen.getByRole('button', { name: /^Paid$/ }));
    fireEvent.click(screen.getByTestId('export-excel'));
    expect(exported).toHaveLength(1);
    expect(exported[0].name).toMatch(/^sales-invoices-\d{4}-\d{2}-\d{2}\.xlsx$/);
    expect(exported[0].grid.rows.map((r) => r[0])).toEqual(['MW-26-27-163']);
  });

  it('Purchase Invoices exports what the list shows', async () => {
    renderScreen(PurchasesPage);
    await waitFor(() => expect(screen.getByTestId('export-excel').disabled).toBe(false));
    fireEvent.click(screen.getByTestId('export-excel'));
    expect(exported).toHaveLength(1);
    expect(exported[0].name).toMatch(/^purchase-invoices-.*\.xlsx$/);
    expect(exported[0].grid.rows).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: /^Unpaid$/ }));
    fireEvent.click(screen.getByTestId('export-excel'));
    expect(exported[1].grid.rows.map((r) => r[0])).toEqual(['PB-2627-078']);
  });
});
