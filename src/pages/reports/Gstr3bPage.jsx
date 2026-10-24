/**
 * GSTR-3B — the summary return, laid out in the portal's own table numbers so
 * the figures can be typed straight across: 3.1 outward supplies and reverse
 * charge, 3.2 inter-state supplies to unregistered persons, 4 input credit.
 *
 * The boxes this build cannot source (zero-rated, nil-rated, non-GST) print as
 * zero rather than being hidden. A missing row reads as "not applicable"; a
 * zero row reads as "nothing to declare", which is what it is — and it is the
 * filer's job to notice if that is wrong.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { accountingApi } from '../../services/api';
import { showToast } from '../../components/common/toast';
import ReportShell, { usePeriod } from '../../components/common/ReportShell';

const money = (n) => (Math.round((Number(n) || 0) * 100) / 100)
  .toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const ZERO = { taxable: 0, igst: 0, cgst: 0, sgst: 0, cess: 0 };

/** The rows of table 3.1, in the order the portal prints them. */
const OUTWARD_ROWS = [
  ['(a) Outward taxable supplies (other than zero rated, nil rated and exempted)', 'outward'],
  ['(b) Outward taxable supplies (zero rated)', 'zeroRated'],
  ['(c) Other outward supplies (nil rated, exempted)', 'nilRated'],
  ['(d) Inward supplies (liable to reverse charge)', 'reverseCharge'],
  ['(e) Non-GST outward supplies', 'nonGst'],
];

