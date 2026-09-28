/**
 * A discount reduces the value GST is charged on.
 *
 * GST is due on what the customer is actually charged (CGST Act s.15(3)(a)), so
 * a bill discount comes off BEFORE the tax. Charging 18% on the pre-discount
 * figure and then subtracting the discount overcharges the customer and
 * overstates the GST payable.
 *
 * Pinned here: the form's live totals (which are what someone checks before
 * saving), the body sent to the server, and the printed document's HSN summary.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent, within } from '@testing-library/react';
import { renderScreen } from './renderScreen.jsx';

const saved = [];

vi.mock('../src/services/realtime.js', () => ({
  db: { __backend: 'test' }, socket: { on() {}, off() {}, emit() {} },
  ref: (_db, path) => ({ path }), onValue: (_r, cb) => { cb({ val: () => ({}) }); return () => {}; },
  authSocket: () => {},
}));
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

const { default: CreateInvoiceFlow, allocateDiscount } = await import('../src/components/common/CreateInvoiceFlow.jsx');
const { default: InvoiceDocument } = await import('../src/components/common/InvoiceDocument.jsx');

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
// The bill discount sits either side of the tax, chosen per invoice. The
// default is 'after' (tax on the full value, discount off the total); these
// tests say which one they mean rather than relying on it.
const setMode = (mode) => fireEvent.change(screen.getByTestId('discount-mode'), { target: { value: mode } });
const setDiscount = (v) => fireEvent.change(
  screen.getByText('Discount').parentElement.querySelector('input'), { target: { value: String(v) } },
);
const shown = (label) => screen.getByText(label).parentElement.textContent;

async function openForm() {
  renderScreen(CreateInvoiceFlow, { props: { onClose: () => {}, onCreated: () => {} } });
  fireEvent.click(screen.getByText(/GST Tax Invoice/i));
  await waitFor(() => expect(screen.getAllByPlaceholderText('Item').length).toBeGreaterThan(0));
}

beforeEach(() => { saved.length = 0; });

describe('allocateDiscount', () => {
  it('splits in proportion to each line', () => {
    expect(allocateDiscount([1000, 2000], 300, 3000)).toEqual([100, 200]);
  });

  it('the shares always add back to the discount exactly', () => {
    const shares = allocateDiscount([100, 100, 100], 10, 300);
    expect(shares.reduce((a, b) => a + b, 0)).toBe(10);
  });

  it('skips empty lines and cannot exceed the bill', () => {
    expect(allocateDiscount([1000, 0], 200, 1000)).toEqual([200, 0]);
    expect(allocateDiscount([1000], 5000, 1000)).toEqual([1000]);
  });

  it('no discount, no shares', () => {
    expect(allocateDiscount([1000, 2000], 0, 3000)).toEqual([0, 0]);
  });
});

describe('the invoice form', () => {
  it('charges GST on the discounted amount', async () => {
    await openForm();
    fillLine(0, 'Flyers', 1, 10000);
    setMode('before');
    setDiscount(1000);
    // 18% of 9,000 = 1,620 — not 18% of 10,000 (1,800).
    await waitFor(() => expect(shown('CGST @9%')).toContain('₹810'));
    expect(shown('SGST @9%')).toContain('₹810');
    expect(shown('Total Amount')).toContain('₹10,620');
    expect(screen.getByTestId('taxable-note').textContent).toContain('₹9,000');
  });

  it('with no discount nothing changes', async () => {
    await openForm();
    fillLine(0, 'Flyers', 1, 10000);
    await waitFor(() => expect(shown('CGST @9%')).toContain('₹900'));
    expect(shown('Total Amount')).toContain('₹11,800');
    expect(screen.queryByTestId('taxable-note')).toBeNull();
  });

  it('splits the discount across lines taxed at different rates', async () => {
    await openForm();
    fillLine(0, 'Book printing', 1, 1000, 5);
    fireEvent.click(screen.getByText('+ Add Item'));
    await waitFor(() => expect(screen.getAllByPlaceholderText('Item').length).toBe(2));
    fillLine(1, 'Design charges', 1, 2000, 18);
    setMode('before');
    setDiscount(300);
    // 5% of 900 + 18% of 1,800 = 45 + 324 = 369.
    await waitFor(() => expect(shown('Total Amount')).toContain('₹3,069'));
    const split = screen.getByTestId('gst-split').textContent;
    expect(split, 'the split is shown on the discounted values').toContain('GST @5% on ₹900');
    expect(split).toContain('GST @18% on ₹1,800');
  });

  it('sends the discount so the server charges tax on the same figure', async () => {
    await openForm();
    fireEvent.change(screen.getByPlaceholderText('Or type a new party name'), { target: { value: 'Sharma' } });
    fillLine(0, 'Flyers', 1, 10000);
    setMode('before');
    setDiscount(1000);
    await waitFor(() => expect(shown('Total Amount')).toContain('₹10,620'));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0].discount).toBe(1000);
    expect(saved[0].discountMode).toBe('before');
    expect(saved[0].gstRate).toBe(18);
  });

  it('a discount bigger than the bill leaves no negative tax or total', async () => {
    await openForm();
    fillLine(0, 'Flyers', 1, 1000);
    setMode('before');
    setDiscount(5000);
    await waitFor(() => expect(shown('Total Amount')).toContain('₹0'));
    expect(shown('CGST @9%')).toContain('₹0');
  });
});

describe('a discount after GST (the default)', () => {
  it('leaves the tax alone and comes off the total', async () => {
    await openForm();
    fillLine(0, 'Flyers', 1, 10000);
    setDiscount(1000);
    // Tax is charged on the full 10,000: 900 + 900, and the discount comes off
    // the 11,800 that follows.
    await waitFor(() => expect(shown('CGST @9%')).toContain('₹900'));
    expect(shown('SGST @9%')).toContain('₹900');
    expect(shown('Total Amount')).toContain('₹10,800');
    expect(screen.getByTestId('taxable-note').textContent).toContain('comes off the total');
  });

  it('is what a new invoice starts on', async () => {
    await openForm();
    expect(screen.getByTestId('discount-mode').value).toBe('after');
  });

  it('sends the mode, so the server charges the same tax', async () => {
    await openForm();
    fireEvent.change(screen.getByPlaceholderText('Or type a new party name'), { target: { value: 'Sharma' } });
    fillLine(0, 'Flyers', 1, 10000);
    setDiscount(1000);
    await waitFor(() => expect(shown('Total Amount')).toContain('₹10,800'));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0].discountMode).toBe('after');
    expect(saved[0].discount).toBe(1000);
  });

  it('switching to before GST changes the tax in front of you', async () => {
    await openForm();
    fillLine(0, 'Flyers', 1, 10000);
    setDiscount(1000);
    await waitFor(() => expect(shown('Total Amount')).toContain('₹10,800'));
    setMode('before');
    await waitFor(() => expect(shown('Total Amount')).toContain('₹10,620'));
    expect(shown('CGST @9%')).toContain('₹810');
  });

  it('a discount bigger than the bill cannot make the total negative', async () => {
    await openForm();
    fillLine(0, 'Flyers', 1, 1000);
    setDiscount(5000);
    // Tax still charged on 1,000; the discount is capped at the 1,180 payable.
    await waitFor(() => expect(shown('Total Amount')).toContain('₹0'));
    expect(shown('CGST @9%')).toContain('₹90');
  });
});

describe('the printed invoice', () => {
  it('reports the discounted value in the HSN summary', () => {
    renderScreen(InvoiceDocument, {
      props: {
        invoice: {
          invoiceNo: 'MPW-001', clientName: 'Sharma', date: '2026-09-25', type: 'invoice', gstRate: 18,
          items: [{ name: 'Flyers', hsn: '4911', qty: 1, rate: 10000, amount: 10000, discount: 1000, taxable: 9000 }],
          subtotal: 10000, taxableValue: 9000, discount: 1000,
          cgst: 810, sgst: 810, igst: 0, taxTotal: 1620, total: 10620,
        },
      },
    });
    const summary = screen.getAllByText('Taxable Value')[0].closest('table');
    const rows = within(summary).getAllByRole('row').map((r) => r.textContent);
    expect(rows.some((r) => r.includes('4911') && r.includes('9,000') && r.includes('810'))).toBe(true);
    expect(rows.some((r) => r.includes('10,000')), 'the billed figure is not the taxable one').toBe(false);
  });

  it('an older invoice without per-line taxable still adds up', () => {
    renderScreen(InvoiceDocument, {
      props: {
        invoice: {
          invoiceNo: 'MPW-000', clientName: 'Sharma', date: '2026-01-01', type: 'invoice', gstRate: 18,
          items: [{ name: 'Flyers', hsn: '4911', qty: 1, rate: 1000, amount: 1000 }],
          subtotal: 1000, cgst: 90, sgst: 90, taxTotal: 180, total: 1180,
        },
      },
    });
    const summary = screen.getAllByText('Taxable Value')[0].closest('table');
    expect(within(summary).getAllByRole('row').some((r) => r.textContent.includes('1,000'))).toBe(true);
  });
});
