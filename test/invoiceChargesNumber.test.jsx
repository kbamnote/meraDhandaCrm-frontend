/**
 * Four things on the sales invoice:
 *   * extra charges (freight, packing) billed alongside the goods
 *   * a GST rate that is not one of the usual slabs
 *   * the number box on an EDIT showing this invoice rather than the next one
 *   * a receipt recorded by mistake being undoable — which is the only way back
 *     to editing, cancelling or deleting a bill that was marked paid
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent, within } from '@testing-library/react';
import { renderScreen, OWNER } from './renderScreen.jsx';

const saved = [];
const updated = [];
const undone = [];
let payments = [];
let invoices = {};

vi.mock('../src/services/realtime.js', () => ({
  db: { __backend: 'test' }, socket: { on() {}, off() {}, emit() {} },
  ref: (_db, path) => ({ path }),
  onValue: (refObj, cb) => {
    cb({ val: () => (String(refObj.path).endsWith('invoices') ? invoices : {}) });
    return () => {};
  },
  authSocket: () => {},
}));
vi.mock('../src/services/api.js', async () => {
  const actual = await vi.importActual('../src/services/api.js');
  return {
    ...actual,
    accountingApi: {
      ...actual.accountingApi,
      invoiceDefaults: vi.fn(async () => ({
        invoicePrefix: 'MW-26-27', invoiceNumber: '014', terms: '', states: [],
        companyState: 'Maharashtra', invoiceRounding: 'nearest',
      })),
      partyAdvance: vi.fn(async () => ({ available: 0 })),
      createInvoice: vi.fn(async (b) => { saved.push(b); return { invoiceNo: 'MW-26-27-014', ...b }; }),
      updateInvoice: vi.fn(async (id, b) => { updated.push({ id, body: b }); return { invoiceNo: 'MW-26-27-003', ...b }; }),
      invoicePayments: vi.fn(async () => payments),
      undoPayment: vi.fn(async (id) => { undone.push(id); payments = payments.filter((p) => p.id !== id); return { deleted: true }; }),
      creditNotes: vi.fn(async () => []),
    },
    ordersApi: { ...actual.ordersApi, searchClients: vi.fn(async () => []) },
  };
});

const { default: CreateInvoiceFlow } = await import('../src/components/common/CreateInvoiceFlow.jsx');
const { default: SalesInvoicesPage } = await import('../src/pages/accounting/SalesInvoicesPage.jsx');

const INVOICE = {
  id: 'inv1', invoiceNo: 'MW-26-27-003', invoicePrefix: 'MW-26-27', type: 'invoice', status: 'unpaid',
  date: '2026-09-20', clientId: 'c1', clientName: 'Sharma', gstRate: 18, paidAmount: 0,
  items: [{ name: 'Flyers', qty: 1, rate: 1000, amount: 1000 }],
  subtotal: 1000, taxableValue: 1000, cgst: 90, sgst: 90, taxTotal: 180, total: 1180, discount: 0,
};

const line = (i = 0) => ({
  name: screen.getAllByPlaceholderText('Item')[i],
  price: screen.getAllByPlaceholderText('Price')[i],
});
const shown = (label) => screen.getByText(label).parentElement.textContent;
const save = () => fireEvent.click(screen.getByRole('button', { name: /^Save( changes)?$/i }));

async function openNew() {
  renderScreen(CreateInvoiceFlow, { props: { onClose: () => {}, onCreated: () => {} } });
  fireEvent.click(screen.getByText(/GST Tax Invoice/i));
  await waitFor(() => expect(screen.getAllByPlaceholderText('Item').length).toBeGreaterThan(0));
}
async function openEdit(invoice = INVOICE) {
  renderScreen(CreateInvoiceFlow, { props: { invoice, onClose: () => {}, onCreated: () => {} } });
  await waitFor(() => expect(screen.getAllByPlaceholderText('Item').length).toBeGreaterThan(0));
}

beforeEach(() => {
  saved.length = 0; updated.length = 0; undone.length = 0;
  payments = [];
  invoices = {};
});

describe('extra charges', () => {
  it('are added to the total after the tax', async () => {
    await openNew();
    fireEvent.change(line().name, { target: { value: 'Flyers' } });
    fireEvent.change(line().price, { target: { value: '1000' } });
    await waitFor(() => expect(shown('Total Amount')).toContain('₹1,180'));
    fireEvent.click(screen.getByTestId('add-charge'));
    fireEvent.change(screen.getByPlaceholderText(/Freight/i), { target: { value: 'Freight' } });
    fireEvent.change(screen.getByTestId('charge-amount'), { target: { value: '150' } });
    // 1,000 + 180 tax + 150 freight. The charge is not taxed.
    await waitFor(() => expect(shown('Total Amount')).toContain('₹1,330'));
    expect(shown('CGST @9%')).toContain('₹90');
  });

  it('are sent with the invoice', async () => {
    await openNew();
    fireEvent.change(screen.getByPlaceholderText('Or type a new party name'), { target: { value: 'Sharma' } });
    fireEvent.change(line().name, { target: { value: 'Flyers' } });
    fireEvent.change(line().price, { target: { value: '1000' } });
    fireEvent.click(screen.getByTestId('add-charge'));
    fireEvent.change(screen.getByPlaceholderText(/Freight/i), { target: { value: 'Packing' } });
    fireEvent.change(screen.getByTestId('charge-amount'), { target: { value: '75' } });
    save();
    await waitFor(() => expect(saved).toHaveLength(1));
    // taxRate 0 = billed without GST, which is the default for a charge.
    expect(saved[0].additionalCharges).toEqual([{ label: 'Packing', amount: 75, taxRate: 0 }]);
  });

  it('an empty charge row is not sent', async () => {
    await openNew();
    fireEvent.change(screen.getByPlaceholderText('Or type a new party name'), { target: { value: 'Sharma' } });
    fireEvent.change(line().name, { target: { value: 'Flyers' } });
    fireEvent.change(line().price, { target: { value: '1000' } });
    fireEvent.click(screen.getByTestId('add-charge'));
    save();
    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0].additionalCharges).toEqual([]);
  });

  it('a charge can be taken off again', async () => {
    await openNew();
    fireEvent.click(screen.getByTestId('add-charge'));
    expect(screen.getAllByTestId('charge-row')).toHaveLength(1);
    fireEvent.click(within(screen.getAllByTestId('charge-row')[0]).getByRole('button', { name: '×' }));
    expect(screen.queryAllByTestId('charge-row')).toHaveLength(0);
  });
});

describe('a GST rate off the list', () => {
  it('can be typed, and is what gets charged', async () => {
    await openNew();
    fireEvent.change(line().name, { target: { value: 'Job work' } });
    fireEvent.change(line().price, { target: { value: '1000' } });
    fireEvent.change(screen.getByTestId('invoice-gst'), { target: { value: 'custom' } });
    fireEvent.change(screen.getByTestId('custom-gst'), { target: { value: '1.5' } });
    // 1.5% of 1,000 = 15, split 7.50 / 7.50.
    await waitFor(() => expect(shown('Total Amount')).toContain('₹1,015'));
    expect(shown('CGST @0.75%')).toContain('₹7.5');
  });

  it('is sent as the invoice rate', async () => {
    await openNew();
    fireEvent.change(screen.getByPlaceholderText('Or type a new party name'), { target: { value: 'Sharma' } });
    fireEvent.change(line().name, { target: { value: 'Job work' } });
    fireEvent.change(line().price, { target: { value: '1000' } });
    fireEvent.change(screen.getByTestId('invoice-gst'), { target: { value: 'custom' } });
    fireEvent.change(screen.getByTestId('custom-gst'), { target: { value: '1.5' } });
    save();
    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0].gstRate).toBe(1.5);
    expect(saved[0].items[0].taxRate).toBe(1.5);
  });

  it('reopens an invoice saved at an unusual rate with that rate shown', async () => {
    await openEdit({ ...INVOICE, gstRate: 1.5, taxTotal: 15, total: 1015 });
    await waitFor(() => expect(screen.getByTestId('invoice-gst').value).toBe('custom'));
    expect(screen.getByTestId('custom-gst').value).toBe('1.5');
  });
});

describe('the invoice number', () => {
  it('shows THIS invoice on an edit, not the next one', async () => {
    await openEdit();
    // The next free number is 014; this invoice is 003.
    await waitFor(() => expect(screen.getByTestId('invoice-number').value).toBe('003'));
    expect(screen.getByTestId('invoice-prefix').value).toBe('MW-26-27');
  });

  it('is locked on an edit, and says why', async () => {
    await openEdit();
    await waitFor(() => expect(screen.getByTestId('number-locked')).toBeTruthy());
    expect(screen.getByTestId('invoice-number').disabled).toBe(true);
    expect(screen.getByTestId('invoice-prefix').disabled).toBe(true);
  });

  it('is still editable when raising a new invoice', async () => {
    await openNew();
    await waitFor(() => expect(screen.getByTestId('invoice-number').value).toBe('014'));
    expect(screen.getByTestId('invoice-number').disabled).toBe(false);
    expect(screen.queryByTestId('number-locked')).toBeNull();
  });
});

describe('a bill with a payment against it', () => {
  beforeEach(() => {
    invoices = { inv1: { ...INVOICE, paidAmount: 1180, status: 'paid' } };
    payments = [{ id: 'p1', amount: 1180, date: '2026-09-21', mode: 'Cash', invoiceId: 'inv1' }];
  });

  it('says why Edit, Cancel and Delete are missing', async () => {
    renderScreen(SalesInvoicesPage, { auth: OWNER });
    await waitFor(() => expect(screen.getByTestId('why-no-delete')).toBeTruthy());
    expect(screen.getByTestId('why-no-delete').textContent).toContain('₹1,180');
    expect(screen.queryByText('Delete')).toBeNull();
  });

  it('offers the receipts, and undoing one', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderScreen(SalesInvoicesPage, { auth: OWNER });
    fireEvent.click(await screen.findByTestId('payments-btn'));
    const row = await screen.findByTestId('payment-row');
    expect(row.textContent).toContain('₹1,180');
    fireEvent.click(within(row).getByTestId('undo-payment'));
    await waitFor(() => expect(undone).toEqual(['p1']));
  });

  it('asks before undoing', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderScreen(SalesInvoicesPage, { auth: OWNER });
    fireEvent.click(await screen.findByTestId('payments-btn'));
    fireEvent.click(within(await screen.findByTestId('payment-row')).getByTestId('undo-payment'));
    expect(undone).toEqual([]);
  });

  it('an unpaid bill shows Delete and no payments button', async () => {
    invoices = { inv1: { ...INVOICE, paidAmount: 0, status: 'unpaid' } };
    renderScreen(SalesInvoicesPage, { auth: OWNER });
    await waitFor(() => expect(screen.getByText('Delete')).toBeTruthy());
    expect(screen.queryByTestId('payments-btn')).toBeNull();
    expect(screen.queryByTestId('why-no-delete')).toBeNull();
  });
});
