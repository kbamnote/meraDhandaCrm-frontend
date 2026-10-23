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
import { stateFromGstin, stateCodeFromGstin, codeForState } from '../../utils/gstState';

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
  // A cancelled invoice still prints (it is part of the series) but must not
  // be mistakable for a live bill.
  const cancelled = inv.status === 'void' || inv.voided === true;
  const items = Array.isArray(inv.items) ? inv.items : [];
  // Charges are printed in two places: the ones GST was charged on belong above
  // the tax rows (they are part of what was taxed), the rest below them. One
  // list printed in one place would make the bill fail to add up for a reader
  // checking the tax against the rate.
  const allCharges = Array.isArray(inv.additionalCharges) ? inv.additionalCharges : [];
  const taxedCharges = allCharges.filter((ch) => (Number(ch.taxRate) || 0) > 0);
  const plainCharges = allCharges.filter((ch) => !((Number(ch.taxRate) || 0) > 0));

  // What a line is taxed at. An invoice billed at one rate carries it at the
  // top (`gstRate`) and its lines have none; a bill that mixes rates carries
  // the rate on each line. Reading the line first keeps both kinds correct.
  const lineRate = (it) => (
    it && it.taxRate != null && it.taxRate !== '' ? Number(it.taxRate) || 0 : Number(inv.gstRate) || 0
  );
  // True when the lines do not all share one rate — the tax rows can then no
  // longer be labelled with a single percentage.
  // A charge taxed at a rate of its own counts here too: freight at 5% beside
  // goods at 18% leaves the tax rows with no single percentage to carry.
  const mixedRates = useMemo(
    () => new Set([
      ...items.filter((it) => (Number(it.amount) || 0) > 0).map(lineRate),
      ...taxedCharges.map((ch) => Number(ch.taxRate) || 0),
    ]).size > 1,
    [items, inv.gstRate, inv.additionalCharges]
  );

  // HSN-wise tax summary — derived here rather than stored, so it always agrees
  // with the line items even for invoices saved before this view existed.
  // Grouped by HSN *and rate*: the same HSN billed at two rates is two rows on
  // GSTR-1, and merging them would misstate the tax.
  const hsnRows = useMemo(() => {
    const map = new Map();
    items.forEach((it) => {
      const rate = lineRate(it);
      const hsn = it.hsn || '—';
      const key = `${hsn}|${rate}`;
      const cur = map.get(key) || { hsn, rate, taxable: 0 };
      // A discounted line is reported at its discounted value: GST is charged
      // on that, so the summary has to agree with the tax rows above it.
      // Older invoices carry no per-line `taxable` and were taxed on `amount`.
      cur.taxable = round2(cur.taxable + (Number(it.taxable != null ? it.taxable : it.amount) || 0));
      map.set(key, cur);
    });
    // A charge GST was charged on is part of the taxable value, so it belongs in
    // this summary too — left out, the table's tax would not add up to the tax
    // rows above it. It has no HSN of its own, so it groups with the other
    // unclassified value at its rate.
    taxedCharges.forEach((ch) => {
      const rate = Number(ch.taxRate) || 0;
      const key = `—|${rate}`;
      const cur = map.get(key) || { hsn: '—', rate, taxable: 0 };
      cur.taxable = round2(cur.taxable + (Number(ch.amount) || 0));
      map.set(key, cur);
    });
    return [...map.values()].map((r) => {
      if (inv.interState) {
        const igst = round2((r.taxable * r.rate) / 100);
        return { ...r, igstRate: r.rate, igst, totalTax: igst };
      }
      const half = round2(r.rate / 2);
      const cgst = round2((r.taxable * half) / 100);
      return { ...r, cgstRate: half, cgst, sgstRate: half, sgst: cgst, totalTax: round2(cgst * 2) };
    });
  }, [items, inv.gstRate, inv.interState, inv.additionalCharges]);

  const hsnTotals = hsnRows.reduce((a, r) => ({
    taxable: round2(a.taxable + r.taxable),
    cgst: round2(a.cgst + (r.cgst || 0)),
    sgst: round2(a.sgst + (r.sgst || 0)),
    igst: round2(a.igst + (r.igst || 0)),
    totalTax: round2(a.totalTax + r.totalTax),
  }), { taxable: 0, cgst: 0, sgst: 0, igst: 0, totalTax: 0 });

  // A bill discount prints where it was applied: above the tax rows when it
  // reduced the taxable value, below them when the tax was charged first.
  // Invoices issued before the choice existed carry no mode; their numbers say
  // which it was.
  // A taxed charge is inside taxableValue, so it has to come back off before
  // that comparison means anything.
  const taxedChargeValue = round2(taxedCharges.reduce((s, ch) => s + (Number(ch.amount) || 0), 0));
  const discountBeforeTax = inv.discountMode
    ? inv.discountMode === 'before'
    : (inv.taxableValue != null
      && round2((Number(inv.taxableValue) || 0) - taxedChargeValue)
        < round2((Number(inv.subtotal) || 0) - (Number(inv.itemDiscount) || 0)));

  const qtyTotal = items.reduce((s, it) => s + (Number(it.qty) || 0), 0);
  // Per-product discounts get their own column (only when any line has one),
  // and AMOUNT then shows each line after its discount. The Discount row below
  // is the bill-level part only; older invoices, from before per-line
  // discounts, have no billDiscount and their `discount` is all bill-level.
  const lineDisc = (it) => Number(it.itemDiscount) || 0;
  const hasLineDisc = items.some((it) => lineDisc(it) > 0);
  const billDiscount = inv.billDiscount != null ? Number(inv.billDiscount) || 0 : Number(inv.discount) || 0;
  const discLabel = (it) => (it.discountType === 'percent' && Number(it.discountValue) > 0
    ? `${plain(it.discountValue)}%`
    : plain(lineDisc(it)));
  // Columns the tax/discount/total labels span: one wider for each of the GST
  // and DISC columns.
  const labelSpan = 5 + (mixedRates ? 1 : 0) + (hasLineDisc ? 1 : 0);
  const halfRate = round2((Number(inv.gstRate) || 0) / 2);
  const qr = upiQrUrl(inv);
  const co = inv.company || {};

  // The party's state and GST code. Read off their GSTIN where there is one
  // (it carries both, so they can never disagree), else fall back to the
  // Place of Supply chosen on the bill — an unregistered customer still has
  // a state.
  const partyState = stateFromGstin(inv.clientGstNo) || inv.placeOfSupply || '';
  const partyStateCode = stateCodeFromGstin(inv.clientGstNo) || codeForState(inv.placeOfSupply);
  const bank = inv.bank || {};

  // The server decides the legal title at issue time and snapshots it, so a
  // reprint keeps the title the document was issued under even if the company
  // later leaves (or joins) the composition scheme. Older invoices predate the
  // field, hence the fallback.
  const title = inv.docTitle
    || (inv.type === 'proforma' ? 'PROFORMA INVOICE' : isCash ? 'BILL OF SUPPLY' : 'TAX INVOICE');
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
        .inv-page { position: relative; }
        .inv-cancelled {
          position: absolute; top: 42%; left: 50%; transform: translate(-50%, -50%) rotate(-24deg);
          font-size: 72px; font-weight: 800; letter-spacing: 6px; color: rgba(220,38,38,.22);
          border: 6px solid rgba(220,38,38,.22); padding: 4px 24px; pointer-events: none;
        }
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
          /* Enclosures (PAN card, cancelled cheque) start their own sheet so
             they can be filed apart from the bill and stay legible. */
          .inv-page-break { page-break-before: always; break-before: page; }
          .no-print { display: none !important; }
          @page { size: A4; margin: 0; }
        }
      `}</style>

      <div className="inv-doc">
        {copies.map((copy, ci) => (
          <section className="inv-page" key={ci}>
            {cancelled && <div className="inv-cancelled" data-testid="inv-cancelled">CANCELLED</div>}
            {/* Title + copy designation */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span className="inv-title">{title}</span>
              {copy && <span className="inv-copy">{copy}</span>}
            </div>
            {/* Statutory declaration — a composition dealer must state that it
                cannot collect tax; a reverse-charge supply must say the recipient
                pays it. Both are required wording on the document itself. */}
            {inv.taxNote && (
              <div style={{ fontSize: 9.5, fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: .2 }}>
                {inv.taxNote}
              </div>
            )}

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
                        {(inv.ewayBillNo || inv.poNumber) && (
                          <>
                            <tr><th>E-Way Bill No.</th><th colSpan={2}>P.O. No.</th></tr>
                            <tr className="inv-c">
                              <td>{inv.ewayBillNo || '—'}</td>
                              <td colSpan={2}>{inv.poNumber || '—'}</td>
                            </tr>
                          </>
                        )}
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
                      {/* The state and its GST code, which a GST document is
                          expected to carry. Derived from the GSTIN when the
                          invoice did not store a Place of Supply of its own. */}
                      {partyState && <><b>State:</b> {partyState}&nbsp;&nbsp;</>}
                      {partyStateCode && <><b>Code:</b> {partyStateCode}</>}
                    </div>
                    <div>
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
                    {/* Same identity details on the consignee side — a shipment
                        to a different state is what decides IGST, so the state
                        has to be readable here too. */}
                    <div>
                      {inv.clientGstNo && <><b>GSTIN:</b> {inv.clientGstNo}&nbsp;&nbsp;</>}
                      {partyState && <><b>State:</b> {partyState}&nbsp;&nbsp;</>}
                      {partyStateCode && <><b>Code:</b> {partyStateCode}</>}
                    </div>
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
                  {hasLineDisc && <th style={{ width: 56 }}>DISC.</th>}
                  {mixedRates && <th style={{ width: 44 }}>GST</th>}
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
                      {/* This line's own extra fields — Transport, Installation,
                          a site or reference. They sit in the ITEMS column, so
                          they read before HSN without widening the table. */}
                      {Array.isArray(it.extras) && it.extras.length > 0 && (
                        <div style={{ fontSize: 8.5, marginTop: 1 }}>
                          {it.extras.map((e, k) => (
                            <div key={k}>
                              {e.label ? <b>{e.label}:</b> : null} {e.value}
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="inv-c">{it.hsn || '—'}</td>
                    <td className="inv-c">{plain(it.qty)}{it.unit ? ` ${it.unit}` : ''}</td>
                    <td className="inv-r">{plain(it.rate)}</td>
                    {hasLineDisc && <td className="inv-c">{lineDisc(it) > 0 ? discLabel(it) : '—'}</td>}
                    {mixedRates && <td className="inv-c">{lineRate(it)}%</td>}
                    <td className="inv-r">{plain(round2((Number(it.amount) || 0) - lineDisc(it)))}</td>
                  </tr>
                ))}

                {discountBeforeTax && billDiscount > 0 && (
                  <tr>
                    <td colSpan={labelSpan} className="inv-r"><i>Discount</i></td>
                    <td className="inv-r">− {plain(billDiscount)}</td>
                  </tr>
                )}

                {/* A charge GST was charged on has to be printed ABOVE the tax
                    rows: it is part of the value taxed, and a reader checking
                    the bill must be able to see what the tax was charged on. */}
                {taxedCharges.map((ch, i) => (
                  <tr key={`tch${i}`}>
                    <td colSpan={labelSpan} className="inv-r">
                      <i>{ch.label || 'Charge'}{mixedRates ? '' : ` (GST @${ch.taxRate}%)`}</i>
                    </td>
                    <td className="inv-r">{plain(ch.amount)}</td>
                  </tr>
                ))}

                {!isCash && (inv.interState ? (
                  <tr>
                    <td colSpan={labelSpan} className="inv-r"><i>IGST{mixedRates ? '' : `@${inv.gstRate || 0}%`}</i></td>
                    <td className="inv-r">{money(inv.igst)}</td>
                  </tr>
                ) : (
                  <>
                    <tr>
                      <td colSpan={labelSpan} className="inv-r"><i>CGST{mixedRates ? '' : `@${halfRate}%`}</i></td>
                      <td className="inv-r">{money(inv.cgst)}</td>
                    </tr>
                    <tr>
                      <td colSpan={labelSpan} className="inv-r"><i>SGST{mixedRates ? '' : `@${halfRate}%`}</i></td>
                      <td className="inv-r">{money(inv.sgst)}</td>
                    </tr>
                  </>
                ))}

                {!discountBeforeTax && billDiscount > 0 && (
                  <tr>
                    <td colSpan={labelSpan} className="inv-r"><i>Discount</i></td>
                    <td className="inv-r">− {plain(billDiscount)}</td>
                  </tr>
                )}

                {/* Freight, packing and the like that carry no GST — billed
                    after tax, printed where they were added so the total adds
                    up on inspection. */}
                {plainCharges.map((ch, i) => (
                  <tr key={`ch${i}`}>
                    <td colSpan={labelSpan} className="inv-r"><i>{ch.label || 'Charge'}</i></td>
                    <td className="inv-r">{plain(ch.amount)}</td>
                  </tr>
                ))}

                {/* Without this line the invoice doesn't add up: TOTAL is the
                    rounded figure, while the taxable value and tax above sum to
                    the exact one. Shown with its sign so the reader can check it. */}
                {Number(inv.roundOff) !== 0 && inv.roundOff != null && (
                  <tr>
                    <td colSpan={labelSpan} className="inv-r"><i>Round Off</i></td>
                    <td className="inv-r">
                      {Number(inv.roundOff) > 0 ? '+ ' : '− '}{plain(Math.abs(Number(inv.roundOff)))}
                    </td>
                  </tr>
                )}

                <tr style={{ background: '#e8f0e4', fontWeight: 700 }}>
                  <td colSpan={3} className="inv-r">TOTAL</td>
                  <td className="inv-c">{plain(qtyTotal)}</td>
                  <td />
                  {hasLineDisc && <td />}
                  {mixedRates && <td />}
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
                  {/* rowSpan, not an empty header above the signature: the
                      border between the two printed as a rule across the
                      signing space. Merged, it is one tall box to sign in. */}
                  <td rowSpan={2} className="inv-c" style={{ verticalAlign: 'bottom', paddingTop: 10 }}>
                    {inv.signatureImage && (
                      <img src={inv.signatureImage} alt="" style={{ height: 54, maxWidth: 150, objectFit: 'contain' }} />
                    )}
                    <div style={{ marginTop: 4 }}>Authorised Signatory For</div>
                    <div><b>{inv.authorizedSignatory || co.name || '—'}</b></div>
                  </td>
                </tr>
                <tr>
                  <td style={{ whiteSpace: 'pre-line', fontSize: 8.5 }}>{inv.terms || '—'}</td>
                </tr>
              </tbody>
            </table>

            {inv.notes && (
              <div className="inv-b" style={{ marginTop: 6, padding: '4px 6px' }}>
                <b>Notes</b>
                <div style={{ whiteSpace: 'pre-line' }}>{inv.notes}</div>
              </div>
            )}

            {/* PAN card / cancelled cheque, when this bill was asked to carry
                them. On their own page: a customer's accounts team files these
                separately from the bill, and shrinking them to fit beside the
                totals would make the numbers on them unreadable. */}
            {(inv.panCardImage || inv.cancelledChequeImage) && (
              <div className="inv-page-break" style={{ marginTop: 10 }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>
                  Enclosed with {inv.invoiceNo}
                </div>
                {inv.panCardImage && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 9, marginBottom: 2 }}><b>PAN Card</b></div>
                    <img src={inv.panCardImage} alt="PAN card"
                      style={{ maxWidth: '100%', maxHeight: 330, objectFit: 'contain', border: '1px solid #ddd' }} />
                  </div>
                )}
                {inv.cancelledChequeImage && (
                  <div>
                    <div style={{ fontSize: 9, marginBottom: 2 }}><b>Cancelled Cheque</b></div>
                    <img src={inv.cancelledChequeImage} alt="Cancelled cheque"
                      style={{ maxWidth: '100%', maxHeight: 330, objectFit: 'contain', border: '1px solid #ddd' }} />
                  </div>
                )}
              </div>
            )}
          </section>
        ))}
      </div>
    </>
  );
}
