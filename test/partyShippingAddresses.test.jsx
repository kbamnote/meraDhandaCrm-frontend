/**
 * Several shipping addresses per party.
 *
 * A customer with a head office and three sites used to have one shipping
 * address, so the other sites were retyped on every bill — or worse, not.
 * What is pinned:
 *   * rows can be added and removed, exactly one is the default, and removing
 *     the default promotes another (no list without a default, or a new invoice
 *     has nothing to prefill)
 *   * the payload keeps `shippingAddress` pointing at the DEFAULT one — that
 *     single field is what the invoice, the printed document and the reports
 *     read, and the list is additional, not a replacement
 *   * a party saved before this existed opens with its one address in the list
 *   * on an invoice, the customer's saved addresses are offered instead of
 *     being retyped
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

const CLIENT_WITH_SITES = {
  id: 'c1', name: 'Sharma Traders', phone: '9000000000', address: 'Head office, Nagpur', gstNo: '',
  shippingAddress: 'MIDC Hingna',
  shippingAddresses: [
    { id: 'a1', label: 'Warehouse', address: 'Kamptee Road, Nagpur', contactName: 'Raju', isDefault: false },
    { id: 'a2', label: 'Site 2', address: 'MIDC Hingna', contactName: '', isDefault: true },
  ],
};

vi.mock('../src/services/api.js', async () => {
  const actual = await vi.importActual('../src/services/api.js');
  return {
    ...actual,
    accountingApi: {
      ...actual.accountingApi,
      createParty: vi.fn(async (b) => { saved.push(b); return { id: 'new', ...b }; }),
      updateParty: vi.fn(async (id, type, b) => { saved.push(b); return { id, ...b }; }),
      partyGroups: vi.fn(async () => []),
      invoiceDefaults: vi.fn(async () => ({
        invoicePrefix: 'MPW', invoiceNumber: '001', terms: '', states: [],
        companyState: 'Maharashtra', invoiceRounding: 'nearest',
      })),
      partyAdvance: vi.fn(async () => ({ available: 0 })),
      createInvoice: vi.fn(async (b) => ({ invoiceNo: 'MPW-001', ...b })),
    },
    ordersApi: { ...actual.ordersApi, searchClients: vi.fn(async () => [CLIENT_WITH_SITES]) },
  };
});

const { PartyFormModal } = await import('../src/pages/accounting/PartiesPage.jsx');
const { default: CreateInvoiceFlow } = await import('../src/components/common/CreateInvoiceFlow.jsx');

const openForm = (editing) => renderScreen(PartyFormModal, {
  props: { type: 'client', t: (k) => k, onClose: () => {}, onCreated: () => {}, party: editing },
});
const rows = () => screen.queryAllByTestId('ship-addr');
const addrBox = (i) => within(rows()[i]).getByPlaceholderText('Street, city, PIN');
const labelBox = (i) => within(rows()[i]).getByPlaceholderText(/addrLabelHint/i);
const save = () => fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

beforeEach(() => { saved.length = 0; });

describe('the party form', () => {
  it('opens one row the moment shipping stops matching billing', async () => {
    openForm();
    expect(rows()).toHaveLength(0);
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(within(rows()[0]).getByRole('radio').checked, 'the only address is the default').toBe(true);
  });

  it('adds and removes addresses, always keeping one default', async () => {
    openForm();
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    await waitFor(() => expect(rows()).toHaveLength(1));
    fireEvent.change(addrBox(0), { target: { value: 'Kamptee Road' } });
    fireEvent.click(screen.getByText(/addAddress/i));
    await waitFor(() => expect(rows()).toHaveLength(2));
    fireEvent.change(addrBox(1), { target: { value: 'MIDC Hingna' } });

    // Making the second one default must unmake the first.
    fireEvent.click(within(rows()[1]).getByRole('radio'));
    expect(within(rows()[0]).getByRole('radio').checked).toBe(false);
    expect(within(rows()[1]).getByRole('radio').checked).toBe(true);

    // Removing the default promotes the one left.
    fireEvent.click(within(rows()[1]).getByTitle(/Remove/i));
    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(within(rows()[0]).getByRole('radio').checked).toBe(true);
  });

  it('saves the list and points shippingAddress at the default', async () => {
    openForm();
    fireEvent.change(screen.getByPlaceholderText(/e.g. Sharma Traders/i), { target: { value: 'Sharma Traders' } });
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    await waitFor(() => expect(rows()).toHaveLength(1));
    fireEvent.change(labelBox(0), { target: { value: 'Warehouse' } });
    fireEvent.change(addrBox(0), { target: { value: 'Kamptee Road' } });
    fireEvent.click(screen.getByText(/addAddress/i));
    await waitFor(() => expect(rows()).toHaveLength(2));
    fireEvent.change(addrBox(1), { target: { value: 'MIDC Hingna' } });
    fireEvent.click(within(rows()[1]).getByRole('radio'));
    save();
    await waitFor(() => expect(saved).toHaveLength(1));
    const body = saved[0];
    expect(body.shippingAddresses.map((a) => a.address)).toEqual(['Kamptee Road', 'MIDC Hingna']);
    expect(body.shippingAddresses[0].label).toBe('Warehouse');
    expect(body.shippingAddress, 'the default, for everything that reads one address').toBe('MIDC Hingna');
  });

  it('a row with no address typed in is not saved as an address', async () => {
    openForm();
    fireEvent.change(screen.getByPlaceholderText(/e.g. Sharma Traders/i), { target: { value: 'X' } });
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    await waitFor(() => expect(rows()).toHaveLength(1));
    fireEvent.change(addrBox(0), { target: { value: 'Real address' } });
    fireEvent.click(screen.getByText(/addAddress/i));
    await waitFor(() => expect(rows()).toHaveLength(2));
    save();
    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0].shippingAddresses).toHaveLength(1);
  });

  it('keeps an alternate number alongside the main one', async () => {
    openForm();
    fireEvent.change(screen.getByPlaceholderText(/e.g. Sharma Traders/i), { target: { value: 'Sharma Traders' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. 98765 43210'), { target: { value: '9000000000' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. 98765 43211'), { target: { value: ' 9000000001 ' } });
    save();
    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0].phone).toBe('9000000000');
    expect(saved[0].altPhone, 'trimmed, and kept apart from the main number').toBe('9000000001');
  });

  it('opens an existing party with its alternate number', async () => {
    openForm({ id: 'p1', name: 'Old Co', type: 'client', phone: '9111111111', altPhone: '9222222222' });
    expect(screen.getByPlaceholderText('e.g. 98765 43211').value).toBe('9222222222');
  });

  it('an older party with one shipping address opens with it in the list', async () => {
    openForm({
      id: 'old', name: 'Old Co', type: 'client',
      address: 'Head office', billingAddress: 'Head office', shippingAddress: 'Godown lane',
    });
    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(addrBox(0).value).toBe('Godown lane');
    expect(within(rows()[0]).getByRole('radio').checked).toBe(true);
  });

  it('ticking "same as billing" saves no separate addresses', async () => {
    openForm({
      id: 'old', name: 'Old Co', type: 'client', billingAddress: 'Head office', shippingAddress: 'Godown lane',
    });
    await waitFor(() => expect(rows()).toHaveLength(1));
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    save();
    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0].shippingAddresses).toEqual([]);
    expect(saved[0].shippingAddress).toBe('Head office');
  });
});

describe('raising an invoice for that customer', () => {
  it('fills in the default address and offers the others', async () => {
    renderScreen(CreateInvoiceFlow, { props: { onClose: () => {}, onCreated: () => {} } });
    fireEvent.click(screen.getByText(/GST Tax Invoice/i));
    await waitFor(() => expect(screen.getAllByPlaceholderText('Item').length).toBeGreaterThan(0));
    fireEvent.change(screen.getByPlaceholderText('Search party by name or number'), { target: { value: 'Sharma' } });
    fireEvent.click(await screen.findByText('Sharma Traders'));

    const pick = await screen.findByTestId('ship-addr-pick');
    const shipAddress = () => screen.getByTestId('ship-to-address');
    expect(shipAddress().value, 'the default site, not the billing address').toBe('MIDC Hingna');
    expect(within(pick).getAllByRole('option').map((o) => o.textContent.split(' — ')[0]))
      .toEqual(['Warehouse', 'Site 2 (default)']);

    fireEvent.change(pick, { target: { value: '0' } });
    await waitFor(() => expect(shipAddress().value).toBe('Kamptee Road, Nagpur'));
    expect(screen.getByTestId('ship-to-name').value, 'the site contact comes with it').toBe('Raju');
  });
});
