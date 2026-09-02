/**
 * Purchase register import — column mapping.
 *
 * Built against the user's actual bill-book export, whose header row is:
 *
 *   Purchase | Original Invoice No | Purchase Date | Party Name | Purchase |
 *   Purchase link | Notes
 *
 * Two columns are literally called "Purchase". SheetJS de-duplicates the second
 * into "Purchase_1", and nothing in the header text says which one is the number
 * and which is the amount. The guess must therefore NOT invent an answer for the
 * ambiguous one — it maps what it can and leaves the rest for the user, because
 * mapping the wrong column to Amount writes wrong money into the books.
 */
import { describe, it, expect } from 'vitest';
import { guessField } from '../src/components/common/PurchaseBulkUpload.jsx';

// Mirrors the component: first match wins, a field can only be claimed once.
function mapHeaders(headers) {
  const taken = new Set();
  const out = {};
  headers.forEach((h) => {
    const f = guessField(h, taken);
    if (f) { out[h] = f; taken.add(f); }
  });
  return out;
}

describe('purchase import column mapping', () => {
  it("maps the user's bill-book headers and leaves the ambiguous one alone", () => {
    const headers = ['Purchase', 'Original Invoice No', 'Purchase Date', 'Party Name', 'Purchase_1', 'Purchase link', 'Notes'];
    const m = mapHeaders(headers);

    expect(m['Original Invoice No']).toBe('originalInvoiceNo');
    expect(m['Purchase Date']).toBe('date');
    expect(m['Party Name']).toBe('partyName');
    expect(m['Purchase link']).toBe('link');
    expect(m.Notes).toBe('notes');
    expect(m.Purchase).toBe('billNo');

    // The second "Purchase" is genuinely undecidable from its name. Guessing it
    // as the amount would be a coin flip on a money column.
    expect(m.Purchase_1, 'the duplicate header must not be guessed').toBeUndefined();
  });

  it('a field is never claimed by two columns', () => {
    const m = mapHeaders(['Bill No', 'Invoice No', 'Voucher No']);
    expect(Object.values(m).filter((f) => f === 'billNo')).toHaveLength(1);
  });

  it('recognises the common names other bill books use', () => {
    const cases = {
      'Bill No': 'billNo', 'Invoice Number': 'billNo', 'Voucher No': 'billNo',
      'Bill Date': 'date', 'Invoice Date': 'date', Date: 'date',
      Supplier: 'partyName', 'Vendor Name': 'partyName', Party: 'partyName',
      Amount: 'amount', Total: 'amount', 'Bill Amount': 'amount',
      'Grand Total': 'amount', 'Net Amount': 'amount', 'Purchase Amount': 'amount',
      Remarks: 'notes', Narration: 'notes', Particulars: 'notes',
      'Bill Copy': 'link', URL: 'link', Attachment: 'link',
    };
    for (const [header, field] of Object.entries(cases)) {
      expect(guessField(header, new Set()), `"${header}"`).toBe(field);
    }
  });

  it('is tolerant of spacing, case and punctuation', () => {
    for (const h of ['party name', 'PARTY_NAME', 'Party-Name', 'Party.Name', '  Party Name  ']) {
      expect(guessField(h, new Set()), `"${h}"`).toBe('partyName');
    }
  });

  it('ignores columns it does not understand rather than mis-assigning them', () => {
    for (const h of ['GSTIN', 'Transport', 'Created By', 'Column7', '']) {
      expect(guessField(h, new Set()), `"${h}"`).toBe('');
    }
  });
});
