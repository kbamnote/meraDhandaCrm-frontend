/**
 * Accounting → Items carries the bulk importer.
 *
 * The importer existed but was mounted only on the older Products page, so the
 * screen people actually use to manage items had no way to load a list — the
 * alternative being to type several hundred items in by hand. These check the
 * route people land on, not just that the component exists somewhere.
 */
import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderScreen } from './renderScreen.jsx';

vi.mock('../src/services/realtime.js', () => ({
  db: { __backend: 'test' }, socket: { on() {}, off() {}, emit() {} },
  ref: (_db, path) => ({ path }), onValue: (_r, cb) => { cb({ val: () => ({}) }); return () => {}; },
  authSocket: () => {},
}));

const { default: AccountingItemsPage } = await import('../src/pages/accounting/ItemsPage.jsx');

describe('the Items page', () => {
  it('offers the bulk import, folded away until asked for', async () => {
    renderScreen(AccountingItemsPage);
    expect(screen.queryByText(/Bulk Stock Upload/i), 'not in the way by default').toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Bulk Import Items/i }));
    expect(await screen.findByText(/Bulk Stock Upload/i)).toBeTruthy();
    // The file picker is the thing that has to be reachable.
    const input = document.querySelector('input[type="file"]');
    expect(input).toBeTruthy();
    expect(input.getAttribute('accept')).toContain('.xlsx');
  });

  it('closes again', async () => {
    renderScreen(AccountingItemsPage);
    fireEvent.click(screen.getByRole('button', { name: /Bulk Import Items/i }));
    await screen.findByText(/Bulk Stock Upload/i);
    fireEvent.click(screen.getByRole('button', { name: /Close import/i }));
    await waitFor(() => expect(screen.queryByText(/Bulk Stock Upload/i)).toBeNull());
  });

  it('still renders the items table itself', () => {
    renderScreen(AccountingItemsPage);
    expect(screen.getAllByText(/Items/i).length).toBeGreaterThan(0);
  });
});

describe('the route', () => {
  it('/accounting/items renders the page that has the importer', async () => {
    // Pins the wiring: the path used to fall through to the generic resource
    // table, which has no importer on it.
    const App = await import('../src/App.jsx');
    const src = await import('node:fs').then((fs) => fs.readFileSync('src/App.jsx', 'utf8'));
    expect(src).toMatch(/'accounting\/items':\s*AccountingItemsPage/);
    expect(App).toBeTruthy();
  });
});
