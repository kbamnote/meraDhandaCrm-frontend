/**
 * Purchases can be viewed as a document and edited, the way sales invoices can.
 *
 * Asserted at the level where each thing can actually go wrong:
 *   * the document puts the SUPPLIER as issuer and US as buyer — the reverse of a
 *     sales invoice, and the easiest thing to get backwards
 *   * editing prefills the saved bill and calls UPDATE, never create — a form
 *     that silently re-creates would duplicate the purchase, its ledger entry
 *     and its stock
 *   * round-off is inferred correctly on reopen, because the bill does not
 *     store the switch and guessing wrong silently re-rounds the total on save
 *   * a bill that cannot be edited says why instead of offering a dead button
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent, within } from '@testing-library/react';
import { renderScreen } from './renderScreen.jsx';

const BILL = {
  id: 'pb1', poNo: 'SUP-778', supplierInvoiceNo: 'SUP-778', status: 'received',
  date: '2026-09-10', dueDate: '2026-10-10',
  vendorId: 'v1', vendorName: 'Kagaz Paper Mart', vendorGstNo: '27AAAAA0000A1Z5',
  vendorAddress: 'Itwari, Nagpur', vendorPhone: '9000000001',
  buyer: { name: 'MRPRINT WORLD PRIVATE LIMITED', gstNo: '27BBBBB1111B1Z6', address: 'Zade Bhavan, Nagpur' },
  items: [
    { name: 'Art Paper 300gsm', hsn: '4810', qty: 100, rate: 50, discount: 0, taxRate: 18, amount: 5000, tax: 900, itemId: 'prod1', unit: 'sheet' },
    { name: 'Lamination Film', hsn: '3920', qty: 10, rate: 200, discount: 0, taxRate: 12, amount: 2000, tax: 240, itemId: 'prod2' },
  ],
  subtotal: 7000, taxable: 7000, discount: 0,
  cgst: 570, sgst: 570, igst: 0, taxTotal: 1140, interState: false,
  additionalCharges: [{ label: 'Freight', amount: 150 }], chargesTotal: 150,
  tcsAmount: 0, tdsAmount: 0, rawTotal: 8290, roundOff: 0, total: 8290,
  paidAmount: 0, notes: 'Deliver to back gate', terms: '',
  editable: true, editBlockedReason: null,
};

const calls = { create: [], update: [] };
let current = { ...BILL };

vi.mock('../src/services/realtime.js', () => ({
  db: {}, socket: { on() {}, off() {}, emit() {} },
  ref: (_db, path) => ({ path }),
  onValue: (refObj, cb) => {
    if (refObj.path === 'mpw/products') {
      cb({ val: () => ({ prod1: { name: 'Art Paper 300gsm', stock: 150 }, prod2: { name: 'Lamination Film', stock: 30 } }) });
    } else cb({ val: () => ({}) });
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
      getPurchaseInvoice: vi.fn(async () => current),
      updatePurchaseInvoice: vi.fn(async (id, body) => { calls.update.push({ id, body }); return { ...current, ...body }; }),
      createPurchaseInvoice: vi.fn(async (body) => { calls.create.push(body); return { id: 'new', ...body }; }),
      invoiceDefaults: vi.fn(async () => ({ states: [], companyState: 'Maharashtra' })),
    },
  };
});

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useSearchParams: () => [new URLSearchParams('id=pb1')] };
});

describe('the purchase document', () => {
  it('puts the supplier as issuer and us as the buyer', async () => {
    const { default: PurchaseDocument } = await import('../src/components/common/PurchaseDocument.jsx');
    renderScreen(PurchaseDocument, { props: { purchase: BILL } });
    const docEl = screen.getByTestId('purchase-document');
    // Supplier under "Bill From", us under "Bill To" — backwards on a sales invoice.
    const from = within(docEl).getByText('Bill From').parentElement;
    expect(within(from).getByText('Kagaz Paper Mart')).toBeTruthy();
    const to = within(docEl).getByText('Bill To').parentElement;
    expect(within(to).getByText('MRPRINT WORLD PRIVATE LIMITED')).toBeTruthy();
  });

  it('shows the supplier\'s bill number and the total', async () => {
    const { default: PurchaseDocument } = await import('../src/components/common/PurchaseDocument.jsx');
    renderScreen(PurchaseDocument, { props: { purchase: BILL } });
    expect(screen.getByTestId('bill-no').textContent).toBe('SUP-778');
    expect(screen.getByTestId('bill-total').textContent).toMatch(/8,290\.00/);
  });

  it('lists every line', async () => {
    const { default: PurchaseDocument } = await import('../src/components/common/PurchaseDocument.jsx');
    renderScreen(PurchaseDocument, { props: { purchase: BILL } });
    expect(screen.getAllByTestId('purchase-line')).toHaveLength(2);
  });

  it('keeps different tax rates on separate rows of the tax summary', async () => {
    // The two lines are taxed at 18% and 12%. Merging them into one rate would
    // misstate the input credit on each.
    const { default: PurchaseDocument } = await import('../src/components/common/PurchaseDocument.jsx');
    renderScreen(PurchaseDocument, { props: { purchase: BILL } });
    expect(screen.getAllByText('18%').length).toBeGreaterThan(0);
    expect(screen.getAllByText('12%').length).toBeGreaterThan(0);
  });

  it('spells the total out in words', async () => {
    const { default: PurchaseDocument } = await import('../src/components/common/PurchaseDocument.jsx');
    renderScreen(PurchaseDocument, { props: { purchase: BILL } });
    expect(screen.getByText(/Eight Thousand Two Hundred Ninety/)).toBeTruthy();
  });
});

describe('editing a purchase', () => {
  beforeEach(() => { calls.create.length = 0; calls.update.length = 0; current = { ...BILL }; });

  async function openEditor(bill) {
    const { default: CreatePurchaseFlow } = await import('../src/components/common/CreatePurchaseFlow.jsx');
    renderScreen(CreatePurchaseFlow, { props: { purchase: bill, onClose: () => {}, onCreated: () => {} } });
    await waitFor(() => expect(screen.getByText(/Edit Purchase SUP-778/)).toBeTruthy());
  }

  it('opens titled as an edit, with the saved lines filled in', async () => {
    await openEditor(BILL);
    const names = screen.getAllByPlaceholderText('Item').map((el) => el.value);
    expect(names).toEqual(['Art Paper 300gsm', 'Lamination Film']);
    expect(screen.getByDisplayValue('SUP-778')).toBeTruthy();
  });

  it('saving calls UPDATE, never create', async () => {
    await openEditor(BILL);
    fireEvent.click(screen.getByRole('button', { name: /^Save$/i }));
    await waitFor(() => expect(calls.update.length).toBe(1));
    expect(calls.create.length).toBe(0);
    expect(calls.update[0].id).toBe('pb1');
  });

  it('sends the corrected quantity', async () => {
    await openEditor(BILL);
    const qty = screen.getAllByDisplayValue('100')[0];
    fireEvent.change(qty, { target: { value: '60' } });
    fireEvent.click(screen.getByRole('button', { name: /^Save$/i }));
    await waitFor(() => expect(calls.update.length).toBe(1));
    expect(calls.update[0].body.items[0].qty).toBe(60);
  });

  it('keeps the catalog link on each line, so the stock follows the edit', async () => {
    await openEditor(BILL);
    fireEvent.click(screen.getByRole('button', { name: /^Save$/i }));
    await waitFor(() => expect(calls.update.length).toBe(1));
    expect(calls.update[0].body.items.map((it) => it.itemId)).toEqual(['prod1', 'prod2']);
  });

  it('never sends payment fields on an edit', async () => {
    await openEditor(BILL);
    fireEvent.click(screen.getByRole('button', { name: /^Save$/i }));
    await waitFor(() => expect(calls.update.length).toBe(1));
    const body = calls.update[0].body;
    for (const k of ['markFullyPaid', 'paidAmount', 'paymentMode', 'bankAccountId']) {
      expect(k in body, `${k} must not be sent`).toBe(false);
    }
  });

  it('hides payment capture on an edit', async () => {
    await openEditor(BILL);
    expect(screen.queryByText(/Mark as fully paid/i)).toBeNull();
  });

  it('warns that saving replaces the ledger entry and the stock receipt', async () => {
    await openEditor(BILL);
    expect(screen.getByText(/replaces this bill.s ledger entry and its stock receipt/i)).toBeTruthy();
  });
});

describe('round-off is inferred correctly on reopen', () => {
  async function autoRoundOffChecked(bill) {
    const { default: CreatePurchaseFlow } = await import('../src/components/common/CreatePurchaseFlow.jsx');
    renderScreen(CreatePurchaseFlow, { props: { purchase: bill, onClose: () => {}, onCreated: () => {} } });
    await waitFor(() => expect(screen.getByText(/Auto Round Off/i)).toBeTruthy());
    const label = screen.getByText(/Auto Round Off/i).closest('label');
    return label.querySelector('input[type="checkbox"]').checked;
  }

  it('a bill with paise in its total was NOT rounded — reopens OFF', async () => {
    // Reopening this with rounding ON would silently turn 1456.78 into 1457 on save.
    expect(await autoRoundOffChecked({ ...BILL, rawTotal: 1456.78, total: 1456.78, roundOff: 0 })).toBe(false);
  });

  it('a bill carrying a round-off WAS rounded — reopens ON', async () => {
    expect(await autoRoundOffChecked({ ...BILL, rawTotal: 1456.78, total: 1457, roundOff: 0.22 })).toBe(true);
  });

  it('a whole total is either, and rounding it changes nothing — reopens ON', async () => {
    expect(await autoRoundOffChecked({ ...BILL, rawTotal: 8290, total: 8290, roundOff: 0 })).toBe(true);
  });
});

describe('the purchase view page', () => {
  beforeEach(() => { current = { ...BILL }; });

  it('offers Edit on an editable bill', async () => {
    const { default: PurchaseViewPage } = await import('../src/pages/PurchaseViewPage.jsx');
    renderScreen(PurchaseViewPage);
    const btn = await screen.findByRole('button', { name: /Edit/i });
    expect(btn.disabled).toBe(false);
  });

  it('disables Edit on a paid bill and says why', async () => {
    current = {
      ...BILL, paidAmount: 5000, editable: false,
      editBlockedReason: '₹5000 has already been paid against this bill. Raise a debit note to adjust it instead.',
    };
    const { default: PurchaseViewPage } = await import('../src/pages/PurchaseViewPage.jsx');
    renderScreen(PurchaseViewPage);
    const btn = await screen.findByRole('button', { name: /Edit/i });
    expect(btn.disabled).toBe(true);
    expect(screen.getByText(/Raise a debit note/i)).toBeTruthy();
  });
});
