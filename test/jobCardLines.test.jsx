/**
 * A job card is written the way the bill is written.
 *
 * The card used to take the work as a sentence and products one at a time as
 * name + qty. Billing it then put ONE free-text line on the invoice, which
 * carried no catalog link — so goods that had just left the shop moved no
 * stock, and the shop was keeping stock by hand.
 *
 * Now the card holds proper lines (category, particular, length, width,
 * weight, qty, unit, rate), and the bill raised from the job inherits them
 * whole — the catalog link with them.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../src/services/realtime.js', () => ({
  db: {}, socket: { on() {}, off() {}, emit() {} },
  ref: (_d, path) => ({ path }), onValue: (_r, cb) => { cb({ val: () => ({}) }); return () => {}; },
  authSocket: () => {},
}));

const { jobItemToLine, linesFromJob } = await import('../src/components/common/CreateInvoiceFlow.jsx');
const { lineArea, lineGross } = await import('../src/utils/lineSize.js');
const NewJobModal = (await import('../src/components/common/NewJobModal.jsx')).default;

describe('a job line becomes an invoice line', () => {
  const JOB_LINE = {
    name: 'Flex banner', jobCategory: 'Flex Printing',
    length: 4, width: 8, weight: null, qty: 2, unit: 'Sqft', rate: 7,
    rateOn: 'area', productId: 'prod-7', hsn: '4911', amount: 448,
  };

  it('carries the catalog link across — which is what moves stock', () => {
    // The job calls it productId and the invoice calls it itemId; losing it
    // here is exactly how a bill ended up counting no stock.
    expect(jobItemToLine(JOB_LINE).itemId).toBe('prod-7');
  });

  it('prefers an itemId the line already has', () => {
    expect(jobItemToLine({ ...JOB_LINE, itemId: 'item-9' }).itemId).toBe('item-9');
  });

  it('carries the category and the size it was quoted at', () => {
    const l = jobItemToLine(JOB_LINE);
    expect(l.jobCategory).toBe('Flex Printing');
    expect(l.length).toBe('4');
    expect(l.width).toBe('8');
    expect(l.unit).toBe('Sqft');
    expect(l.rateOn).toBe('area');
    // 4 × 8 × 2 = 64 sqft at ₹7 — the bill prices it as the card quoted it.
    expect(lineArea(l)).toBe(64);
    expect(lineGross(l)).toBe(448);
  });

  it('hands the form strings, not numbers', () => {
    // A controlled input given a number renders read-only until first edited.
    const l = jobItemToLine(JOB_LINE);
    for (const k of ['qty', 'rate', 'length', 'width']) {
      expect(typeof l[k], `${k} must be a string`).toBe('string');
    }
  });

  it('leaves a blank size blank rather than making it zero', () => {
    const l = jobItemToLine({ name: 'Printing', qty: 3, rate: 100 });
    expect(l.length).toBe('');
    expect(l.weight).toBe('');
    expect(lineArea(l)).toBe(0);
    expect(lineGross(l)).toBe(300);
  });
});

describe('what a bill opens with when it is raised from a job', () => {
  it('one line per job line', () => {
    const lines = linesFromJob({ work: 'ignore me', items: [
      { name: 'Flex banner', qty: 2, rate: 7, productId: 'p1' },
      { name: 'Eyelets', qty: 12, rate: 5, productId: 'p2' },
    ] });
    expect(lines.map((l) => l.name)).toEqual(['Flex banner', 'Eyelets']);
    expect(lines.map((l) => l.itemId)).toEqual(['p1', 'p2']);
  });

  it('falls back to the work text for a job written before lines existed', () => {
    const lines = linesFromJob({ work: 'Flex banner 10x4 ft' });
    expect(lines).toHaveLength(1);
    expect(lines[0].name).toBe('Flex banner 10x4 ft');
    expect(lines[0].itemId).toBeNull();
  });

  it('ignores a nameless line rather than billing a blank row', () => {
    const lines = linesFromJob({ work: 'w', items: [{ name: '  ', qty: 1 }, { name: 'Real', qty: 1 }] });
    expect(lines.map((l) => l.name)).toEqual(['Real']);
  });

  it('a job with no items at all still opens one empty line', () => {
    expect(linesFromJob({ items: [] })).toHaveLength(1);
  });
});

// ── The card itself ────────────────────────────────────────────────────────

vi.mock('../src/services/api.js', async () => ({
  ordersApi: {
    create: vi.fn(() => Promise.resolve({ jobNo: 'JOB-1' })),
    update: vi.fn(),
    lookups: () => Promise.resolve({ products: [], salespeople: [], designers: [] }),
    nextNumber: () => Promise.resolve({ next: 'JOB-2' }),
    searchClients: () => Promise.resolve([]),
    createProduct: vi.fn(),
  },
  uploadApi: { upload: vi.fn() },
  productionTypesApi: { list: () => Promise.resolve([{ name: 'Flex Printing', enabled: true }]) },
  dbApi: { list: () => Promise.resolve({}) },
  accountingApi: {
    units: () => Promise.resolve({ units: [{ name: 'Sqft' }, { name: 'Pcs' }] }),
    addUnit: (name) => Promise.resolve({ name, added: true }),
  },
  describeError: (e, f) => f,
}));

const openCard = (job) => render(
  <MemoryRouter>
    <NewJobModal job={job} onClose={() => {}} onCreated={() => {}} />
  </MemoryRouter>
);

describe('the job card shows its lines the way the bill does', () => {
  const JOB = {
    id: 'j1', jobNo: 'JOB-1', clientName: 'A Customer', work: 'Flex',
    items: [{
      name: 'Flex banner', jobCategory: 'Flex Printing',
      length: 4, width: 8, qty: 2, unit: 'Sqft', rate: 7, rateOn: 'area', productId: 'p1',
    }],
  };

  it('lays the line out in columns, with what it comes to', async () => {
    openCard(JOB);
    await waitFor(() => expect(screen.getByTestId('job-lines')).toBeTruthy());
    expect(screen.getAllByTestId('job-line')).toHaveLength(1);
    expect(screen.getByTestId('job-line-category').value).toBe('Flex Printing');
    expect(screen.getByTestId('job-line-name').value).toBe('Flex banner');
    expect(screen.getByTestId('job-line-length').value).toBe('4');
    // 64 sqft at ₹7.
    expect(screen.getByTestId('job-line-amount').textContent).toContain('448');
    expect(screen.getByTestId('job-lines-total').textContent).toContain('448');
  });

  it('retotals as the line is edited', async () => {
    openCard(JOB);
    await waitFor(() => expect(screen.getByTestId('job-line-rate')).toBeTruthy());
    fireEvent.change(screen.getByTestId('job-line-rate'), { target: { value: '10' } });
    // 64 sqft at ₹10.
    expect(screen.getByTestId('job-lines-total').textContent).toContain('640');
  });

  it('offers the lines total for the order amount without imposing it', async () => {
    openCard(JOB);
    await waitFor(() => expect(screen.getByTestId('job-use-lines-total')).toBeTruthy());
    // Not written until it is asked for — what was agreed at the shop is
    // often a round figure the lines do not add up to.
    expect(screen.getByTestId('job-amount').value).toBe('');
    fireEvent.click(screen.getByTestId('job-use-lines-total'));
    expect(screen.getByTestId('job-amount').value).toBe('448');
  });

  it('a card with no lines still shows the empty table, as the bill does', async () => {
    openCard({ id: 'j2', clientName: 'B', work: 'Just a note' });
    await waitFor(() => expect(screen.getByTestId('job-amount')).toBeTruthy());
    expect(screen.getByTestId('job-lines')).toBeTruthy();
    expect(screen.queryAllByTestId('job-line')).toHaveLength(0);
  });
});
