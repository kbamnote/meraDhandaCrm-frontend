/**
 * Per-item GST on a sales invoice.
 *
 * A bill often mixes rates — printing at 5%, design at 18% — and a single
 * invoice-level rate silently over- or under-charges the tax on every line it
 * does not fit. What is pinned here:
 *   * a line with no rate of its own follows the invoice rate (unchanged
 *     behaviour, and the reason old invoices still add up)
 *   * a line with its own rate is taxed at it, and the totals are the SUM of
 *     the per-line tax, not one blended rate over the whole bill
 *   * the saved payload matches: one rate → invoice-level gstRate as before;
 *     mixed → no gstRate at all, and each line carries its own
 *   * the printed document groups the HSN summary by rate, because the same HSN
 *     at two rates is two lines on GSTR-1
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent, within } from '@testing-library/react';
import { renderScreen } from './renderScreen.jsx';

const CATALOG = {
  p1: { name: 'Book printing', hsn: '4901', price: 1000, unit: 'pcs', stock: 50, trackStock: 'yes', type: 'product', gst: 5 },
  p2: { name: 'Design charges', hsn: '9983', price: 2000, type: 'service', trackStock: 'no' },
};

vi.mock('../src/services/realtime.js', () => ({
  db: { __backend: 'test' }, socket: { on() {}, off() {}, emit() {} },
  ref: (_db, path) => ({ path }),
  onValue: (refObj, cb) => {
    cb({ val: () => (refObj.path === 'mpw/products' ? CATALOG : {}) });
    return () => {};
  },
  authSocket: () => {},
}));

const saved = [];
vi.mock('../src/services/api.js', async () => {
  const actual = await vi.importActual('../src/services/api.js');
  return {
    ...actual,
    accountingApi: {
      ...actual.accountingApi,
      invoiceDefaults: vi.fn(async () => ({
        invoicePrefix: 'MPW', invoiceNumber: '001', terms: '', states: [],
        companyState: 'Maharashtra', invoiceRounding: 'nearest',
      })),
      partyAdvance: vi.fn(async () => ({ available: 0 })),
      createInvoice: vi.fn(async (b) => { saved.push(b); return { invoiceNo: 'MPW-001', ...b }; }),
    },
    ordersApi: { ...actual.ordersApi, searchClients: vi.fn(async () => []) },
  };
});

const { effectiveRate } = await import('../src/components/common/CreateInvoiceFlow.jsx');
const { default: CreateInvoiceFlow } = await import('../src/components/common/CreateInvoiceFlow.jsx');
const { default: InvoiceDocument } = await import('../src/components/common/InvoiceDocument.jsx');

async function openForm() {
  renderScreen(CreateInvoiceFlow, { props: { onClose: () => {}, onCreated: () => {} } });
  fireEvent.click(screen.getByText(/GST Tax Invoice/i));
  await waitFor(() => expect(screen.getAllByPlaceholderText('Item').length).toBeGreaterThan(0));
}
const rowN = (i) => ({
  name: screen.getAllByPlaceholderText('Item')[i],
  qty: screen.getAllByPlaceholderText('Qty')[i],
  price: screen.getAllByPlaceholderText('Price')[i],
  gst: screen.getAllByTestId('line-gst')[i],
});
const fillLine = (i, name, qty, price, gst) => {
  const r = rowN(i);
  fireEvent.change(r.name, { target: { value: name } });
  fireEvent.change(r.qty, { target: { value: String(qty) } });
  fireEvent.change(r.price, { target: { value: String(price) } });
  if (gst !== undefined) fireEvent.change(rowN(i).gst, { target: { value: String(gst) } });
};
const amountShown = (label) => screen.getByText(label).parentElement.textContent;

beforeEach(() => { saved.length = 0; });

describe('effectiveRate', () => {
  it('falls back to the invoice rate only when the line has none', () => {
    expect(effectiveRate({ taxRate: '' }, '18')).toBe(18);
    expect(effectiveRate({}, '18')).toBe(18);
    expect(effectiveRate({ taxRate: '5' }, '18')).toBe(5);
    expect(effectiveRate({ taxRate: '0' }, '18')).toBe(0);
  });
});

describe('the invoice form', () => {
  it('gives every line its own GST box, defaulting to the invoice rate', async () => {
    await openForm();
    const box = screen.getAllByTestId('line-gst')[0];
    expect(box.value).toBe('');
    expect(within(box).getByText('18% ▾')).toBeTruthy();
  });

  it('taxes each line at its own rate and adds them up', async () => {
    await openForm();
    fillLine(0, 'Book printing', 1, 1000, 5);
    fireEvent.click(screen.getByText('+ Add Item'));
    await waitFor(() => expect(screen.getAllByPlaceholderText('Item').length).toBe(2));
    fillLine(1, 'Design charges', 1, 2000, 18);
    // 5% of 1000 + 18% of 2000 = 410, NOT 18% of 3000 (540) or 5% of 3000.
    await waitFor(() => expect(amountShown('CGST')).toContain('₹205'));
    expect(amountShown('SGST')).toContain('₹205');
    expect(screen.getByTestId('gst-split').textContent).toContain('GST @5% on ₹1,000');
    expect(screen.getByTestId('gst-split').textContent).toContain('GST @18% on ₹2,000');
    expect(screen.getByText('Total Amount').parentElement.textContent).toContain('₹3,410');
  });

  it('a line left on the default follows the invoice rate', async () => {
    await openForm();
    fillLine(0, 'Flyers', 1, 1000);
    await waitFor(() => expect(amountShown('CGST @9%')).toContain('₹90'));
    // Nothing to split: one rate across the bill.
    expect(screen.queryByTestId('gst-split')).toBeNull();
  });

  it('saves one rate as the invoice rate, and mixed rates per line', async () => {
    await openForm();
    fireEvent.change(screen.getByPlaceholderText('Or type a new party name'), { target: { value: 'Sharma' } });
    fillLine(0, 'Flyers', 1, 1000);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0].gstRate, 'a single-rate bill is sent the way it always was').toBe(18);
    expect(saved[0].items[0].taxRate).toBe(18);

    fireEvent.change(rowN(0).gst, { target: { value: '5' } });
    fireEvent.click(screen.getByText('+ Add Item'));
    await waitFor(() => expect(screen.getAllByPlaceholderText('Item').length).toBe(2));
    fillLine(1, 'Design', 1, 2000, 18);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(saved).toHaveLength(2));
    expect(saved[1].gstRate, 'no single rate can describe this bill').toBeUndefined();
    expect(saved[1].items.map((i) => i.taxRate)).toEqual([5, 18]);
  });

  it('picking a catalog item brings its own GST rate', async () => {
    await openForm();
    fireEvent.change(rowN(0).name, { target: { value: 'Book' } });
    fireEvent.click(await screen.findByText('Book printing'));
    await waitFor(() => expect(rowN(0).gst.value).toBe('5'));
  });
});

describe('the printed invoice', () => {
  const MIXED = {
    invoiceNo: 'MPW-001', clientName: 'Sharma', date: '2026-09-24', type: 'invoice',
    items: [
      { name: 'Book printing', hsn: '4901', qty: 1, rate: 1000, amount: 1000, taxRate: 5 },
      { name: 'Design charges', hsn: '9983', qty: 1, rate: 2000, amount: 2000, taxRate: 18 },
    ],
    subtotal: 3000, cgst: 205, sgst: 205, igst: 0, taxTotal: 410, total: 3410, gstRate: null,
  };

  it('shows each line its rate and splits the HSN summary by rate', () => {
    renderScreen(InvoiceDocument, { props: { invoice: MIXED } });
    // The document renders one copy per GST copy (Original/Duplicate); the
    // first is representative.
    const summary = screen.getAllByText('Taxable Value')[0].closest('table');
    const rows = within(summary).getAllByRole('row').map((r) => r.textContent);
    expect(rows.some((r) => r.includes('4901') && r.includes('2.5%'))).toBe(true);
    expect(rows.some((r) => r.includes('9983') && r.includes('9%'))).toBe(true);
    // The old code taxed every HSN at the invoice rate, which here is null →
    // every row would read 0%.
    expect(rows.some((r) => r.includes('0%'))).toBe(false);
  });

  it('the same HSN at two rates is two summary rows, not one merged row', () => {
    // GSTR-1 reports HSN *and* rate, so merging them would understate the tax
    // on the higher-rated half.
    renderScreen(InvoiceDocument, {
      props: {
        invoice: {
          ...MIXED,
          items: [
            { name: 'Books', hsn: '4901', qty: 1, rate: 1000, amount: 1000, taxRate: 5 },
            { name: 'Brochures', hsn: '4901', qty: 1, rate: 2000, amount: 2000, taxRate: 12 },
          ],
        },
      },
    });
    const summary = screen.getAllByText('Taxable Value')[0].closest('table');
    const rows = within(summary).getAllByRole('row').map((r) => r.textContent);
    expect(rows.filter((r) => r.includes('4901'))).toHaveLength(2);
    expect(rows.some((r) => r.includes('4901') && r.includes('2.5%') && r.includes('25')), '5% on ₹1,000').toBe(true);
    expect(rows.some((r) => r.includes('4901') && r.includes('6%') && r.includes('120')), '12% on ₹2,000').toBe(true);
  });

  it('an invoice billed at one rate still prints that rate on the tax rows', () => {
    const single = {
      ...MIXED, gstRate: 18, cgst: 90, sgst: 90, taxTotal: 180, total: 1180,
      items: [{ name: 'Flyers', hsn: '4911', qty: 1, rate: 1000, amount: 1000 }],
    };
    renderScreen(InvoiceDocument, { props: { invoice: single } });
    expect(screen.getAllByText('CGST@9%').length).toBeGreaterThan(0);
  });
});
