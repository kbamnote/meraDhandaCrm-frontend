/**
 * Sales invoices: Cancel keeps the bill at ₹0, Delete removes it.
 *
 *   * a cancelled bill shows ₹0 with the original amount struck through — the
 *     whole point of cancelling instead of deleting
 *   * Cancel and Delete are offered only where the server accepts them (not
 *     once money has been received)
 *   * Delete goes through the accounting endpoint that unwinds the ledger, never
 *     a raw document delete
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, within, waitFor } from '@testing-library/react';
import { renderScreen } from './renderScreen.jsx';

const calls = { void: [], del: [] };

vi.mock('../src/services/realtime.js', () => ({
  db: {}, socket: { on() {}, off() {}, emit() {} },
  ref: (_db, path) => ({ path }), onValue: (_r, cb) => { cb({ val: () => ({}) }); return () => {}; },
  authSocket: () => {},
}));
vi.mock('../src/services/api.js', async () => {
  const actual = await vi.importActual('../src/services/api.js');
  return {
    ...actual,
    accountingApi: {
      ...actual.accountingApi,
      voidInvoice: vi.fn(async (id) => { calls.void.push(id); return { status: 'void' }; }),
      deleteInvoice: vi.fn(async (id) => { calls.del.push(id); return { deleted: true }; }),
    },
  };
});

const { InvoiceRow } = await import('../src/pages/accounting/SalesInvoicesPage.jsx');
const t = (k) => ({ voidInv: 'Cancel', del: 'Delete', void: 'Cancelled', edit: 'Edit', view: 'View' }[k] || k);

const LIVE = { id: 'i1', invoiceNo: 'INV-1', clientName: 'Sharma', status: 'unpaid', total: 1180, subtotal: 1000, taxTotal: 180, paidAmount: 0 };
const CANCELLED = { ...LIVE, id: 'i2', invoiceNo: 'INV-2', status: 'void', voided: true, voidedAt: '2026-09-20' };
const PART_PAID = { ...LIVE, id: 'i3', invoiceNo: 'INV-3', status: 'partial', paidAmount: 500 };

beforeEach(() => { calls.void.length = 0; calls.del.length = 0; vi.spyOn(window, 'confirm').mockReturnValue(true); });

describe('sales invoice row', () => {
  it('a cancelled bill is listed at ₹0, with what it was for', () => {
    renderScreen(InvoiceRow, { props: { inv: CANCELLED, t } });
    expect(screen.getByTestId('invoice-amount').textContent).toBe('₹0');
    expect(screen.getByText('₹1,180').tagName).toBe('S');
    expect(screen.queryByText('Cancel'), 'already cancelled').toBeNull();
    expect(screen.queryByText('Edit')).toBeNull();
    expect(screen.queryByText('Delete'), 'a cancelled bill can still be deleted').toBeTruthy();
  });

  it('a live bill shows its full amount and both actions', () => {
    renderScreen(InvoiceRow, { props: { inv: LIVE, t } });
    expect(screen.getByTestId('invoice-amount').textContent).toBe('₹1,180');
    expect(screen.queryByText('Cancel')).toBeTruthy();
    expect(screen.queryByText('Delete')).toBeTruthy();
  });

  it('neither is offered once money has been received', () => {
    renderScreen(InvoiceRow, { props: { inv: PART_PAID, t } });
    expect(screen.queryByText('Cancel')).toBeNull();
    expect(screen.queryByText('Delete')).toBeNull();
  });

  it('Cancel and Delete call the accounting endpoints', async () => {
    renderScreen(InvoiceRow, { props: { inv: LIVE, t } });
    fireEvent.click(screen.getByText('Cancel'));
    await waitFor(() => expect(calls.void).toEqual(['i1']));
    fireEvent.click(screen.getByText('Delete'));
    await waitFor(() => expect(calls.del).toEqual(['i1']));
  });

  it('nothing happens if the confirmation is declined', async () => {
    window.confirm.mockReturnValue(false);
    renderScreen(InvoiceRow, { props: { inv: LIVE, t } });
    fireEvent.click(screen.getByText('Delete'));
    fireEvent.click(screen.getByText('Cancel'));
    await new Promise((r) => setTimeout(r, 20));
    expect(calls.del).toEqual([]);
    expect(calls.void).toEqual([]);
  });
});

describe('printed invoice', () => {
  it('a cancelled invoice prints with a CANCELLED mark; a live one does not', async () => {
    const { default: InvoiceDocument } = await import('../src/components/common/InvoiceDocument.jsx');
    const { unmount } = renderScreen(InvoiceDocument, { props: { invoice: { ...CANCELLED, items: [] } } });
    expect(screen.queryAllByTestId('inv-cancelled').length).toBeGreaterThan(0);
    unmount();
    renderScreen(InvoiceDocument, { props: { invoice: { ...LIVE, items: [] } } });
    expect(screen.queryAllByTestId('inv-cancelled')).toHaveLength(0);
  });
});
