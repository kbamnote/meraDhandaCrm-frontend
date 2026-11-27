/**
 * The bill and the job card carry the shop's own job sheet, column for
 * column.
 *
 * The sheet is the thing the counter actually works from, and a column that
 * is missing — or sitting in a different place — is a figure somebody has to
 * hold in their head while copying between paper and screen. Pinned in the
 * sheet's order so neither screen can quietly drift from it or from the other.
 *
 * The sheet's second size column is labelled "Weight", but its arithmetic on
 * every row is Length × Width × Qty — so it is a WIDTH, and that is what the
 * column is called here. There is no weight column: nothing priced from one,
 * so it was a column of blanks on every bill.
 */
import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderScreen } from './renderScreen.jsx';

vi.mock('../src/services/realtime.js', () => ({
  db: {}, socket: { on() {}, off() {}, emit() {} },
  ref: (_d, path) => ({ path }), onValue: (_r, cb) => { cb({ val: () => ({}) }); return () => {}; },
  authSocket: () => {},
}));

const { default: CreateInvoiceFlow, jobItemToLine } = await import('../src/components/common/CreateInvoiceFlow.jsx');
const { default: NewJobModal } = await import('../src/components/common/NewJobModal.jsx');

// Sr No · Job Category · Particular · Length · Width · Weight · Qty · Area ·
// Unit · Rate · Amount · HSN Code — everything up to the tax columns, which
// the two screens differ on only by the bill's Discount.
const SHEET_HEAD = [
  'Sr No.', 'Job Category', 'Particular', 'Length', 'Width',
  'Qty', 'Area', 'Unit', 'Rate', 'Amount', 'HSN Code',
];

const table = () => document.querySelector('table.line-table');
const heads = () => [...table().querySelectorAll('thead th')].map((th) => th.textContent.trim());
const span = (tr) => [...tr.children].reduce((a, td) => a + (Number(td.getAttribute('colspan')) || 1), 0);

describe('the bill', () => {
  const open = async () => {
    renderScreen(CreateInvoiceFlow, { props: { onClose: () => {}, onCreated: () => {} } });
    fireEvent.click(screen.getByText(/GST Tax Invoice/i));
    await waitFor(() => expect(screen.getAllByPlaceholderText('Item').length).toBeGreaterThan(0));
  };

  it('carries the sheet, column for column', async () => {
    await open();
    // Discount is ours, not the sheet's, and sits before Tax because it is
    // taken before it.
    expect(heads()).toEqual([...SHEET_HEAD, 'Discount ₹/%', 'Tax', 'Tax Amt', 'G Total', '']);
  });

  it('every part of the table agrees how many columns there are', async () => {
    await open();
    const cols = table().querySelectorAll('colgroup col').length;
    expect(heads().length, 'header vs colgroup').toBe(cols);
    const rows = [...table().querySelectorAll('tbody tr')];
    for (const tr of rows) expect(span(tr), 'a body row').toBe(cols);
    expect(span(table().querySelector('tfoot tr')), 'the footer').toBe(cols);
  });
});

describe('the job card', () => {
  const open = async () => {
    renderScreen(NewJobModal, { props: { onClose: () => {}, onCreated: () => {} } });
    await waitFor(() => expect(screen.getByTestId('job-add-line')).toBeTruthy());
    fireEvent.click(screen.getByTestId('job-add-line'));
    await waitFor(() => expect(screen.getAllByTestId('job-line')).toHaveLength(1));
  };

  it('carries the same sheet, minus the discount the sheet has not got', async () => {
    await open();
    expect(heads()).toEqual([...SHEET_HEAD, 'Tax', 'Tax Amt', 'G Total', '']);
  });

  it('every part of the table agrees how many columns there are', async () => {
    await open();
    const cols = table().querySelectorAll('colgroup col').length;
    expect(heads().length, 'header vs colgroup').toBe(cols);
    expect(span(table().querySelector('tbody tr')), 'the row').toBe(cols);
    expect(span(table().querySelector('tfoot tr')), 'the footer').toBe(cols);
  });

  it('works out the tax and the gross on the line, as the sheet does', async () => {
    await open();
    // Row 2 of the sheet: 4 × 8 × 2 = 64 sqft at ₹7 = ₹448, 18% = ₹80.64,
    // gross ₹528.64.
    fireEvent.change(screen.getByTestId('job-line-length'), { target: { value: '4' } });
    fireEvent.change(screen.getByTestId('job-line-width'), { target: { value: '8' } });
    fireEvent.change(screen.getByTestId('job-line-qty'), { target: { value: '2' } });
    fireEvent.change(screen.getByTestId('job-line-rate'), { target: { value: '7' } });
    fireEvent.change(screen.getByTestId('job-line-rate-on'), { target: { value: 'area' } });
    fireEvent.change(screen.getByTestId('job-line-tax'), { target: { value: '18' } });
    await waitFor(() => expect(screen.getByTestId('job-line-area').textContent).toContain('64'));
    expect(screen.getByTestId('job-line-amount').textContent).toContain('448');
    expect(screen.getByTestId('job-line-tax-amt').textContent).toContain('80.64');
    expect(screen.getByTestId('job-line-gtotal').textContent).toContain('528.64');
  });

  it('leaves tax blank until somebody sets it — a card is what was agreed', async () => {
    await open();
    expect(screen.getByTestId('job-line-tax').value).toBe('');
    expect(screen.getByTestId('job-line-tax-amt').textContent).toBe('—');
  });
});

describe('the rate agreed on the card is the rate billed', () => {
  it('travels to the invoice line', () => {
    expect(jobItemToLine({ name: 'Flex', qty: 1, rate: 7, taxRate: 18 }).taxRate).toBe('18');
  });

  it('no rate agreed means the line follows the invoice rate, as before', () => {
    expect(jobItemToLine({ name: 'Flex', qty: 1, rate: 7 }).taxRate).toBe('');
    expect(jobItemToLine({ name: 'Flex', qty: 1, rate: 7, taxRate: null }).taxRate).toBe('');
  });

  it('0% is a rate somebody chose, not an absence of one', () => {
    expect(jobItemToLine({ name: 'Exempt', qty: 1, rate: 7, taxRate: 0 }).taxRate).toBe('0');
  });
});