function TaxTable({ caption, rows, note }) {
  const total = rows.reduce((a, [, v]) => ({
    taxable: a.taxable + (v.taxable || 0), igst: a.igst + (v.igst || 0),
    cgst: a.cgst + (v.cgst || 0), sgst: a.sgst + (v.sgst || 0), cess: a.cess + (v.cess || 0),
  }), { taxable: 0, igst: 0, cgst: 0, sgst: 0, cess: 0 });

  return (
    <div className="card" style={{ padding: 0, marginBottom: 16, overflow: 'auto' }}>
      <div style={{ padding: '10px 14px', fontWeight: 600, fontSize: 13.5, borderBottom: '1px solid var(--border)' }}>
        {caption}
        {note && <div style={{ fontWeight: 400, fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{note}</div>}
      </div>
      <table className="crm-table" style={{ fontSize: 12.5 }}>
        <thead>
          <tr>
            <th style={{ minWidth: 300 }}>Nature of Supplies</th>
            <th style={{ textAlign: 'right' }}>Total Taxable Value</th>
            <th style={{ textAlign: 'right' }}>Integrated Tax</th>
            <th style={{ textAlign: 'right' }}>Central Tax</th>
            <th style={{ textAlign: 'right' }}>State / UT Tax</th>
            <th style={{ textAlign: 'right' }}>Cess</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, v]) => (
            <tr key={label} data-testid="gstr3b-row">
              <td>{label}</td>
              <td style={{ textAlign: 'right' }}>{money(v.taxable)}</td>
              <td style={{ textAlign: 'right' }}>{money(v.igst)}</td>
              <td style={{ textAlign: 'right' }}>{money(v.cgst)}</td>
              <td style={{ textAlign: 'right' }}>{money(v.sgst)}</td>
              <td style={{ textAlign: 'right' }}>{money(v.cess)}</td>
            </tr>
          ))}
          <tr style={{ fontWeight: 700, borderTop: '2px solid var(--border)' }}>
            <td>Total</td>
            <td style={{ textAlign: 'right' }}>{money(total.taxable)}</td>
            <td style={{ textAlign: 'right' }}>{money(total.igst)}</td>
            <td style={{ textAlign: 'right' }}>{money(total.cgst)}</td>
            <td style={{ textAlign: 'right' }}>{money(total.sgst)}</td>
            <td style={{ textAlign: 'right' }}>{money(total.cess)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default function Gstr3bPage() {
  const period = usePeriod('lastMonth');   // 3B is filed for a completed month
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const { from, to } = period.range;

  const load = useCallback(async () => {
    if (!from || !to) return;
    setBusy(true);
    try { setData(await accountingApi.gstr3b({ from, to })); }
    catch (e) { showToast(e.response?.data?.error || 'Could not load the report', 'error'); }
    finally { setBusy(false); }
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  const d = data || {};
  const pos = d.interStateUnregistered || [];

  const outward = useMemo(
    () => OUTWARD_ROWS.map(([label, key]) => [label, d[key] || ZERO]),
    [data],  // eslint-disable-line react-hooks/exhaustive-deps
  );

  // One flat sheet covering all three tables, because a filer exports this to
  // check it line by line against the portal, not to re-create the layout.
  const grid = useMemo(() => {
    const out = [];
    for (const [label, v] of outward) {
      out.push(['3.1', label, v.taxable, v.igst, v.cgst, v.sgst, v.cess]);
    }
    for (const p of pos) {
      out.push(['3.2', `Unregistered — ${p.placeOfSupply}`, p.taxable, p.igst, 0, 0, 0]);
    }
    const itc = d.itc || ZERO;
    out.push(['4(A)(5)', 'All other ITC', itc.taxable, itc.igst, itc.cgst, itc.sgst, itc.cess]);
    return { headers: ['Table', 'Nature of Supplies', 'Taxable Value', 'IGST', 'CGST', 'SGST', 'Cess'], rows: out };
  }, [outward, pos, data]);  // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ReportShell reportKey="gstr3b" title="GSTR-3B" period={period} grid={grid} busy={busy}>
      {!data ? (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>
          {busy ? 'Loading…' : 'No data for this period.'}
        </div>
      ) : (
        <>
          <TaxTable
            caption="3.1 — Details of Outward Supplies and Inward Supplies Liable to Reverse Charge"
            rows={outward}
            note="Rows (b), (c) and (e) are zero because this system records no zero-rated, exempt or non-GST supplies. Declare them yourself if you have any."
          />

          <div className="card" style={{ padding: 0, marginBottom: 16, overflow: 'auto' }}>
            <div style={{ padding: '10px 14px', fontWeight: 600, fontSize: 13.5, borderBottom: '1px solid var(--border)' }}>
              3.2 — Of the supplies in 3.1(a), details of inter-state supplies to unregistered persons,
              composition taxable persons and UIN holders
            </div>
            {!pos.length ? (
              <div style={{ padding: 20, color: 'var(--text3)', fontSize: 12.5 }}>
                No inter-state supplies to unregistered persons in this period.
              </div>
            ) : (
              <table className="crm-table" style={{ fontSize: 12.5 }}>
                <thead>
                  <tr>
                    <th>Place of Supply (State / UT)</th>
                    <th style={{ textAlign: 'right' }}>Total Taxable Value</th>
                    <th style={{ textAlign: 'right' }}>Amount of Integrated Tax</th>
                  </tr>
                </thead>
                <tbody>
                  {pos.map((p) => (
                    <tr key={p.placeOfSupply} data-testid="gstr3b-pos-row">
                      <td>{p.placeOfSupply}</td>
                      <td style={{ textAlign: 'right' }}>{money(p.taxable)}</td>
                      <td style={{ textAlign: 'right' }}>{money(p.igst)}</td>
                    </tr>
                  ))}
                  <tr style={{ fontWeight: 700, borderTop: '2px solid var(--border)' }}>
                    <td>Total</td>
                    <td style={{ textAlign: 'right' }}>{money(pos.reduce((a, p) => a + p.taxable, 0))}</td>
                    <td style={{ textAlign: 'right' }}>{money(pos.reduce((a, p) => a + p.igst, 0))}</td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>

          <TaxTable
            caption="4 — Eligible ITC"
            rows={[['(A)(5) All other ITC', d.itc || ZERO]]}
            note="The tax on purchase bills recorded for this period. Reversals (4B) and ineligible credit (4D) are not tracked, so review them before filing."
          />

          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 20 }}>
            Computed from the invoices and purchase bills dated between{' '}
            {(d.from || '').split('-').reverse().join('-')} and {(d.to || '').split('-').reverse().join('-')}.
            This is a working sheet, not a filed return.
          </div>
        </>
      )}
    </ReportShell>
  );
}
