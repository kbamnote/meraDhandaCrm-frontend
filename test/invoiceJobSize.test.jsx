/**
 * Job category and size on an invoice line.
 *
 * A print shop quotes some work by the piece and some by the area it covers,
 * and the bill has to show both — a customer checking 64 sqft at ₹7 cannot
 * check it against a line that prints neither figure.
 *
 * The figures here are the shop's own job-card sheet, row for row, so the
 * arithmetic on screen can be read against the paper it came from.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../src/services/realtime.js', () => ({
  db: {}, socket: { on() {}, off() {}, emit() {} },
  ref: (_d, path) => ({ path }), onValue: (_r, cb) => { cb({ val: () => ({}) }); return () => {}; },
  authSocket: () => {},
}));

const { lineArea, lineGross } = await import('../src/components/common/CreateInvoiceFlow.jsx');
const InvoiceDocument = (await import('../src/components/common/InvoiceDocument.jsx')).default;

describe('the area a line covers', () => {
  it('is length × width × qty, row for row off the job card', () => {
    //                        L   W   Qty      area
    expect(lineArea({ length: 8, width: 5, qty: 1000 })).toBe(40000);
    expect(lineArea({ length: 4, width: 8, qty: 2 })).toBe(64);
    expect(lineArea({ length: 2, width: 2, qty: 1 })).toBe(4);
    expect(lineArea({ length: 2, width: 4, qty: 2 })).toBe(16);
    expect(lineArea({ length: 4, width: 4, qty: 1 })).toBe(16);
    expect(lineArea({ length: 1, width: 1, qty: 100 })).toBe(100);
  });

  it('is nothing until BOTH sides are known', () => {
    expect(lineArea({ length: 8, qty: 10 })).toBe(0);
    expect(lineArea({ width: 5, qty: 10 })).toBe(0);
    expect(lineArea({ qty: 10 })).toBe(0);
  });

  it('does not convert between units — 8 × 5 inches is 40 of them', () => {
    // The unit is the line's own; converting would restate a size the
    // customer agreed to.
    expect(lineArea({ length: 8, width: 5, qty: 1, unit: 'Inch' })).toBe(40);
    expect(lineArea({ length: 8, width: 5, qty: 1, unit: 'Sqft' })).toBe(40);
  });
});

describe('what the rate multiplies', () => {
  it('prices on Qty by default, so no existing line moves', () => {
    expect(lineGross({ qty: 3, rate: 100 })).toBe(300);
    // A size recorded but not charged on leaves the price alone.
    expect(lineGross({ qty: 1000, rate: 1, length: 8, width: 5 })).toBe(1000);
  });

  it('prices on Area when the line says so — 64 sqft at ₹7 is ₹448', () => {
    expect(lineGross({ qty: 2, rate: 7, length: 4, width: 8, rateOn: 'area' })).toBe(448);
    expect(lineGross({ qty: 1, rate: 150, length: 2, width: 2, rateOn: 'area' })).toBe(600);
    expect(lineGross({ qty: 2, rate: 100, length: 2, width: 4, rateOn: 'area' })).toBe(1600);
    expect(lineGross({ qty: 1, rate: 350, length: 4, width: 4, rateOn: 'area' })).toBe(5600);
  });

  it('falls back to Qty when there is no area to charge against', () => {
    // Otherwise "Rate × Area" with no area would price the line at zero.
    expect(lineGross({ qty: 5, rate: 20, rateOn: 'area' })).toBe(100);
  });
});

// ── The printed document ───────────────────────────────────────────────────

const BASE = {
  invoiceNo: 'MW-26-27-1', date: '2026-11-26', type: 'invoice',
  clientName: 'A Customer', gstRate: 18, interState: false,
  subtotal: 448, taxableValue: 448, cgst: 40.32, sgst: 40.32, igst: 0,
  taxTotal: 80.64, total: 528.64, company: {}, bank: {},
};
const show = (invoice) => render(<MemoryRouter><InvoiceDocument invoice={invoice} /></MemoryRouter>);

// The LINE-ITEMS table, not the header blocks or the HSN summary — the page
// holds several tables and they all have headers.
const lineTable = () => [...document.querySelectorAll('table')]
  .find((t) => [...t.querySelectorAll('th')].some((th) => th.textContent.trim() === 'S.NO.'));
const headers = () => [...lineTable().querySelectorAll('th')].map((th) => th.textContent.trim());

describe('the invoice prints the job columns only when a line uses them', () => {
  it('a plain bill is untouched — no Category, Size, Wt., Area or G Total', () => {
    show({ ...BASE, items: [{ name: 'Printing', qty: 2, rate: 224, amount: 448, tax: 80.64 }] });
    const h = headers();
    expect(h).toContain('AMOUNT');
    for (const col of ['CATEGORY', 'SIZE', 'WT.', 'AREA', 'TAX AMT', 'G TOTAL']) {
      expect(h, `${col} must not appear on a bill that has no sizes`).not.toContain(col);
    }
  });

  it('one line with a size turns the whole set on', () => {
    show({ ...BASE, items: [{
      name: 'Flex banner', jobCategory: 'Flex Printing', unit: 'Sqft',
      length: 4, width: 8, weight: 0, area: 64, rateOn: 'area',
      qty: 2, rate: 7, amount: 448, tax: 80.64,
    }] });
    const h = headers();
    for (const col of ['CATEGORY', 'SIZE', 'AREA', 'GST', 'TAX AMT', 'AMOUNT', 'G TOTAL']) {
      expect(h, `${col} is missing`).toContain(col);
    }
    // Weight is not one of them. Nothing can be written with a weight any
    // more — nothing priced from it — so the column would be dashes.
    expect(h).not.toContain('WT.');
  });

  it('shows the size, the area with its unit, and the line gross', () => {
    const { container } = show({ ...BASE, items: [{
      name: 'Flex banner', jobCategory: 'Flex Printing', unit: 'Sqft',
      length: 4, width: 8, area: 64, rateOn: 'area',
      qty: 2, rate: 7, amount: 448, tax: 80.64,
    }] });
    const txt = container.textContent;
    expect(txt).toContain('Flex Printing');
    expect(txt).toContain('4 × 8');
    expect(txt).toContain('64 Sqft');
    // 448 + 80.64 — the figure a customer checks the job against.
    expect(txt).toContain('528.64');
    // And it says the rate is not per piece.
    expect(txt).toContain('per area');
  });

  it('a document that DOES carry a weight still prints it', async () => {
    // A bill written while the field existed has to reprint as it was issued.
    const { container } = show({ ...BASE, items: [{
      name: 'Metal plate', jobCategory: 'Metal Marking', unit: 'Pcs',
      weight: 2.5, qty: 100, rate: 10, amount: 1000, tax: 180,
    }], subtotal: 1000, taxableValue: 1000, cgst: 90, sgst: 90, taxTotal: 180, total: 1180 });
    expect(container.textContent).toContain('2.5');
    // Qty × rate, exactly as the job card has it.
    expect(container.textContent).toContain('1,000');
    expect(container.textContent).not.toContain('per area');
  });

  it('the totals rows still line up under the last money column', () => {
    show({ ...BASE, items: [{
      name: 'Flex banner', jobCategory: 'Flex Printing', unit: 'Sqft',
      length: 4, width: 8, area: 64, rateOn: 'area',
      qty: 2, rate: 7, amount: 448, tax: 80.64,
    }] });
    // Every body row must hold the same number of cells as the header, or the
    // columns walk out of line across the page.
    const cols = headers().length;
    const rows = [...lineTable().querySelectorAll('tbody tr')];
    for (const tr of rows) {
      const span = [...tr.children].reduce((a, td) => a + (Number(td.getAttribute('colspan')) || 1), 0);
      expect(span, `a row spans ${span} of ${cols} columns`).toBe(cols);
    }
  });
});
