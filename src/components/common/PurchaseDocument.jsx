/**
 * A supplier's bill, rendered as a printable A4 document.
 *
 * Deliberately a sibling of InvoiceDocument rather than a mode of it. A purchase
 * is the mirror image of a sale, and the differences run through the whole page:
 *
 *   * the SUPPLIER issued it and sits at the top; we are the buyer ("Bill To")
 *   * tax is per line — a supplier's bill often mixes 12% and 18% items — so the
 *     tax summary is grouped by HSN AND rate, not one invoice-wide rate
 *   * no Original/Duplicate/Triplicate set: that is the supplier's statutory
 *     obligation on their copy, and printing it on our record would misrepresent
 *     whose document this is
 *   * no UPI collection QR — we are the ones paying
 *   * TDS and TCS appear, because on a purchase they change what is payable
 *
 * The sales document is a legal record we issue; bending it to fit this would
 * put that print at risk for the sake of reuse.
 */
import { useMemo } from 'react';

const round2 = (n) => Math.round(((Number(n) || 0) * 100) + 1e-8) / 100;
const money = (n) => round2(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function fmtDate(d) {
  if (!d) return '—';
  const s = String(d).slice(0, 10);
  const [y, m, day] = s.split('-');
  return y && m && day ? `${day}/${m}/${y}` : s;
}

// Indian numbering, spelled out — "Rupees Fourteen Thousand One Hundred Sixty".
function toWords(amount) {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const two = (n) => (n < 20 ? ones[n] : `${tens[Math.floor(n / 10)]}${n % 10 ? ` ${ones[n % 10]}` : ''}`);
  const three = (n) => {
    const h = Math.floor(n / 100); const r = n % 100;
    return [h ? `${ones[h]} Hundred` : '', r ? two(r) : ''].filter(Boolean).join(' ');
  };
  const n = Math.floor(Math.abs(Number(amount) || 0));
  if (n === 0) return 'Zero';
  const parts = [];
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const rest = n % 1000;
  if (crore) parts.push(`${three(crore)} Crore`);
  if (lakh) parts.push(`${two(lakh)} Lakh`);
  if (thousand) parts.push(`${two(thousand)} Thousand`);
  if (rest) parts.push(three(rest));
  const paise = Math.round((Math.abs(Number(amount) || 0) - n) * 100);
  return parts.join(' ') + (paise ? ` and ${two(paise)} Paise` : '');
}

export default function PurchaseDocument({ purchase }) {
  const p = purchase || {};
  const items = Array.isArray(p.items) ? p.items : [];
  const buyer = p.buyer || {};
  const inter = !!p.interState;

  // Grouped by HSN *and* rate: two lines sharing an HSN at different rates are
  // taxed differently and must not be merged into one row.
  const taxRows = useMemo(() => {
    const map = new Map();
    items.forEach((it) => {
      const rate = Number(it.taxRate) || 0;
      const key = `${it.hsn || '—'}|${rate}`;
      const cur = map.get(key) || { hsn: it.hsn || '—', rate, taxable: 0, tax: 0 };
      cur.taxable = round2(cur.taxable + (Number(it.amount) || 0));
      cur.tax = round2(cur.tax + (Number(it.tax) || 0));
      map.set(key, cur);
    });
    return [...map.values()];
  }, [items]);

  const qtyTotal = items.reduce((s, it) => s + (Number(it.qty) || 0), 0);
  const charges = Array.isArray(p.additionalCharges) ? p.additionalCharges : [];
  const paid = round2(p.paidAmount || 0);
  const balance = round2(Math.max(0, (Number(p.total) || 0) - paid));

  return (
    <>
      <style>{`
        .pd-doc { background: #eef1ee; padding: 16px 0; }
        .pd-page {
          width: 210mm; min-height: 297mm; margin: 0 auto 16px; padding: 10mm;
          background: #fff; color: #111; box-sizing: border-box;
          font-family: Arial, Helvetica, sans-serif; font-size: 10px; line-height: 1.35;
          box-shadow: 0 2px 10px rgba(0,0,0,.15);
        }
        .pd-page * { box-sizing: border-box; }
        .pd-t { width: 100%; border-collapse: collapse; }
        .pd-t th, .pd-t td { border: 1px solid #111; padding: 4px 6px; vertical-align: top; }
        .pd-t th { background: #e4ecf5; font-size: 9.5px; text-align: center; font-weight: 700; }
        .pd-r { text-align: right; }
        .pd-c { text-align: center; }
        .pd-title { font-size: 13px; font-weight: 700; letter-spacing: .3px; }
        .pd-tag {
          font-size: 8.5px; border: 1px solid #999; color: #444;
          padding: 2px 8px; border-radius: 3px; text-transform: uppercase; letter-spacing: .4px;
        }
        .pd-party { color: #1d4f91; font-size: 15px; font-weight: 700; line-height: 1.15; }
        @media print {
          .pd-doc { background: #fff; padding: 0; }
          .pd-page { width: auto; min-height: auto; margin: 0; box-shadow: none; padding: 8mm; }
          .no-print { display: none !important; }
          @page { size: A4; margin: 0; }
        }
      `}</style>

      <div className="pd-doc">
        <section className="pd-page" data-testid="purchase-document">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span className="pd-title">PURCHASE INVOICE</span>
            {/* Says plainly whose document this is a record of. */}
            <span className="pd-tag">Our record of the supplier&apos;s bill</span>
            {p.editedAt && <span className="pd-tag">Edited</span>}
          </div>

          {/* Supplier (issuer) + bill meta */}
          <table className="pd-t">
            <tbody>
              <tr>
                <td style={{ width: '58%' }}>
                  <div style={{ fontSize: 9, color: '#555', textTransform: 'uppercase', marginBottom: 2 }}>Bill From</div>
                  <div className="pd-party">{p.vendorName || '—'}</div>
                  {p.vendorAddress && <div style={{ marginTop: 3 }}>{p.vendorAddress}</div>}
                  <div style={{ marginTop: 3 }}>
                    {p.vendorGstNo && <><b>GSTIN:</b> {p.vendorGstNo}&nbsp;&nbsp;</>}
                    {p.vendorPhone && <><b>Mobile:</b> {p.vendorPhone}</>}
                  </div>
                </td>
                <td style={{ padding: 0 }}>
                  <table className="pd-t" style={{ border: 'none' }}>
                    <tbody>
                      <tr><th>Bill No.</th><th>Bill Date</th><th>Due Date</th></tr>
                      <tr className="pd-c">
                        <td data-testid="bill-no">{p.poNo || p.supplierInvoiceNo || '—'}</td>
                        <td>{fmtDate(p.date)}</td>
                        <td>{fmtDate(p.dueDate)}</td>
                      </tr>
                      <tr><th>Original Inv. No.</th><th>PO No.</th><th>E-Way Bill</th></tr>
                      <tr className="pd-c">
                        <td>{p.originalInvoiceNo || '—'}</td>
                        <td>{p.purchaseOrderNo || '—'}</td>
                        <td>{p.ewayBillNo || '—'}</td>
                      </tr>
                      <tr><th>Vehicle No.</th><th>Approved By</th><th>Place of Supply</th></tr>
                      <tr className="pd-c">
                        <td>{p.vehicleNo || '—'}</td>
                        <td>{p.approvedBy || '—'}</td>
                        <td>{p.placeOfSupply || '—'}</td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </tbody>
          </table>

          {/* Us, as buyer */}
          <table className="pd-t" style={{ marginTop: 6 }}>
            <tbody>
              <tr>
                <td style={{ width: '50%' }}>
                  <div style={{ fontSize: 9, color: '#555', textTransform: 'uppercase', marginBottom: 2 }}>Bill To</div>
                  <div style={{ fontWeight: 700 }}>{buyer.name || '—'}</div>
                  {buyer.address && <div>{buyer.address}</div>}
                  {buyer.gstNo && <div><b>GSTIN:</b> {buyer.gstNo}</div>}
                </td>
                <td>
                  <div style={{ fontSize: 9, color: '#555', textTransform: 'uppercase', marginBottom: 2 }}>Ship From</div>
                  <div>{p.shipFromAddress || p.vendorAddress || '—'}</div>
                </td>
              </tr>
            </tbody>
          </table>

          {/* Lines */}
          <table className="pd-t" style={{ marginTop: 6 }}>
            <thead>
              <tr>
                <th style={{ width: 26 }}>S.No</th>
                <th>Item</th>
                <th style={{ width: 60 }}>HSN</th>
                <th style={{ width: 50 }}>Qty</th>
                <th style={{ width: 66 }}>Rate</th>
                <th style={{ width: 60 }}>Discount</th>
                <th style={{ width: 46 }}>Tax %</th>
                <th style={{ width: 70 }}>Tax</th>
                <th style={{ width: 80 }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i} data-testid="purchase-line">
                  <td className="pd-c">{i + 1}</td>
                  <td>
                    <b>{it.name || '—'}</b>
                    {it.description && <div style={{ color: '#555' }}>{it.description}</div>}
                  </td>
                  <td className="pd-c">{it.hsn || '—'}</td>
                  <td className="pd-r">{Number(it.qty) || 0}{it.unit ? ` ${it.unit}` : ''}</td>
                  <td className="pd-r">{money(it.rate)}</td>
                  <td className="pd-r">{Number(it.discount) ? money(it.discount) : '—'}</td>
                  <td className="pd-c">{Number(it.taxRate) || 0}%</td>
                  <td className="pd-r">{money(it.tax)}</td>
                  <td className="pd-r"><b>{money(round2((Number(it.amount) || 0) + (Number(it.tax) || 0)))}</b></td>
                </tr>
              ))}
              <tr>
                <td colSpan={3} className="pd-r"><b>Total</b></td>
                <td className="pd-r"><b>{qtyTotal}</b></td>
                <td colSpan={3} />
                <td className="pd-r"><b>{money(p.taxTotal)}</b></td>
                <td className="pd-r"><b>{money(round2((Number(p.taxable) || Number(p.subtotal) || 0) + (Number(p.taxTotal) || 0)))}</b></td>
              </tr>
            </tbody>
          </table>

          <div style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'flex-start' }}>
            {/* Tax summary */}
            <table className="pd-t" style={{ flex: 1.3 }}>
              <thead>
                <tr>
                  <th>HSN/SAC</th><th>Rate</th><th>Taxable</th>
                  {inter ? <th>IGST</th> : <><th>CGST</th><th>SGST</th></>}
                  <th>Total Tax</th>
                </tr>
              </thead>
              <tbody>
                {taxRows.map((r, i) => (
                  <tr key={i}>
                    <td className="pd-c">{r.hsn}</td>
                    <td className="pd-c">{r.rate}%</td>
                    <td className="pd-r">{money(r.taxable)}</td>
                    {inter
                      ? <td className="pd-r">{money(r.tax)}</td>
                      : (
                        <>
                          <td className="pd-r">{money(round2(r.tax / 2))}</td>
                          <td className="pd-r">{money(round2(r.tax - round2(r.tax / 2)))}</td>
                        </>
                      )}
                    <td className="pd-r">{money(r.tax)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Money */}
            <table className="pd-t" style={{ flex: 1 }}>
              <tbody>
                <tr><td>Taxable Amount</td><td className="pd-r">{money(p.taxable ?? p.subtotal)}</td></tr>
                {Number(p.discount) > 0 && <tr><td>Discount</td><td className="pd-r">− {money(p.discount)}</td></tr>}
                {inter
                  ? <tr><td>IGST</td><td className="pd-r">{money(p.igst)}</td></tr>
                  : (
                    <>
                      <tr><td>CGST</td><td className="pd-r">{money(p.cgst)}</td></tr>
                      <tr><td>SGST</td><td className="pd-r">{money(p.sgst)}</td></tr>
                    </>
                  )}
                {charges.map((c, i) => (
                  <tr key={i}><td>{c.label}</td><td className="pd-r">{money(c.amount)}</td></tr>
                ))}
                {Number(p.tcsAmount) > 0 && <tr><td>TCS</td><td className="pd-r">{money(p.tcsAmount)}</td></tr>}
                {Number(p.tdsAmount) > 0 && <tr><td>TDS deducted</td><td className="pd-r">− {money(p.tdsAmount)}</td></tr>}
                {Number(p.roundOff) !== 0 && p.roundOff != null && (
                  <tr><td>Round Off</td><td className="pd-r">{Number(p.roundOff) > 0 ? '+' : '−'} {money(Math.abs(p.roundOff))}</td></tr>
                )}
                <tr>
                  <td><b>Total Amount</b></td>
                  <td className="pd-r" data-testid="bill-total"><b>₹ {money(p.total)}</b></td>
                </tr>
                <tr><td>Paid</td><td className="pd-r">{money(paid)}</td></tr>
                <tr>
                  <td><b>Balance Payable</b></td>
                  <td className="pd-r"><b>₹ {money(balance)}</b></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 6, border: '1px solid #111', padding: '4px 6px' }}>
            <b>Amount in words:</b> Rupees {toWords(p.total)} Only
          </div>

          {(p.notes || p.terms) && (
            <table className="pd-t" style={{ marginTop: 6 }}>
              <tbody>
                <tr>
                  {p.notes && <td style={{ width: '50%' }}><b>Notes</b><div style={{ whiteSpace: 'pre-line' }}>{p.notes}</div></td>}
                  {p.terms && <td><b>Terms</b><div style={{ whiteSpace: 'pre-line' }}>{p.terms}</div></td>}
                </tr>
              </tbody>
            </table>
          )}
        </section>
      </div>
    </>
  );
}
