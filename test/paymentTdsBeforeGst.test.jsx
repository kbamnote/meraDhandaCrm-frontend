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

/**
 * …and once it is applied, the bill shows what is actually being received.
 *
 * Reported from the shop: "when applying the TDS and checking the box it is
 * not coming in amount received". Applying TDS before typing the receipt is
 * the natural order — you learn what the customer kept back, which tells you
 * what they paid — but the spread had no money to place, so the row sat at ₹0
 * and the receipt had to be worked out by hand.
 */
const amountBox = () => screen.getByTestId('bill-allocation');
const receipt = () => screen.getByTestId('payment-amount');

async function applyTdsRate() {
  fireEvent.click(screen.getByTestId('bill-tds'));
  fireEvent.change(screen.getByTestId('tds-rate'), { target: { value: '0' } });
  fireEvent.click(screen.getByTestId('apply-save'));
  await waitFor(() => expect(screen.getByTestId('bill-tds-set')).toBeTruthy());
}

describe('Applying TDS fills in what the bill still needs', () => {
  beforeEach(() => {
    openBills.mockReset();
    openBills.mockResolvedValue({ rows: [BILL], totalDue: BILL.due });
  });

  it('puts ₹19,198 under Amount Received — the bill less the ₹331 withheld', async () => {
    mount();
    await waitFor(() => expect(screen.getByTestId('bill-tds')).toBeTruthy());
    // Nothing to place yet, so the row is blank.
    expect(amountBox().value).toBe('');
    await applyTdsRate();
    expect(Number(amountBox().value)).toBeCloseTo(19198, 2);
    expect(Number(receipt().value)).toBeCloseTo(19198, 2);
    // Money + TDS settles the bill exactly: nothing left on account.
    expect(screen.queryByTestId('payment-onaccount')).toBeNull();
  });

  it('never overwrites a receipt the user has already entered', async () => {
    mount();
    await waitFor(() => expect(screen.getByTestId('bill-tds')).toBeTruthy());
    fireEvent.change(receipt(), { target: { value: '15000' } });
    await applyTdsRate();
    expect(Number(receipt().value)).toBe(15000);
  });

  it('leaves the receipt alone for a bill that is not ticked', async () => {
    mount();
    await waitFor(() => expect(screen.getByTestId('bill-tds')).toBeTruthy());
    fireEvent.click(screen.getByTestId('bill-pick'));   // untick
    await applyTdsRate();
    expect(receipt().value).toBe('');
  });

  it('adds up across every ticked bill', async () => {
    const second = { ...BILL, id: 'inv2', no: 'MW-97', total: 5000, tax: 0, due: 5000, exGst: 5000, dueExGst: 5000 };
    openBills.mockResolvedValue({ rows: [BILL, second], totalDue: 24529 });
    mount();
    await waitFor(() => expect(screen.getAllByTestId('bill-tds')).toHaveLength(2));
    // TDS on the first bill only; the second still needs its full ₹5,000.
    fireEvent.click(screen.getAllByTestId('bill-tds')[0]);
    fireEvent.change(screen.getByTestId('tds-rate'), { target: { value: '0' } });
    fireEvent.click(screen.getByTestId('apply-save'));
    await waitFor(() => expect(screen.getByTestId('bill-tds-set')).toBeTruthy());
    expect(Number(receipt().value)).toBeCloseTo(19198 + 5000, 2);
  });
});
