/**
 * The GST rate that gets SAVED is the rate the screen showed.
 *
 * The bug this closes: the bill-level dropdown, not the lines, decided what was
 * sent. Set every row to 12% while that box still read 18% and the invoice was
 * saved at 18% — the totals panel said ₹120, the invoice kept ₹180. On an edit
 * it looked worse still: "Invoice updated" appeared and nothing had changed.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { renderScreen } from './renderScreen.jsx';

const created = [];
const updated = [];

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
      createInvoice: vi.fn(async (b) => { created.push(b); return { invoiceNo: 'MPW-001', ...b }; }),
      updateInvoice: vi.fn(async (id, b) => { updated.push({ id, body: b }); return { invoiceNo: 'MPW-001', ...b }; }),
    },
    ordersApi: { ...actual.ordersApi, searchClients: vi.fn(async () => []) },
  };
});

const { default: CreateInvoiceFlow } = await import('../src/components/common/CreateInvoiceFlow.jsx');

const INVOICE_AT_18 = {
  id: 'inv1', invoiceNo: 'MPW-001', type: 'invoice', status: 'unpaid', date: '2026-09-20',
  clientId: 'c1', clientName: 'Sharma', clientGstNo: '', gstRate: 18, paidAmount: 0,
  items: [{ name: 'Flyers', hsn: '4911', qty: 1, rate: 1000, amount: 1000 }],
  subtotal: 1000, cgst: 90, sgst: 90, taxTotal: 180, total: 1180, discount: 0,
};

const line = (i = 0) => ({
  name: screen.getAllByPlaceholderText('Item')[i],
  qty: screen.getAllByPlaceholderText('Qty')[i],
  price: screen.getAllByPlaceholderText('Price')[i],
  gst: screen.getAllByTestId('line-gst')[i],
});
const save = () => fireEvent.click(screen.getByRole('button', { name: /^Save( changes)?$/i }));

async function openNew() {
  renderScreen(CreateInvoiceFlow, { props: { onClose: () => {}, onCreated: () => {} } });
  fireEvent.click(screen.getByText(/GST Tax Invoice/i));
  await waitFor(() => expect(screen.getAllByPlaceholderText('Item').length).toBeGreaterThan(0));
}
async function openEdit(invoice = INVOICE_AT_18) {
  renderScreen(CreateInvoiceFlow, { props: { invoice, onClose: () => {}, onCreated: () => {} } });
  await waitFor(() => expect(screen.getAllByPlaceholderText('Item').length).toBeGreaterThan(0));
}

beforeEach(() => { created.length = 0; updated.length = 0; });

describe('creating', () => {
  it('saves the rate set on the row, not the one in the bill-level box', async () => {
    await openNew();
    fireEvent.change(line().name, { target: { value: 'Flyers' } });
    fireEvent.change(line().price, { target: { value: '1000' } });
    fireEvent.change(line().gst, { target: { value: '12' } });
    // The panel says 12% — ₹60 + ₹60.
    await waitFor(() => expect(screen.getByText('CGST @6%').parentElement.textContent).toContain('₹60'));
    fireEvent.change(screen.getByPlaceholderText('Or type a new party name'), { target: { value: 'Sharma' } });
    save();
    await waitFor(() => expect(created).toHaveLength(1));
    expect(created[0].gstRate, 'what the screen showed').toBe(12);
    expect(created[0].items[0].taxRate).toBe(12);
  });

  it('still sends per-line rates when they genuinely differ', async () => {
    await openNew();
    fireEvent.change(line(0).name, { target: { value: 'Books' } });
    fireEvent.change(line(0).price, { target: { value: '1000' } });
    fireEvent.change(line(0).gst, { target: { value: '5' } });
    fireEvent.click(screen.getByText('+ Add Item'));
    await waitFor(() => expect(screen.getAllByPlaceholderText('Item').length).toBe(2));
    fireEvent.change(line(1).name, { target: { value: 'Design' } });
    fireEvent.change(line(1).price, { target: { value: '2000' } });
    fireEvent.change(line(1).gst, { target: { value: '18' } });
    fireEvent.change(screen.getByPlaceholderText('Or type a new party name'), { target: { value: 'Sharma' } });
    save();
    await waitFor(() => expect(created).toHaveLength(1));
    expect(created[0].gstRate, 'no single rate describes this bill').toBeUndefined();
    expect(created[0].items.map((i) => i.taxRate)).toEqual([5, 18]);
  });
});

describe('editing an existing invoice', () => {
  it('changing the bill-level rate is actually saved', async () => {
    await openEdit();
    fireEvent.change(screen.getByTestId('invoice-gst'), { target: { value: '12' } });
    await waitFor(() => expect(screen.getByText('CGST @6%').parentElement.textContent).toContain('₹60'));
    save();
    await waitFor(() => expect(updated).toHaveLength(1));
    expect(updated[0].id).toBe('inv1');
    expect(updated[0].body.gstRate).toBe(12);
    expect(updated[0].body.items[0].taxRate).toBe(12);
  });

  it('changing a row\'s rate is actually saved', async () => {
    await openEdit();
    fireEvent.change(line().gst, { target: { value: '5' } });
    save();
    await waitFor(() => expect(updated).toHaveLength(1));
    expect(updated[0].body.gstRate).toBe(5);
  });

  it('goes through update, never create — an edit must not raise a second bill', async () => {
    await openEdit();
    fireEvent.change(screen.getByTestId('invoice-gst'), { target: { value: '5' } });
    save();
    await waitFor(() => expect(updated).toHaveLength(1));
    expect(created).toHaveLength(0);
  });
});

describe('the bill-level rate and per-row overrides', () => {
  it('picking a bill rate puts every row back on it', async () => {
    await openNew();
    fireEvent.change(line().name, { target: { value: 'Flyers' } });
    fireEvent.change(line().price, { target: { value: '1000' } });
    fireEvent.change(line().gst, { target: { value: '5' } });
    expect(screen.getByTestId('own-rate-note').textContent).toContain('1 line');
    // Without this, the dropdown would appear to do nothing to that row.
    fireEvent.change(screen.getByTestId('invoice-gst'), { target: { value: '28' } });
    await waitFor(() => expect(screen.queryByTestId('own-rate-note')).toBeNull());
    expect(line().gst.value, 'back to following the bill').toBe('');
    fireEvent.change(screen.getByPlaceholderText('Or type a new party name'), { target: { value: 'Sharma' } });
    save();
    await waitFor(() => expect(created).toHaveLength(1));
    expect(created[0].gstRate).toBe(28);
  });

  it('says so when a row carries its own rate', async () => {
    await openNew();
    expect(screen.queryByTestId('own-rate-note')).toBeNull();
    fireEvent.change(line().gst, { target: { value: '12' } });
    expect(screen.getByTestId('own-rate-note')).toBeTruthy();
  });
});
