/**
 * InvoiceDocument — the printable A4 GST tax invoice.
 *
 * Renders one <section class="inv-page"> per statutory copy (ORIGINAL FOR
 * RECIPIENT / DUPLICATE FOR TRANSPORTER / TRIPLICATE FOR SUPPLIER), each on its
 * own sheet. Print CSS hides the app chrome so Ctrl+P / Save-as-PDF produces the
 * document alone.
 *
 * Everything is read from the invoice's OWN stored snapshot (inv.company,
 * inv.bank, inv.terms, …) rather than current company settings, so reprinting an
 * old invoice shows the business exactly as it was when the invoice was issued.
 */
import { useMemo } from 'react';
import { amountInWords } from './amountInWords';

const COPIES = ['ORIGINAL FOR RECIPIENT', 'DUPLICATE FOR TRANSPORTER', 'TRIPLICATE FOR SUPPLIER'];

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const money = (n) => '₹ ' + round2(n).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const plain = (n) => round2(n).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d);
  const p = (x) => String(x).padStart(2, '0');
  return `${p(dt.getDate())}/${p(dt.getMonth() + 1)}/${dt.getFullYear()}`;
}

// Public UPI intent string — most Indian payment apps can scan this directly.
// Rendered through a QR image service only when a UPI ID is configured.
function upiQrUrl(inv) {
  const upi = inv?.bank?.upiId;
  if (!upi) return null;
  const payee = inv?.company?.name || inv?.bank?.holderName || '';
  const intent = `upi://pay?pa=${encodeURIComponent(upi)}&pn=${encodeURIComponent(payee)}&am=${round2(inv.total)}&cu=INR`;
  return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(intent)}`;
}

export default function InvoiceDocument({ invoice }) {
  const inv = invoice || {};
  const isCash = inv.type === 'cash';
  const items = Array.isArray(inv.items) ? inv.items : [];

  // HSN-wise tax summary — derived here rather than stored, so it always agrees
  // with the line items even for invoices saved before this view existed.
  const hsnRows = useMemo(() => {
    const rate = Number(inv.gstRate) || 0;
    const half = round2(rate / 2);
    const map = new Map();
    items.forEach((it) => {
      const key = it.hsn || '—';
      const cur = map.get(key) || { hsn: key, taxable: 0 };
      cur.taxable = round2(cur.taxable + (Number(it.amount) || 0));
      map.set(key, cur);
    });
    return [...map.values()].map((r) => {
      if (inv.interState) {
        const igst = round2((r.taxable * rate) / 100);
        return { ...r, igstRate: rate, igst, totalTax: igst };
      }
      const cgst = round2((r.taxable * half) / 100);
      return { ...r, cgstRate: half, cgst, sgstRate: half, sgst: cgst, totalTax: round2(cgst * 2) };
    });
  }, [items, inv.gstRate, inv.interState]);

  const hsnTotals = hsnRows.reduce((a, r) => ({
    taxable: round2(a.taxable + r.taxable),
    cgst: round2(a.cgst + (r.cgst || 0)),
    sgst: round2(a.sgst + (r.sgst || 0)),
    igst: round2(a.igst + (r.igst || 0)),
    totalTax: round2(a.totalTax + r.totalTax),
  }), { taxable: 0, cgst: 0, sgst: 0, igst: 0, totalTax: 0 });

  const qtyTotal = items.reduce((s, it) => s + (Number(it.qty) || 0), 0);
  const halfRate = round2((Number(inv.gstRate) || 0) / 2);
  const qr = upiQrUrl(inv);
  const co = inv.company || {};
  const bank = inv.bank || {};

  const title = inv.type === 'proforma' ? 'PROFORMA INVOICE' : isCash ? 'BILL OF SUPPLY' : 'TAX INVOICE';
  // A cash / non-GST bill has no statutory copy set — print it once.
  const copies = isCash ? [null] : COPIES;

  return (
    <>
      <style>{`
        .inv-doc { background: #eef1ee; padding: 16px 0; }
        .inv-page {
          width: 210mm; min-height: 297mm; margin: 0 auto 16px; padding: 10mm;
          background: #fff; color: #111; box-sizing: border-box;
          font-family: Arial, Helvetica, sans-serif; font-size: 10px; line-height: 1.35;
          box-shadow: 0 2px 10px rgba(0,0,0,.15);
        }
        .inv-page * { box-sizing: border-box; }
        .inv-b { border: 1px solid #111; }
        .inv-t { width: 100%; border-collapse: collapse; }
        .inv-t th, .inv-t td { border: 1px solid #111; padding: 4px 6px; vertical-align: top; }
        .inv-t th { background: #e8f0e4; font-size: 9.5px; text-align: center; font-weight: 700; }
        .inv-r { text-align: right; }
        .inv-c { text-align: center; }
        .inv-muted { color: #555; }
        .inv-title { font-size: 13px; font-weight: 700; letter-spacing: .3px; }
        .inv-copy {
          font-size: 8.5px; border: 1px solid #999; color: #444;
          padding: 2px 8px; border-radius: 3px; text-transform: uppercase; letter-spacing: .4px;
        }
        .inv-co-name { color: #2e7d32; font-size: 15px; font-weight: 700; line-height: 1.15; }
        .inv-sec-h { background: #e8f0e4; font-weight: 700; padding: 3px 6px; border: 1px solid #111; border-bottom: none; }
        @media print {
          .inv-doc { background: #fff; padding: 0; }
          .inv-page { width: auto; min-height: auto; margin: 0; box-shadow: none; padding: 8mm; }
          .inv-page + .inv-page { page-break-before: always; }
          .no-print { display: none !important; }
          @page { size: A4; margin: 0; }
        }
      `}</style>

      <div className="inv-doc">
        {copies.map((copy, ci) => (
          <section className="inv-page" key={ci}>
            {/* Title + copy designation */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span className="inv-title">{title}</span>
              {copy && <span className="inv-copy">{copy}</span>}
            </div>

            {/* Seller header + invoice meta */}
            <table className="inv-t">
              <tbody>
                <tr>
                  <td style={{ width: '58%' }}>
                    <div style={{ display: 'flex', gap: 10 }}>
                      {co.logo && <img src={co.logo} alt="" style={{ height: 46, maxWidth: 90, objectFit: 'contain' }} />}
                      <div>
                        <div className="inv-co-name">{co.name || '—'}</div>
                        {co.address && <div style={{ marginTop: 3 }}>{co.address}</div>}
                        <div style={{ marginTop: 3 }}>
                          {co.gstNo && <><b>GSTIN:</b> {co.gstNo}&nbsp;&nbsp;</>}
                          {co.phone && <><b>Mobile:</b> {co.phone}</>}
                        </div>
                        {co.pan && <div><b>PAN Number:</b> {co.pan}</div>}
                        {co.email && <div><b>Email:</b> {co.email}</div>}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: 0 }}>
                    <table className="inv-t" style={{ border: 'none' }}>
                      <tbody>
                        <tr>
                          <th>Invoice No.</th><th>Invoice Date</th><th>Due Date</th>
                        </tr>
                        <tr className="inv-c">
                          <td>{inv.invoiceNo || '—'}</td>
                          <td>{fmtDate(inv.date)}</td>
                          <td>{fmtDate(inv.dueDate)}</td>
                        </tr>
                        <tr>
                          <th>Approved By</th><th>Event Type</th><th>Sales Person</th>
                        </tr>
                        <tr className="inv-c">
                          <td>{inv.approvedBy || '—'}</td>
                          <td>{inv.eventType || '—'}</td>
                          <td>{inv.salesPerson || '—'}</td>
                        </tr>
                        <tr><th colSpan={3} style={{ textAlign: 'left' }}>Delivery Type</th></tr>
                        <tr><td colSpan={3}>{inv.deliveryType || '—'}</td></tr>
                      </tbody>
                    </table>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Bill To / Ship To */}
            <table className="inv-t" style={{ marginTop: 6 }}>
              <tbody>
                <tr>
                  <th style={{ width: '50%', textAlign: 'left' }}>BILL TO</th>
                  <th style={{ textAlign: 'left' }}>SHIP TO</th>
                </tr>
                <tr>
                  <td>
                    <div style={{ fontWeight: 700 }}>{inv.clientName || '—'}</div>
                    {inv.clientAddress && <div><b>Address:</b> {inv.clientAddress}</div>}
                    <div>
                      {inv.clientGstNo && <><b>GSTIN:</b> {inv.clientGstNo}&nbsp;&nbsp;</>}
                      {inv.placeOfSupply && <><b>Place of Supply:</b> {inv.placeOfSupply}</>}
                    </div>
                    <div>
                      {inv.clientPhone && <><b>Mobile:</b> {inv.clientPhone}&nbsp;&nbsp;</>}
                      {inv.clientPan && <><b>PAN Number:</b> {inv.clientPan}</>}
                    </div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 700 }}>{inv.shipToName || inv.clientName || '—'}</div>
                    {(inv.shipToAddress || inv.clientAddress) && <div>{inv.shipToAddress || inv.clientAddress}</div>}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Line items */}
            <table className="inv-t" style={{ marginTop: 6 }}>
              <thead>
                <tr>
                  <th style={{ width: 38 }}>S.NO.</th>
                  <th style={{ textAlign: 'left' }}>ITEMS</th>
                  <th style={{ width: 72 }}>HSN</th>
                  <th style={{ width: 60 }}>QTY.</th>
                  <th style={{ width: 60 }}>RATE</th>
                  <th style={{ width: 78 }}>AMOUNT</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={i}>
                    <td className="inv-c">{i + 1}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{it.name}</div>
                      {it.description && <div className="inv-muted" style={{ fontSize: 8.5 }}>{it.description}</div>}
                    </td>
                    <td className="inv-c">{it.hsn || '—'}</td>
                    <td className="inv-c">{plain(it.qty)}{it.unit ? ` ${it.unit}` : ''}</td>
                    <td className="inv-r">{plain(it.rate)}</td>
                    <td className="inv-r">{plain(it.amount)}</td>
                  </tr>
                ))}

                {!isCash && (inv.interState ? (
                  <tr>
                    <td colSpan={5} className="inv-r"><i>IGST@{inv.gstRate || 0}%</i></td>
                    <td className="inv-r">{money(inv.igst)}</td>
                  </tr>
                ) : (
                  <>
                    <tr>
                      <td colSpan={5} className="inv-r"><i>CGST@{halfRate}%</i></td>
                      <td className="inv-r">{money(inv.cgst)}</td>
                    </tr>
                    <tr>
                      <td colSpan={5} className="inv-r"><i>SGST@{halfRate}%</i></td>
                      <td className="inv-r">{money(inv.sgst)}</td>
                    </tr>
                  </>
                ))}

                {Number(inv.discount) > 0 && (
                  <tr>
                    <td colSpan={5} className="inv-r"><i>Discount</i></td>
                    <td className="inv-r">− {plain(inv.discount)}</td>
                  </tr>
                )}

                <tr style={{ background: '#e8f0e4', fontWeight: 700 }}>
                  <td colSpan={3} className="inv-r">TOTAL</td>
                  <td className="inv-c">{plain(qtyTotal)}</td>
                  <td />
                  <td className="inv-r">{money(inv.total)}</td>
                </tr>
              </tbody>
            </table>

            {/* HSN-wise tax summary — omitted on a non-GST bill. */}
            {!isCash && hsnRows.length > 0 && (
              <table className="inv-t" style={{ marginTop: 6 }}>
                <thead>
                  <tr>
                    <th rowSpan={2} style={{ width: 90 }}>HSN/SAC</th>
                    <th rowSpan={2} style={{ width: 90 }}>Taxable Value</th>
                    {inv.interState ? (
                      <th colSpan={2}>IGST</th>
                    ) : (
                      <>
                        <th colSpan={2}>CGST</th>
                        <th colSpan={2}>SGST</th>
                      </>
                    )}
                    <th rowSpan={2}>Total Tax Amount</th>
                  </tr>
                  <tr>
                    <th style={{ width: 50 }}>Rate</th>
                    <th style={{ width: 70 }}>Amount</th>
                    {!inv.interState && (<><th style={{ width: 50 }}>Rate</th><th style={{ width: 70 }}>Amount</th></>)}
                  </tr>
                </thead>
                <tbody>
                  {hsnRows.map((r, i) => (
                    <tr key={i} className="inv-c">
                      <td>{r.hsn}</td>
                      <td className="inv-r">{plain(r.taxable)}</td>
                      {inv.interState ? (
                        <><td>{r.igstRate}%</td><td className="inv-r">{plain(r.igst)}</td></>
                      ) : (
                        <>
                          <td>{r.cgstRate}%</td><td className="inv-r">{plain(r.cgst)}</td>
                          <td>{r.sgstRate}%</td><td className="inv-r">{plain(r.sgst)}</td>
                        </>
                      )}
                      <td className="inv-r">{money(r.totalTax)}</td>
                    </tr>
                  ))}
                  <tr style={{ fontWeight: 700 }} className="inv-c">
                    <td>Total</td>
                    <td className="inv-r">{plain(hsnTotals.taxable)}</td>
                    {inv.interState ? (
                      <><td /><td className="inv-r">{plain(hsnTotals.igst)}</td></>
                    ) : (
                      <>
                        <td /><td className="inv-r">{plain(hsnTotals.cgst)}</td>
                        <td /><td className="inv-r">{plain(hsnTotals.sgst)}</td>
                      </>
                    )}
                    <td className="inv-r">{money(hsnTotals.totalTax)}</td>
                  </tr>
                </tbody>
              </table>
            )}

            {/* Amount in words */}
            <div className="inv-b" style={{ marginTop: 6, padding: '4px 6px' }}>
              <b>Total Amount (in words)</b>
              <div>{amountInWords(inv.total)}</div>
            </div>

            {/* Bank details + payment QR */}
            <table className="inv-t" style={{ marginTop: 6 }}>
              <tbody>
                <tr>
                  <th style={{ width: '62%', textAlign: 'left' }}>Bank Details</th>
                  <th style={{ textAlign: 'left' }}>Payment QR Code</th>
                </tr>
                <tr>
                  <td>
                    <div><b>Name:</b> {bank.holderName || co.name || '—'}</div>
                    <div><b>IFSC Code:</b> {bank.ifsc || '—'}</div>
                    <div><b>Account No:</b> {bank.accountNumber || '—'}</div>
                    <div><b>Bank:</b> {bank.branch || '—'}</div>
                  </td>
                  <td className="inv-c">
                    {qr ? (
                      <>
                        <div style={{ textAlign: 'left' }}><b>UPI ID:</b> {bank.upiId}</div>
                        <img src={qr} alt="UPI QR" style={{ width: 96, height: 96, marginTop: 4 }} />
                      </>
                    ) : (
                      <span className="inv-muted">Set a UPI ID in Company Settings to show a payment QR.</span>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Terms + signatory */}
            <table className="inv-t" style={{ marginTop: 6 }}>
              <tbody>
                <tr>
                  <th style={{ width: '62%', textAlign: 'left' }}>Terms and Conditions</th>
                  <th style={{ textAlign: 'left' }}>&nbsp;</th>
                </tr>
                <tr>
                  <td style={{ whiteSpace: 'pre-line', fontSize: 8.5 }}>{inv.terms || '—'}</td>
                  <td className="inv-c" style={{ verticalAlign: 'bottom' }}>
                    {inv.signatureImage && (
                      <img src={inv.signatureImage} alt="" style={{ height: 54, maxWidth: 150, objectFit: 'contain' }} />
                    )}
                    <div style={{ marginTop: 4 }}>Authorised Signatory For</div>
                    <div><b>{inv.authorizedSignatory || co.name || '—'}</b></div>
                  </td>
                </tr>
              </tbody>
            </table>

            {inv.notes && (
              <div className="inv-b" style={{ marginTop: 6, padding: '4px 6px' }}>
                <b>Notes</b>
                <div style={{ whiteSpace: 'pre-line' }}>{inv.notes}</div>
              </div>
            )}
          </section>
        ))}
      </div>
    </>
  );
}
