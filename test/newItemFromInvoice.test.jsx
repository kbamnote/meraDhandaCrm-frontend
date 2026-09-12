/**
 * Adding an item to the catalog from an invoice line.
 *
 * The bug this closes: typing a name that isn't in the items list produced a
 * line with no `itemId`, and only `itemId` lines move stock. So you could sell
 * 200 of something and the stock report would still show everything you started
 * with — quietly, with nothing on screen saying so.
 *
 * What's asserted here is the decision logic, not the styling: WHEN the offer to
 * create appears, when it must not, and that a created item ends up linked to
 * the line so the existing deduction picks it up.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent, within } from '@testing-library/react';
import { renderScreen } from './renderScreen.jsx';

const CATALOG = {
  p1: { name: 'Visiting Cards', hsn: '4909', price: 6, unit: 'pcs', stock: 500, trackStock: 'yes', type: 'product' },
  p2: { name: 'Letterheads', hsn: '4820', price: 9, unit: 'pcs', stock: 200, trackStock: 'yes', type: 'product' },
};

// The products feed the picker reads.
vi.mock('../src/services/realtime.js', () => ({
  db: { __backend: 'test' },
  socket: { on() {}, off() {}, emit() {} },
  ref: (_db, path) => ({ path }),
  onValue: (refObj, cb) => {
    if (refObj.path === 'mpw/products') cb({ val: () => CATALOG });
    else cb({ val: () => ({}) });
    return () => {};
  },
  authSocket: () => {},
}));

const created = [];
vi.mock('../src/services/api.js', async () => {
  const actual = await vi.importActual('../src/services/api.js');
  return {
    ...actual,
    dbApi: {
      ...actual.dbApi,
      create: vi.fn(async (col, data) => {
        const rec = { id: `new-${created.length + 1}`, ...data };
        created.push({ col, data: rec });
        return rec;
      }),
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

const itemNameBox = () => screen.getAllByPlaceholderText('Item')[0];
const typeItem = (text) => fireEvent.change(itemNameBox(), { target: { value: text } });
const addOffer = () => screen.queryByText(/Add “.*” to your items|Add ".*" to your items/i);

async function openForm() {
  const { default: CreateInvoiceFlow } = await import('../src/components/common/CreateInvoiceFlow.jsx');
  renderScreen(CreateInvoiceFlow, { props: { onClose: () => {}, onCreated: () => {} } });
  // Skip the type picker.
  fireEvent.click(screen.getByText(/GST Tax Invoice/i));
  await waitFor(() => expect(screen.getAllByPlaceholderText('Item').length).toBeGreaterThan(0));
}

describe('adding a new item from an invoice line', () => {
  beforeEach(() => { created.length = 0; });

  it('offers to add a name that is not in the items list', async () => {
    await openForm();
    typeItem('Vinyl Banner');
    await waitFor(() => expect(addOffer()).toBeTruthy());
  });

  it('warns that an unlisted line will not move stock', async () => {
    await openForm();
    typeItem('Vinyl Banner');
    await waitFor(() => expect(screen.getByText(/stock won'?t be counted for this line/i)).toBeTruthy());
  });

  it('does NOT offer when the name already exists in the catalog', async () => {
    await openForm();
    typeItem('Visiting Cards');
    // An exact match closes the dropdown altogether (existing behaviour), so the
    // assertion is simply that nothing invites creating a duplicate.
    await waitFor(() => expect(addOffer()).toBeNull());
  });

  it('matches case-insensitively, so a duplicate cannot sneak in on casing', async () => {
    await openForm();
    typeItem('visiting CARDS');
    await waitFor(() => expect(addOffer()).toBeNull());
  });

  it('still offers on a PARTIAL match, alongside the existing item', async () => {
    // "Visiting" is not "Visiting Cards" — it may genuinely be a new item, so
    // both the existing match and the create offer belong here.
    await openForm();
    typeItem('Visiting');
    await waitFor(() => expect(screen.getByText('Visiting Cards')).toBeTruthy());
    expect(addOffer()).toBeTruthy();
  });

  it('does not offer for one or two stray characters', async () => {
    await openForm();
    typeItem('V');
    expect(addOffer()).toBeNull();
  });

  it('creates the product with the stock figure and links it to the line', async () => {
    await openForm();
    typeItem('Vinyl Banner');
    await waitFor(() => expect(addOffer()).toBeTruthy());
    fireEvent.click(addOffer());

    const dialog = await screen.findByText(/Add a new item/i);
    expect(dialog).toBeTruthy();

    const stockBox = screen.getByPlaceholderText('0');
    fireEvent.change(stockBox, { target: { value: '50' } });
    fireEvent.click(screen.getByRole('button', { name: /^Add item$/i }));

    await waitFor(() => expect(created.length).toBe(1));
    const { col, data } = created[0];
    expect(col).toBe('products');
    expect(data.name).toBe('Vinyl Banner');
    // openingStock is the starting figure; stock is the live one. They must
    // start equal, or the very first movement is measured from the wrong base.
    expect(data.openingStock).toBe(50);
    expect(data.stock).toBe(50);
    expect(data.trackStock).toBe('yes');

    // And the offer is gone, because the line is now a catalog line.
    await waitFor(() => expect(addOffer()).toBeNull());
    await waitFor(() => expect(screen.queryByText(/stock won'?t be counted/i)).toBeNull());
  });

  it('a service is created without stock tracking', async () => {
    await openForm();
    typeItem('Design Charges');
    await waitFor(() => expect(addOffer()).toBeTruthy());
    fireEvent.click(addOffer());
    await screen.findByText(/Add a new item/i);

    const typeSelect = screen.getByDisplayValue(/Product \(track stock\)/i);
    fireEvent.change(typeSelect, { target: { value: 'service' } });
    fireEvent.click(screen.getByRole('button', { name: /^Add item$/i }));

    await waitFor(() => expect(created.length).toBe(1));
    const { data } = created[0];
    expect(data.type).toBe('service');
    expect(data.trackStock).toBe('no');
    // A service has no quantity, so it must not carry a stock figure at all.
    expect(data.stock).toBeNull();
    expect(data.openingStock).toBeNull();
  });

  it('shows what the bill will leave behind, and flags a shortfall', async () => {
    await openForm();
    // Bill 10 of something we are about to say we only have 4 of.
    const qtyBox = screen.getAllByPlaceholderText('Qty')[0];
    fireEvent.change(qtyBox, { target: { value: '10' } });
    typeItem('Vinyl Banner');
    await waitFor(() => expect(addOffer()).toBeTruthy());
    fireEvent.click(addOffer());
    await screen.findByText(/Add a new item/i);

    fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: '40' } });
    await waitFor(() => expect(screen.getByText(/30/)).toBeTruthy());   // 40 - 10

    fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: '4' } });
    await waitFor(() => expect(screen.getByText(/less than you are billing/i)).toBeTruthy());
  });
});
