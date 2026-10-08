/**
 * Shop Visits, read by somebody who can see the whole team:
 *   * whose visit each one was — without the name an admin cannot tell one
 *     rep's shops from another's
 *   * a filter to read one rep at a time
 *   * the photo opens big enough to actually look at
 *
 * And the same page for a rep, who should see neither the names nor the filter.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent, within } from '@testing-library/react';
import { renderScreen, OWNER, STAFF } from './renderScreen.jsx';

let payload = { rows: [], canWatch: true };
const createdJobs = [];
const summary = { date: '2026-10-08', rows: [] };

vi.mock('../src/services/realtime.js', () => ({
  db: { __backend: 'test' }, socket: { on() {}, off() {}, emit() {} },
  ref: (_db, path) => ({ path }),
  onValue: (_r, cb) => { cb({ val: () => ({}) }); return () => {}; },
  authSocket: () => {},
}));
vi.mock('../src/services/api.js', async () => {
  const actual = await vi.importActual('../src/services/api.js');
  return {
    ...actual,
    visitsApi: {
      list: vi.fn(async () => payload),
      summary: vi.fn(async () => summary),
      remove: vi.fn(async () => ({ deleted: true })),
    },
    ordersApi: {
      ...actual.ordersApi,
      create: vi.fn(async (body) => { createdJobs.push(body); return { jobNo: 'JOB-26-27-009', id: 'j9' }; }),
      nextNumber: vi.fn(async () => ({ jobNo: 'JOB-26-27-009' })),
      lookups: vi.fn(async () => ({ products: [], salespeople: [] })),
      searchClients: vi.fn(async () => []),
    },
  };
});

const { default: ShopVisitsPage } = await import('../src/pages/ShopVisitsPage.jsx');

const visit = (over) => ({
  id: 'v1', userId: 'rep1', userName: 'Ravi Kumar',
  clientName: 'Sharma Printers', clientPhone: '9822011111',
  photo: 'https://img.test/shop1.jpg',
  lat: 21.1458, lng: 79.0882, area: 'Sitabuldi, Nagpur', locationMissing: false,
  date: '2026-10-08', checkInAt: 1760000000000, checkOutAt: 1760001800000,
  durationMs: 1800000, feedback: 'Wants 500 cards', outcome: 'follow_up',
  ...over,
});

const TEAM = [
  visit(),
  visit({ id: 'v2', userId: 'rep2', userName: 'Sunil Verma', clientName: 'Verma Press', photo: 'https://img.test/shop2.jpg' }),
  visit({ id: 'v3', userId: 'rep2', userName: 'Sunil Verma', clientName: 'Agrawal Stationers', photo: null }),
];

beforeEach(() => { payload = { rows: TEAM, canWatch: true }; createdJobs.length = 0; });

describe('an admin reading the team’s visits', () => {
  it('shows whose visit each one was', async () => {
    renderScreen(ShopVisitsPage, { auth: OWNER });
    const rows = await screen.findAllByTestId('visit-row');
    expect(rows).toHaveLength(3);
    expect(rows[0].textContent).toContain('Ravi Kumar');
    expect(rows[1].textContent).toContain('Sunil Verma');
  });

  it('offers a filter listing each salesperson once', async () => {
    renderScreen(ShopVisitsPage, { auth: OWNER });
    const sel = await screen.findByTestId('visit-person');
    const names = [...sel.querySelectorAll('option')].map((o) => o.textContent);
    expect(names).toEqual(['Everyone (3)', 'Ravi Kumar', 'Sunil Verma']);
  });

  it('narrows the list to the chosen person', async () => {
    renderScreen(ShopVisitsPage, { auth: OWNER });
    const sel = await screen.findByTestId('visit-person');
    fireEvent.change(sel, { target: { value: 'rep2' } });
    await waitFor(() => expect(screen.getAllByTestId('visit-row')).toHaveLength(2));
    expect(screen.queryByText('Sharma Printers')).toBeNull();
    // ...and back again.
    fireEvent.change(sel, { target: { value: 'all' } });
    await waitFor(() => expect(screen.getAllByTestId('visit-row')).toHaveLength(3));
  });

  it('opens the photo big, with the visit it belongs to and a link to the original', async () => {
    renderScreen(ShopVisitsPage, { auth: OWNER });
    const photos = await screen.findAllByTestId('visit-photo');
    // Two of the three visits have a photo; the third must not offer one.
    expect(photos).toHaveLength(2);

    fireEvent.click(photos[0]);
    const viewer = await screen.findByTestId('photo-viewer');
    expect(viewer.querySelector('img').getAttribute('src')).toBe('https://img.test/shop1.jpg');
    expect(viewer.textContent).toContain('Sharma Printers');
    expect(viewer.textContent).toContain('Ravi Kumar');
    const link = within(viewer).getByRole('link');
    expect(link.getAttribute('href')).toBe('https://img.test/shop1.jpg');
    expect(link.getAttribute('target')).toBe('_blank');
  });

  it('closes the viewer when the backdrop is clicked', async () => {
    renderScreen(ShopVisitsPage, { auth: OWNER });
    fireEvent.click((await screen.findAllByTestId('visit-photo'))[0]);
    const viewer = await screen.findByTestId('photo-viewer');
    fireEvent.click(viewer);
    await waitFor(() => expect(screen.queryByTestId('photo-viewer')).toBeNull());
  });

  it('keeps the picture itself clickable without closing the viewer', async () => {
    renderScreen(ShopVisitsPage, { auth: OWNER });
    fireEvent.click((await screen.findAllByTestId('visit-photo'))[0]);
    const viewer = await screen.findByTestId('photo-viewer');
    fireEvent.click(viewer.querySelector('img'));
    expect(screen.getByTestId('photo-viewer')).toBeTruthy();
  });
});

describe('a rep reading their own visits', () => {
  beforeEach(() => { payload = { rows: [visit()], canWatch: false }; });

  it('gets no filter — there is nobody to choose between', async () => {
    renderScreen(ShopVisitsPage, { auth: STAFF });
    await screen.findByTestId('visit-row');
    expect(screen.queryByTestId('visit-person')).toBeNull();
  });

  it('and no name on their own row', async () => {
    renderScreen(ShopVisitsPage, { auth: STAFF });
    const row = await screen.findByTestId('visit-row');
    expect(row.textContent).toContain('Sharma Printers');
    expect(row.textContent).not.toContain('Ravi Kumar');
  });

  it('but can still open their photo', async () => {
    renderScreen(ShopVisitsPage, { auth: STAFF });
    fireEvent.click(await screen.findByTestId('visit-photo'));
    expect(await screen.findByTestId('photo-viewer')).toBeTruthy();
  });
});

describe('raising a job card from a visit', () => {
  // Only a visit that ended in an order offers it.
  const ORDER = visit({
    id: 'v9', userId: 'rep1', userName: 'Ravi Kumar', clientName: 'Agrawal Stationers',
    clientPhone: '9822022222', outcome: 'order_placed', feedback: '1000 letterheads',
  });

  it('is offered only when the shop actually ordered', async () => {
    payload = { rows: [ORDER, visit({ id: 'v8', outcome: 'not_interested' })], canWatch: true };
    renderScreen(ShopVisitsPage, { auth: OWNER });
    await waitFor(() => expect(screen.getAllByTestId('visit-row')).toHaveLength(2));
    expect(screen.getAllByTestId('visit-make-job')).toHaveLength(1);
  });

  it('opens the FULL job-card form, not a cut-down one', async () => {
    payload = { rows: [ORDER], canWatch: true };
    renderScreen(ShopVisitsPage, { auth: OWNER });
    fireEvent.click(await screen.findByTestId('visit-make-job'));

    // The real form's own sections and fields — the three-field version had
    // none of these, which is what left the floor chasing details.
    await waitFor(() => expect(screen.getByText(/Customer Details/i)).toBeTruthy());
    // getAllByText: the label text also appears in the search hint above it.
    for (const label of [/Client Name/i, /Mobile/i, /Address/i, /Email/i,
      /Delivery Date/i, /Priority/i, /GST/i, /Advance/i]) {
      expect(screen.getAllByText(label).length, String(label)).toBeGreaterThan(0);
    }
  });

  it('arrives prefilled with the shop from the visit', async () => {
    payload = { rows: [ORDER], canWatch: true };
    renderScreen(ShopVisitsPage, { auth: OWNER });
    fireEvent.click(await screen.findByTestId('visit-make-job'));
    await waitFor(() => expect(screen.getByDisplayValue('Agrawal Stationers')).toBeTruthy());
    expect(screen.getByDisplayValue('9822022222')).toBeTruthy();
  });

  it('sends the visit it came from and credits the rep who made it', async () => {
    payload = { rows: [ORDER], canWatch: true };
    renderScreen(ShopVisitsPage, { auth: OWNER });
    fireEvent.click(await screen.findByTestId('visit-make-job'));
    const name = await screen.findByDisplayValue('Agrawal Stationers');
    const form = name.closest('form');
    fireEvent.change(within(form).getByTestId('job-amount'), { target: { value: '4500' } });
    fireEvent.submit(form);
    await waitFor(() => expect(createdJobs).toHaveLength(1));

    const body = createdJobs[0];
    expect(body.visitId).toBe('v9');
    // The order value has to travel: it is what the rep'''s dashboard adds up,
    // and what the visit shows beside the job number.
    expect(body.amount).toBe(4500);
    // The admin is logged in, but the order belongs to the rep who walked in.
    expect(body.salesPersonId).toBe('rep1');
    expect(body.clientName).toBe('Agrawal Stationers');
    expect(body.clientMobile).toBe('9822022222');
    // A client id the form cannot update would be a way to file the card
    // against the wrong party; the server matches on phone instead.
    expect(body.clientId).toBeUndefined();
  });

  it('shows the job on the visit once it exists, instead of offering another', async () => {
    payload = { rows: [visit({ ...ORDER, jobId: 'j9', jobNo: 'JOB-26-27-009', orderAmount: 4500 })], canWatch: true };
    renderScreen(ShopVisitsPage, { auth: OWNER });
    await waitFor(() => expect(screen.getByTestId('visit-job')).toBeTruthy());
    expect(screen.getByTestId('visit-job').textContent).toContain('JOB-26-27-009');
    expect(screen.queryByTestId('visit-make-job')).toBeNull();
  });
});
