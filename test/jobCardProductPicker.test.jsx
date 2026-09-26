/**
 * Picking — or adding — a product while writing a job card.
 *
 * Two complaints, both about the same box:
 *   * the list only narrowed if you typed BEFORE opening it. Opening it first
 *     showed every product in whatever order they came back in, so finding one
 *     meant closing it, typing, and opening it again.
 *   * a product nobody had entered yet could not be added from here at all.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent, within } from '@testing-library/react';
import { renderScreen, OWNER } from './renderScreen.jsx';

const created = [];
let PRODUCTS = [
  { id: 'p1', name: 'Visiting Cards' },
  { id: 'p2', name: 'Wedding Card — Gold' },
  { id: 'p3', name: 'Flex Banner' },
  { id: 'p4', name: 'Letterheads' },
];

vi.mock('../src/services/realtime.js', () => ({
  db: { __backend: 'test' }, socket: { on() {}, off() {}, emit() {} },
  ref: (_db, path) => ({ path }), onValue: (_r, cb) => { cb({ val: () => ({}) }); return () => {}; },
  authSocket: () => {},
}));
vi.mock('../src/services/api.js', async () => {
  const actual = await vi.importActual('../src/services/api.js');
  return {
    ...actual,
    ordersApi: {
      ...actual.ordersApi,
      nextNumber: vi.fn(async () => ({ jobNo: 'JOB-1' })),
      lookups: vi.fn(async () => ({ products: PRODUCTS, salespeople: [] })),
      searchClients: vi.fn(async () => []),
      create: vi.fn(async (b) => ({ id: 'j1', jobNo: 'JOB-1', ...b })),
      createProduct: vi.fn(async (name) => {
        const hit = PRODUCTS.find((p) => p.name.toLowerCase() === name.trim().toLowerCase());
        if (hit) return { id: hit.id, name: hit.name, created: false };
        const made = { id: `new-${created.length + 1}`, name: name.trim() };
        created.push(made);
        return { ...made, created: true };
      }),
    },
  };
});

const { default: JobCardsPage } = await import('../src/pages/JobCardsPage.jsx');

const openForm = async () => {
  renderScreen(JobCardsPage, { auth: OWNER });
  fireEvent.click(await screen.findByRole('button', { name: /New Job|Naya Job/i }));
  return waitFor(() => expect(screen.getByTestId('product-search')).toBeTruthy());
};
const box = () => screen.getByTestId('product-search');
const options = () => screen.queryAllByTestId('product-option').map((o) => o.textContent);
const type = (v) => fireEvent.change(box(), { target: { value: v } });
const addLine = () => fireEvent.click(screen.getByRole('button', { name: '+ Add' }));

beforeEach(() => { created.length = 0; });

describe('the product box', () => {
  it('lists everything the moment it is opened — no typing first', async () => {
    await openForm();
    expect(screen.queryByTestId('product-list'), 'closed until asked for').toBeNull();
    fireEvent.focus(box());
    await waitFor(() => expect(screen.getByTestId('product-list')).toBeTruthy());
    expect(options()).toEqual(['Visiting Cards', 'Wedding Card — Gold', 'Flex Banner', 'Letterheads']);
  });

  it('narrows as you type, while it is open', async () => {
    await openForm();
    fireEvent.focus(box());
    type('card');
    await waitFor(() => expect(options()).toEqual(['Visiting Cards', 'Wedding Card — Gold']));
    type('flex');
    await waitFor(() => expect(options()).toEqual(['Flex Banner']));
  });

  it('picking one fills the box and adds the line against that product', async () => {
    await openForm();
    fireEvent.focus(box());
    type('wedding');
    fireEvent.mouseDown(await screen.findByText('Wedding Card — Gold'));
    await waitFor(() => expect(box().value).toBe('Wedding Card — Gold'));
    expect(screen.queryByTestId('product-list'), 'closes once chosen').toBeNull();
    fireEvent.change(screen.getByPlaceholderText('Qty'), { target: { value: '250' } });
    addLine();
    expect(await screen.findByText('• Wedding Card — Gold × 250')).toBeTruthy();
    // And the box is cleared, ready for the next line.
    expect(box().value).toBe('');
  });
});

describe('a product that is not on the list yet', () => {
  it('offers to add it, and does', async () => {
    await openForm();
    fireEvent.focus(box());
    type('Mug Printing');
    const add = await screen.findByTestId('product-add-new');
    expect(add.textContent).toContain('Mug Printing');
    fireEvent.mouseDown(add);
    await waitFor(() => expect(created).toHaveLength(1));
    expect(created[0].name).toBe('Mug Printing');
    // Chosen straight away, so the next click is + Add and nothing else.
    await waitFor(() => expect(box().value).toBe('Mug Printing'));
    addLine();
    expect(await screen.findByText('• Mug Printing × 1')).toBeTruthy();
  });

  it('appears in the list afterwards, without reloading the form', async () => {
    await openForm();
    fireEvent.focus(box());
    type('Mug Printing');
    fireEvent.mouseDown(await screen.findByTestId('product-add-new'));
    await waitFor(() => expect(created).toHaveLength(1));
    type('mug');
    await waitFor(() => expect(options()).toEqual(['Mug Printing']));
  });

  it('does not offer to add something already on the list', async () => {
    await openForm();
    fireEvent.focus(box());
    type('Flex Banner');
    await waitFor(() => expect(options()).toEqual(['Flex Banner']));
    expect(screen.queryByTestId('product-add-new')).toBeNull();
  });

  it('waits for a real name before offering', async () => {
    await openForm();
    fireEvent.focus(box());
    type('M');
    await waitFor(() => expect(screen.getByTestId('product-list')).toBeTruthy());
    expect(screen.queryByTestId('product-add-new'), 'one letter is not a product').toBeNull();
  });

  it('still lets a line be typed without touching the product list', async () => {
    await openForm();
    type('Some one-off work');
    addLine();
    expect(await screen.findByText('• Some one-off work × 1')).toBeTruthy();
    expect(created, 'nothing was added to the catalog').toHaveLength(0);
  });
});
