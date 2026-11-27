/**
 * The job card opens in the same shell as the bill.
 *
 * It did not: the card was a 460px column while the invoice form is 1300,
 * so on a desktop the card opened as a narrow strip and its line table had
 * to scroll sideways to show a single row. The two are opened for the same
 * work minutes apart, and a different size reads as a different kind of
 * screen.
 *
 * Both widths are read off what actually renders rather than from a shared
 * constant, so this still fails if either one is changed on its own.
 */
import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderScreen } from './renderScreen.jsx';

vi.mock('../src/services/realtime.js', () => ({
  db: {}, socket: { on() {}, off() {}, emit() {} },
  ref: (_d, path) => ({ path }), onValue: (_r, cb) => { cb({ val: () => ({}) }); return () => {}; },
  authSocket: () => {},
}));

const { default: CreateInvoiceFlow } = await import('../src/components/common/CreateInvoiceFlow.jsx');
const { default: NewJobModal } = await import('../src/components/common/NewJobModal.jsx');

/**
 * The dialog's own card — the scrolling panel inside the backdrop. Found by
 * the one thing every modal shell here has in common, rather than by a class
 * that a restyle would quietly rename.
 */
const shellWidth = () => {
  // The bill's shell is a div and the card's is a form — the tag is not
  // the thing they have in common, the scrolling-panel style is.
  const shells = [...document.querySelectorAll('div, form')]
    .filter((d) => d.style.maxWidth && String(d.style.maxHeight).includes('100vh'));
  // The widest is the dialog itself; anything nested is narrower.
  return Math.max(...shells.map((d) => parseInt(d.style.maxWidth, 10)).filter(Number.isFinite));
};

describe('the job card and the bill open at the same size', () => {
  it('the bill form is the wide one it has always been', async () => {
    renderScreen(CreateInvoiceFlow, { props: { onClose: () => {}, onCreated: () => {} } });
    fireEvent.click(screen.getByText(/GST Tax Invoice/i));
    await waitFor(() => expect(screen.getAllByPlaceholderText('Item').length).toBeGreaterThan(0));
    expect(shellWidth()).toBe(1300);
  });

  it('and the job card now matches it', async () => {
    renderScreen(NewJobModal, { props: { onClose: () => {}, onCreated: () => {} } });
    await waitFor(() => expect(screen.getByTestId('job-amount')).toBeTruthy());
    expect(shellWidth()).toBe(1300);
  });
});

describe('the card writes lines the way the bill does', () => {
  const openCard = async () => {
    renderScreen(NewJobModal, { props: { onClose: () => {}, onCreated: () => {} } });
    await waitFor(() => expect(screen.getByTestId('job-add-line')).toBeTruthy());
  };

  it('a line can be typed straight in, as on the bill', async () => {
    await openCard();
    // The search above is the way to a CATALOG item; work nobody stocks is
    // still work, and the bill has always allowed it.
    expect(screen.queryByTestId('job-lines')).toBeNull();
    fireEvent.click(screen.getByTestId('job-add-line'));
    await waitFor(() => expect(screen.getAllByTestId('job-line')).toHaveLength(1));
    expect(screen.getByTestId('job-line-name').value).toBe('');
  });

  it('carries the bill’s own columns, HSN among them', async () => {
    await openCard();
    fireEvent.click(screen.getByTestId('job-add-line'));
    await waitFor(() => expect(screen.getByTestId('job-line-hsn')).toBeTruthy());
    for (const id of ['job-line-category', 'job-line-name', 'job-line-hsn',
      'job-line-length', 'job-line-qty', 'job-line-rate', 'job-line-rate-on',
      'job-line-amount']) {
      expect(screen.getByTestId(id), `${id} is missing from the row`).toBeTruthy();
    }
  });

  it('numbers the rows, as the bill does', async () => {
    await openCard();
    fireEvent.click(screen.getByTestId('job-add-line'));
    fireEvent.click(screen.getByTestId('job-add-line'));
    await waitFor(() => expect(screen.getAllByTestId('job-line')).toHaveLength(2));
    const first = screen.getAllByTestId('job-line')[0];
    expect(first.firstChild.textContent).toBe('1');
  });

  it('the grid defines exactly as many tracks as a row has cells', async () => {
    // The real alignment invariant. A row with more cells than the grid has
    // tracks wraps onto a second line and the table reads as nonsense.
    await openCard();
    fireEvent.click(screen.getByTestId('job-add-line'));
    await waitFor(() => expect(screen.getAllByTestId('job-line')).toHaveLength(1));
    const row = screen.getAllByTestId('job-line')[0];
    const tracks = row.style.gridTemplateColumns.trim().split(/\s+/).length;
    expect(tracks, 'grid tracks vs cells').toBe(row.children.length);
  });

  it('every row holds as many cells as the header', async () => {
    await openCard();
    fireEvent.click(screen.getByTestId('job-add-line'));
    await waitFor(() => expect(screen.getAllByTestId('job-line')).toHaveLength(1));
    const table = screen.getByTestId('job-lines').firstChild;
    const header = table.firstChild;
    expect(screen.getAllByTestId('job-line')[0].children.length).toBe(header.children.length);
  });
});
