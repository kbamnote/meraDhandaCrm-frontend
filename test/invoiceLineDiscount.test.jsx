/**
 * A discount on one product only, alongside the whole-bill discount.
 *
 * Each line can carry its own discount (% of the line or flat ₹). It comes off
 * that line before GST, and the bill Discount is then spread over what the
 * lines come to after it. The server does the same sum; these pin the form's
 * live totals, the body it sends and the printed document.
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

const { default: CreateInvoiceFlow, lineDiscount } = await import('../src/components/common/CreateInvoiceFlow.jsx');
const { default: InvoiceDocument } = await import('../src/components/common/InvoiceDocument.jsx');

const rowN = (i) => ({
  name: screen.getAllByPlaceholderText('Item')[i],
  qty: screen.getAllByPlaceholderText('Qty')[i],
  price: screen.getAllByPlaceholderText('Price')[i],
  gst: screen.getAllByTestId('line-gst')[i],
  disc: screen.getAllByTestId('line-disc')[i],
  discType: screen.getAllByTestId('line-disc-type')[i],
});
const setLineDiscount = (i, value, type = 'percent') => {
  fireEvent.change(rowN(i).discType, { target: { value: type } });
  fireEvent.change(rowN(i).disc, { target: { value: String(value) } });
};
const fillLine = (i, name, qty, price, gst) => {
  const r = rowN(i);
  fireEvent.change(r.name, { target: { value: name } });
  fireEvent.change(r.qty, { target: { value: String(qty) } });
  fireEvent.change(r.price, { target: { value: String(price) } });
  if (gst !== undefined) fireEvent.change(rowN(i).gst, { target: { value: String(gst) } });
};
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

describe('lineDiscount', () => {
  it('percent of the line, or a flat amount', () => {
    expect(lineDiscount({ discountType: 'percent', discountValue: '10' }, 1000)).toBe(100);
    expect(lineDiscount({ discountType: 'amount', discountValue: '75' }, 1000)).toBe(75);
  });
  it('never more than the line, never negative, blank is none', () => {
    expect(lineDiscount({ discountType: 'percent', discountValue: '150' }, 200)).toBe(200);
    expect(lineDiscount({ discountType: 'amount', discountValue: '999' }, 200)).toBe(200);
    expect(lineDiscount({ discountType: 'amount', discountValue: '-5' }, 200)).toBe(0);
    expect(lineDiscount({ discountType: 'percent', discountValue: '' }, 200)).toBe(0);
  });
});

describe('the invoice form', () => {
  it('a % discount on one product reduces only that line, before GST', async () => {
    await openForm();
    fillLine(0, 'Flyers', 1, 1000);
    fireEvent.click(screen.getByText('+ Add Item'));
    await waitFor(() => expect(screen.getAllByPlaceholderText('Item').length).toBe(2));
    fillLine(1, 'Visiting cards', 1, 1000);
    setLineDiscount(0, 10);
    // Line 1 = 900, line 2 = 1,000 → taxable 1,900; 18% = 342 → total 2,242.
    await waitFor(() => expect(shown('Total Amount')).toContain('₹2,242'));
    const amounts = screen.getAllByTestId('line-amount').map((n) => n.textContent);
    expect(amounts[0]).toContain('₹900');
    expect(amounts[1]).toContain('₹1,000');
    expect(screen.getByTestId('item-discount-total').textContent).toContain('₹100');
    expect(screen.getByTestId('taxable-note').textContent).toContain('₹1,900');
  });

  it('a flat ₹ product discount and the bill discount work together', async () => {
    await openForm();
    fillLine(0, 'Banner', 2, 500);      // 1,000 − ₹200 = 800
    fireEvent.click(screen.getByText('+ Add Item'));
    await waitFor(() => expect(screen.getAllByPlaceholderText('Item').length).toBe(2));
    fillLine(1, 'Stand', 1, 200);       // 200
    setLineDiscount(0, 200, 'amount');
    setDiscount(100);                   // bill discount on the remaining 1,000
    // Taxable 900; 18% = 162 → 1,062.
    await waitFor(() => expect(shown('Total Amount')).toContain('₹1,062'));
    expect(screen.getByTestId('taxable-note').textContent).toContain('₹900');
  });

  it('sends each line\'s discount and only the bill part as `discount`', async () => {
    await openForm();
    fireEvent.change(screen.getByPlaceholderText('Or type a new party name'), { target: { value: 'Sharma' } });
    fillLine(0, 'Flyers', 1, 1000);
    fireEvent.click(screen.getByText('+ Add Item'));
    await waitFor(() => expect(screen.getAllByPlaceholderText('Item').length).toBe(2));
    fillLine(1, 'Cards', 1, 500);
    setLineDiscount(0, 10);
    setDiscount(50);
    await waitFor(() => expect(shown('Total Amount')).toContain('₹'));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0].discount).toBe(50);
    expect(saved[0].items[0]).toMatchObject({ discountType: 'percent', discountValue: 10 });
    expect(saved[0].items[1].discountValue).toBeUndefined();
  });

  it('with no product discounts nothing changes', async () => {
    await openForm();
    fillLine(0, 'Flyers', 1, 10000);
    await waitFor(() => expect(shown('Total Amount')).toContain('₹11,800'));
    expect(screen.queryByTestId('item-discount-total')).toBeNull();
  });
});

describe('editing a saved invoice', () => {
  it('re-opens each line\'s discount and only the bill part in Discount', async () => {
    renderScreen(CreateInvoiceFlow, {
      props: {
        onClose: () => {}, onCreated: () => {},
        invoice: {
          id: 'inv1', invoiceNo: 'MPW-001', type: 'invoice', clientName: 'Sharma', date: '2026-09-25', gstRate: 18,
          discount: 150, billDiscount: 50, itemDiscount: 100,
          items: [
            { name: 'Flyers', qty: 1, rate: 1000, amount: 1000, itemDiscount: 100, discountType: 'percent', discountValue: 10 },
            { name: 'Cards', qty: 1, rate: 500, amount: 500 },
          ],
        },
      },
    });
    await waitFor(() => expect(screen.getAllByTestId('line-disc').length).toBe(2));
    expect(screen.getAllByTestId('line-disc')[0].value).toBe('10');
    expect(screen.getAllByTestId('line-disc-type')[0].value).toBe('percent');
    expect(screen.getByText('Discount').parentElement.querySelector('input').value).toBe('50');
  });
});

describe('the printed invoice', () => {
  it('shows a DISC column, the discounted line amounts and only the bill discount below', () => {
    renderScreen(InvoiceDocument, {
      props: {
        invoice: {
          invoiceNo: 'MPW-002', clientName: 'Sharma', date: '2026-09-25', type: 'invoice', gstRate: 18,
          items: [
            { name: 'Flyers', hsn: '4911', qty: 1, rate: 1000, amount: 1000, itemDiscount: 100, discountType: 'percent', discountValue: 10, discount: 124.32, taxable: 875.68 },
            { name: 'Cards', hsn: '4911', qty: 1, rate: 1000, amount: 1000, discount: 25.68, taxable: 974.32 },
          ],
          subtotal: 2000, discount: 150, billDiscount: 50, itemDiscount: 100, taxableValue: 1850,
          cgst: 166.5, sgst: 166.5, igst: 0, taxTotal: 333, total: 2183,
        },
      },
    });
    expect(screen.getAllByText('DISC.').length).toBeGreaterThan(0);
    const items = screen.getAllByText('Flyers')[0].closest('table');
    const rows = within(items).getAllByRole('row').map((r) => r.textContent);
    expect(rows.some((r) => r.includes('Flyers') && r.includes('10%') && r.includes('900'))).toBe(true);
    expect(rows.some((r) => r.includes('Discount') && r.includes('50') && !r.includes('150'))).toBe(true);
  });

  it('an older invoice (bill discount only) prints as before, without a DISC column', () => {
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
    expect(screen.queryAllByText('DISC.')).toHaveLength(0);
    const items = screen.getAllByText('Flyers')[0].closest('table');
    const rows = within(items).getAllByRole('row').map((r) => r.textContent);
    expect(rows.some((r) => r.includes('Discount') && r.includes('1,000'))).toBe(true);
  });
});
