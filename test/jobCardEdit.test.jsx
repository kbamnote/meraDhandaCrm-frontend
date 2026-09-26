/**
 * Editing a job card from the Job Cards page.
 *
 * What matters is that the edit form is the SAME form the card was raised with,
 * filled in with what the card says, and that saving corrects that card rather
 * than raising a second one — the failure people notice weeks later, when two
 * job numbers exist for one job.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent, within } from '@testing-library/react';
import { renderScreen } from './renderScreen.jsx';

const created = [];
const updated = [];
let jobs = {};

vi.mock('../src/services/realtime.js', () => ({
  db: { __backend: 'test' }, socket: { on() {}, off() {}, emit() {} },
  ref: (_db, path) => ({ path }),
  onValue: (refObj, cb) => {
    cb({ val: () => (String(refObj.path).endsWith('jobs') ? jobs : {}) });
    return () => {};
  },
  authSocket: () => {},
}));
vi.mock('../src/services/api.js', async () => {
  const actual = await vi.importActual('../src/services/api.js');
  return {
    ...actual,
    ordersApi: {
      ...actual.ordersApi,
      nextNumber: vi.fn(async () => ({ jobNo: 'JOB-26-27-009' })),
      lookups: vi.fn(async () => ({ products: [], salespeople: [] })),
      searchClients: vi.fn(async () => []),
      create: vi.fn(async (b) => { created.push(b); return { id: 'new', jobNo: 'JOB-26-27-009', ...b }; }),
      update: vi.fn(async (id, b) => { updated.push({ id, body: b }); return { id, jobNo: 'JOB-26-27-001', ...b }; }),
    },
  };
});

const { default: JobCardsPage } = await import('../src/pages/JobCardsPage.jsx');

const JOB = {
  jobNo: 'JOB-26-27-001', clientName: 'Sharma Traders', clientMobile: '9000000000',
  work: 'Wedding cards', amount: 5000, deliveryDate: '2026-10-01', priority: 'normal',
  stage: 'enquiry', createdAt: Date.now(), deliveryTime: '5:00 PM', notes: 'Gold foil',
};

const openEdit = async () => {
  renderScreen(JobCardsPage);
  const btn = await screen.findByTestId('edit-job');
  fireEvent.click(btn);
  return waitFor(() => expect(screen.getByDisplayValue('Sharma Traders')).toBeTruthy());
};
const field = (value) => screen.getByDisplayValue(value);
const submit = () => fireEvent.submit(screen.getByDisplayValue('Sharma Traders').closest('form'));

beforeEach(() => {
  created.length = 0; updated.length = 0;
  jobs = { j1: { ...JOB } };
});

describe('the Job Cards page', () => {
  it('offers to edit a job card', async () => {
    renderScreen(JobCardsPage);
    expect(await screen.findByTestId('edit-job')).toBeTruthy();
  });

  it('opens the card filled in with what it says', async () => {
    await openEdit();
    expect(field('Sharma Traders')).toBeTruthy();
    expect(field('9000000000')).toBeTruthy();
    expect(field('Wedding cards')).toBeTruthy();
    expect(field('2026-10-01')).toBeTruthy();
    expect(field('Gold foil')).toBeTruthy();
    // Its own number, not the next one that would be issued. (It also appears
    // on the row behind the modal, hence the form-scoped look-up.)
    const form = screen.getByDisplayValue('Sharma Traders').closest('form');
    expect(within(form).getByText('JOB-26-27-001')).toBeTruthy();
    expect(screen.queryByText('JOB-26-27-009')).toBeNull();
  });

  it('saving corrects that card instead of raising a new one', async () => {
    await openEdit();
    fireEvent.change(field('Wedding cards'), { target: { value: 'Wedding cards — gold foil' } });
    submit();
    await waitFor(() => expect(updated).toHaveLength(1));
    expect(updated[0].id).toBe('j1');
    expect(updated[0].body.work).toBe('Wedding cards — gold foil');
    expect(created, 'an edit must never create a second job').toHaveLength(0);
  });

  it('keeps the rest of the card as it was', async () => {
    await openEdit();
    fireEvent.change(field('Wedding cards'), { target: { value: 'Banners' } });
    submit();
    await waitFor(() => expect(updated).toHaveLength(1));
    const b = updated[0].body;
    expect(b.clientName).toBe('Sharma Traders');
    expect(b.clientMobile).toBe('9000000000');
    expect(b.deliveryDate).toBe('2026-10-01');
    expect(b.deliveryTime, 'the 5 PM slot survives a round trip').toBe('5:00 PM');
  });

  it('a delivered or cancelled card cannot be edited from here', async () => {
    jobs = { j1: { ...JOB, stage: 'delivered' }, j2: { ...JOB, jobNo: 'JOB-2', stage: 'cancelled' } };
    renderScreen(JobCardsPage);
    await waitFor(() => expect(screen.getByText('JOB-26-27-001')).toBeTruthy());
    expect(screen.queryAllByTestId('edit-job')).toHaveLength(0);
  });

  it('still raises a new card the normal way', async () => {
    renderScreen(JobCardsPage);
    fireEvent.click(await screen.findByRole('button', { name: /New Job|Naya Job/i }));
    await waitFor(() => expect(screen.getByText('JOB-26-27-009')).toBeTruthy());
    const form = screen.getByText('JOB-26-27-009').closest('form');
    const name = within(form).getAllByPlaceholderText(/Customer|naam|name/i)[1];
    fireEvent.change(name, { target: { value: 'New Customer' } });
    fireEvent.submit(form);
    await waitFor(() => expect(created).toHaveLength(1));
    expect(created[0].clientName).toBe('New Customer');
    expect(updated).toHaveLength(0);
  });
});
