/**
 * Record Payment In → Apply TDS: the rate is taken on the bill BEFORE GST.
 *
 * The shop hit this on a live receipt — 2% on a ₹19,529 GST-inclusive bill
 * deducted ₹390.58, when the taxable value was ₹16,550 and the certificate
 * reads ₹331. Tax shown separately on the invoice is not the supplier's
 * income and nothing is withheld from it (CBDT Circular 23/2017), so the base
 * is the outstanding amount net of GST, which the server sends as `dueExGst`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const openBills = vi.fn();

vi.mock('../src/services/realtime.js', () => ({
  db: {}, socket: { on() {}, off() {}, emit() {} },
  ref: (_db, path) => ({ path }), onValue: (_r, cb) => { cb({ val: () => ({}) }); return () => {}; },
  authSocket: () => {},
}));

vi.mock('../src/services/api.js', () => ({
  describeError: (e, f) => f,
  accountingApi: {
    paymentNumber: () => Promise.resolve({ number: 'INV/PI/26-27/67' }),
    openBills: (...a) => openBills(...a),
    // 2% — the rate on the receipt that prompted this.
    tdsSections: () => Promise.resolve([{ code: '194H', name: 'Commission or Brokerage', defaultRate: 2 }]),
    addTdsRate: () => Promise.resolve({ code: 'X', rate: 2 }),
  },
  dbApi: { list: () => Promise.resolve({}) },
}));

const { PaymentForm } = await import('../src/pages/accounting/RecordPaymentPage.jsx');

const PARTY = { id: 'c1', name: 'U AND I RESOURCES PVT. LTD', type: 'client' };

// ₹16,550 taxable + 18% GST = ₹19,529 payable.
const BILL = {
  id: 'inv1', no: 'MW-25-26-96', date: '2025-06-06',
  total: 19529, tax: 2979, paid: 0,
  due: 19529, exGst: 16550, dueExGst: 16550, settledHere: 0,
};

const mount = () => render(
  <MemoryRouter>
    <PaymentForm direction="in" lockedParty={PARTY} onCancel={() => {}} onSaved={() => {}} />
  </MemoryRouter>
);

async function openTdsModal() {
  mount();
  await waitFor(() => expect(screen.getByTestId('bill-tds')).toBeTruthy());
  fireEvent.click(screen.getByTestId('bill-tds'));
  return screen.getByTestId('tds-rate');
}

describe('Apply TDS takes the rate on the value before GST', () => {
  beforeEach(() => {
    openBills.mockReset();
    openBills.mockResolvedValue({ rows: [BILL], totalDue: BILL.due });
  });

  it('2% of a ₹19,529 bill is ₹331 (on ₹16,550), not ₹390.58', async () => {
    const select = await openTdsModal();
    fireEvent.change(select, { target: { value: '0' } });
    expect(Number(screen.getByTestId('apply-amount').value)).toBeCloseTo(331, 2);
  });

  it('names the figure the rate was taken on', async () => {
    await openTdsModal();
    expect(screen.getByTestId('tds-base').textContent).toMatch(/16,550.*before GST/i);
  });

  it('says nothing about GST on a bill that carries none', async () => {
    openBills.mockResolvedValue({
      rows: [{ ...BILL, total: 16550, tax: 0, due: 16550, exGst: 16550, dueExGst: 16550 }],
      totalDue: 16550,
    });
    await openTdsModal();
    expect(screen.queryByTestId('tds-base')).toBeNull();
  });

  it('a part-paid bill gets the pre-GST share of what is left, never more than is due', async () => {
    // ₹10,000 already paid: ₹9,529 due, of which ₹8,075.42 is pre-GST — the
    // figure the server's own (exGst × due / total) gives for this bill.
    openBills.mockResolvedValue({
      rows: [{ ...BILL, paid: 10000, due: 9529, dueExGst: 8075.42 }], totalDue: 9529,
    });
    const select = await openTdsModal();
    fireEvent.change(select, { target: { value: '0' } });
    const v = Number(screen.getByTestId('apply-amount').value);
    expect(v).toBeCloseTo(161.51, 2);
    expect(v).toBeLessThan(9529);
  });

  it('falls back to the outstanding amount when the server sends no pre-GST figure', async () => {
    // An older API, or a bill with no GST on it at all.
    const { dueExGst, exGst, ...noExGst } = BILL;
    openBills.mockResolvedValue({ rows: [noExGst], totalDue: BILL.due });
    const select = await openTdsModal();
    fireEvent.change(select, { target: { value: '0' } });
    expect(Number(screen.getByTestId('apply-amount').value)).toBeCloseTo(390.58, 2);
  });
});
