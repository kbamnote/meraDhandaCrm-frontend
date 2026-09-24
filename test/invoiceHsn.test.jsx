/**
 * HSN codes on an invoice line.
 *
 * HSN is a legal requirement on a GST invoice and the thing most often left
 * blank, so it has to travel by itself:
 *   * picking an item fills its HSN (and typing the item's name in full links
 *     it the same way — a free-text line carries no HSN, no GST and no stock)
 *   * an HSN typed before the item is chosen is not wiped by choosing it
 *   * the "add this to your items" dialog starts from the HSN already typed
 *   * an HSN typed against an item that hasn't got one is saved back onto the
 *     item, so the next bill fills it in by itself — but an item that already
 *     has one is never overwritten by a bill
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent, within } from '@testing-library/react';
import { renderScreen } from './renderScreen.jsx';

const CATALOG = {
  p1: { name: 'Visiting Cards', hsn: '4909', price: 6, unit: 'pcs', stock: 500, trackStock: 'yes', type: 'product', gst: 12 },
  p2: { name: 'Letterheads', price: 9, unit: 'pcs', stock: 200, trackStock: 'yes', type: 'product' }, // no HSN recorded
  p3: { name: 'Design Charges', hsn: '9983', price: 500, type: 'service', trackStock: 'no' },
};

vi.mock('../src/services/realtime.js', () => ({
  db: { __backend: 'test' }, socket: { on() {}, off() {}, emit() {} },
  ref: (_db, path) => ({ path }),
  onValue: (refObj, cb) => { cb({ val: () => (refObj.path === 'mpw/products' ? CATALOG : {}) }); return () => {}; },
  authSocket: () => {},
}));

const updates = [];
const creates = [];
vi.mock('../src/services/api.js', async () => {
  const actual = await vi.importActual('../src/services/api.js');
  return {
    ...actual,
    dbApi: {
      ...actual.dbApi,
      update: vi.fn(async (col, id, patch) => { updates.push({ col, id, patch }); return { id, ...patch }; }),
      create: vi.fn(async (col, data) => { creates.push({ col, data }); return { id: 'newp', ...data }; }),
    },
    accountingApi: {
      ...actual.accountingApi,
      invoiceDefaults: vi.fn(async () => ({
        invoicePrefix: 'MPW', invoiceNumber: '001', terms: '', states: [],
        companyState: 'Maharashtra', invoiceRounding: 'nearest',
      })),
      partyAdvance: vi.fn(async () => ({ available: 0 })),
      createInvoice: vi.fn(async (b) => ({ invoiceNo: 'MPW-001', ...b })),
    },
    ordersApi: { ...actual.ordersApi, searchClients: vi.fn(async () => []) },
  };
});

const { default: CreateInvoiceFlow, backfillItemHsn } = await import('../src/components/common/CreateInvoiceFlow.jsx');

const nameBox = (i = 0) => screen.getAllByPlaceholderText('Item')[i];
const hsnBox = (i = 0) => screen.getAllByPlaceholderText('HSN/SAC')[i];
const priceBox = (i = 0) => screen.getAllByPlaceholderText('Price')[i];

async function openForm() {
  renderScreen(CreateInvoiceFlow, { props: { onClose: () => {}, onCreated: () => {} } });
  fireEvent.click(screen.getByText(/GST Tax Invoice/i));
  await waitFor(() => expect(screen.getAllByPlaceholderText('Item').length).toBeGreaterThan(0));
}

beforeEach(() => { updates.length = 0; creates.length = 0; });

describe('backfillItemHsn', () => {
  const catalog = [{ id: 'p1', hsn: '4909' }, { id: 'p2', hsn: '' }, { id: 'p3', hsn: null }];
  const run = (lines) => backfillItemHsn(lines, catalog, async (col, id, patch) => { updates.push({ col, id, patch }); });

  it('fills an item that has no HSN', async () => {
    await run([{ itemId: 'p2', hsn: '4820' }]);
    expect(updates).toEqual([{ col: 'products', id: 'p2', patch: { hsn: '4820' } }]);
  });

  it('never overwrites an HSN the item already has', async () => {
    await run([{ itemId: 'p1', hsn: '9999' }]);
    expect(updates).toEqual([]);
  });

  it('ignores free-text lines and blank codes', async () => {
    await run([{ hsn: '4820' }, { itemId: 'p2', hsn: '   ' }, { itemId: 'nope', hsn: '1234' }]);
    expect(updates).toEqual([]);
  });

  it('writes an item once even if it is on two lines', async () => {
    await run([{ itemId: 'p2', hsn: '4820' }, { itemId: 'p2', hsn: '4820' }]);
    expect(updates).toHaveLength(1);
  });

  it('a failure on one item does not stop the rest', async () => {
    const saved = await backfillItemHsn(
      [{ itemId: 'p2', hsn: '4820' }, { itemId: 'p3', hsn: '9983' }],
      catalog,
      async (_c, id) => { if (id === 'p2') throw new Error('offline'); },
    );
    expect(saved).toEqual(['p3']);
  });
});

describe('the invoice line', () => {
  it('fetches the HSN when an item is picked', async () => {
    await openForm();
    fireEvent.change(nameBox(), { target: { value: 'Visit' } });
    fireEvent.click(await screen.findByText('Visiting Cards'));
    await waitFor(() => expect(hsnBox().value).toBe('4909'));
    expect(priceBox().value).toBe('6');
  });

  it('typing the item name in full links it too, so its HSN arrives', async () => {
    await openForm();
    fireEvent.change(nameBox(), { target: { value: 'Design Charges' } });
    await waitFor(() => expect(hsnBox().value).toBe('9983'));
  });

  it('keeps an HSN typed before the item was chosen', async () => {
    await openForm();
    fireEvent.change(hsnBox(), { target: { value: '4820' } });
    fireEvent.change(nameBox(), { target: { value: 'Letter' } });
    fireEvent.click(await screen.findByText('Letterheads'));
    // The item has no HSN of its own; choosing it must not blank the line.
    await waitFor(() => expect(screen.getAllByPlaceholderText('Item')[0].value).toBe('Letterheads'));
    expect(hsnBox().value).toBe('4820');
  });

  it('offers to add a name that is not in the list, starting from the typed HSN', async () => {
    await openForm();
    fireEvent.change(nameBox(), { target: { value: 'Vinyl Banner' } });
    fireEvent.change(hsnBox(), { target: { value: '3920' } });
    fireEvent.click(await screen.findByText(/Add .*Vinyl Banner.* to your items/i));
    const dialog = await screen.findByText('Add a new item');
    const card = dialog.closest('.card');
    const hsnField = within(card).getByText('HSN / SAC').parentElement.querySelector('input');
    expect(hsnField.value).toBe('3920');
    fireEvent.click(within(card).getByRole('button', { name: 'Add item' }));
    await waitFor(() => expect(creates).toHaveLength(1));
    expect(creates[0].data.hsn, 'the new item keeps the code typed on the bill').toBe('3920');
  });

  it('saves an HSN typed on the bill onto an item that has none', async () => {
    await openForm();
    fireEvent.change(screen.getByPlaceholderText('Or type a new party name'), { target: { value: 'Sharma' } });
    fireEvent.change(nameBox(), { target: { value: 'Letter' } });
    fireEvent.click(await screen.findByText('Letterheads'));
    fireEvent.change(hsnBox(), { target: { value: '4820' } });
    fireEvent.change(priceBox(), { target: { value: '9' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(updates).toHaveLength(1));
    expect(updates[0]).toEqual({ col: 'products', id: 'p2', patch: { hsn: '4820' } });
  });

  it('does not touch an item whose HSN is already recorded', async () => {
    await openForm();
    fireEvent.change(screen.getByPlaceholderText('Or type a new party name'), { target: { value: 'Sharma' } });
    fireEvent.change(nameBox(), { target: { value: 'Visit' } });
    fireEvent.click(await screen.findByText('Visiting Cards'));
    fireEvent.change(priceBox(), { target: { value: '6' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByText('Add a new item')).toBeNull());
    expect(updates).toEqual([]);
  });
});
