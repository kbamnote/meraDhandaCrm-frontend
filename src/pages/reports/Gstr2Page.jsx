/**
 * GSTR-2 (Purchase) — every supplier bill for the period, with its tax broken
 * down by rate inside the row.
 *
 * A bill billed at two rates is ONE invoice with two tax lines, not two
 * invoices: that is how the portal shows it and how it reconciles. So the
 * party, number and value cells span the rate rows beneath them.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { accountingApi } from '../../services/api';
import { showToast } from '../../components/common/toast';
import ReportShell, { usePeriod } from '../../components/common/ReportShell';

const money = (n) => '₹' + (Math.round((Number(n) || 0) * 100) / 100).toLocaleString('en-IN');
const pretty = (iso) => (iso ? iso.split('-').reverse().join('-') : '—');

export default function Gstr2Page() {
  const period = usePeriod('month');
  const [tab, setTab] = useState('purchase');   // purchase | returns
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const { from, to } = period.range;

  const load = useCallback(async () => {
    if (!from || !to) return;
    setBusy(true);
    try { setData(await accountingApi.gstr2({ from, to })); }
    catch (e) { showToast(e.response?.data?.error || 'Could not load the report', 'error'); }
    finally { setBusy(false); }
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  const rows = (data && data.rows) || [];

  // What the export writes: one spreadsheet line per TAX line, because a
  // merged cell cannot be summed and this is a file people pivot.
  const grid = useMemo(() => ({
    headers: ['GSTIN', 'Party', 'State Code', 'State', 'Invoice No', 'Original No', 'Date',
      'Invoice Value', 'Tax %', 'Taxable Value', 'SGST', 'CGST', 'IGST', 'Total Tax'],
    rows: rows.flatMap((r) => (r.taxLines.length ? r.taxLines : [{ rate: 0, taxable: 0, sgst: 0, cgst: 0, igst: 0, total: 0 }])
      .map((t) => [
        r.gstin || '', r.partyName, r.stateCode || '', r.stateName || '',
        r.invoiceNo || '', r.originalNo || '', r.date,
        r.value, `${t.rate}%`, t.taxable, t.sgst, t.cgst, t.igst, t.total,
      ])),
  }), [rows]);

  return (
    <ReportShell
      reportKey="gstr2" title="GSTR-2 (Purchase)" period={period} grid={grid} busy={busy}
      extraControls={(
        <div className="flex" style={{ gap: 4 }}>
          {[['purchase', 'Purchase'], ['returns', 'Purchase Return']].map(([k, label]) => (
            <button key={k} type="button" data-testid="gstr2-tab"
              className={`btn btn-sm ${tab === k ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setTab(k)}>{label}</button>
          ))}
        </div>
      )}
    >
      {tab === 'returns' ? (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>
          Purchase returns are recorded as debit notes. This tab will read them once
          they carry the supplier&rsquo;s original invoice number.
        </div>
      ) : !rows.length ? (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>
          No purchase bills in this period.
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'auto' }}>
          <table className="crm-table" style={{ fontSize: 12.5 }}>
            <thead>
              <tr>
                <th rowSpan={2}>GSTIN</th>
                <th rowSpan={2}>Party Name</th>
                <th colSpan={2} style={{ textAlign: 'center' }}>Place of Supply</th>
                <th colSpan={3} style={{ textAlign: 'center' }}>Invoice Details</th>
                <th rowSpan={2}>Total Tax %</th>
                <th rowSpan={2}>Taxable Value</th>
                <th colSpan={4} style={{ textAlign: 'center' }}>Amount of Tax</th>
              </tr>
              <tr>
                <th>State Code</th><th>State Name</th>
                <th>Invoice No / Original No</th><th>Invoice Date</th><th>Invoice Value</th>
                <th>SGST</th><th>CGST</th><th>IGST</th><th>Total Tax</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const span = Math.max(1, r.taxLines.length);
                return r.taxLines.length ? r.taxLines.map((t, i) => (
                  <tr key={`${r.id}-${i}`} data-testid="gstr2-row">
                    {/* Written once per BILL, spanning its rate rows. */}
                    {i === 0 && <td rowSpan={span} style={{ fontFamily: 'monospace', fontSize: 11.5 }}>{r.gstin || '—'}</td>}
                    {i === 0 && <td rowSpan={span}>{r.partyName}</td>}
                    {i === 0 && <td rowSpan={span} style={{ textAlign: 'center' }}>{r.stateCode || '—'}</td>}
                    {i === 0 && <td rowSpan={span}>{r.stateName || '—'}</td>}
                    {i === 0 && (
                      <td rowSpan={span} style={{ fontFamily: 'monospace', fontSize: 11.5 }}>
                        <div>{r.invoiceNo || '—'}</div>
                        {r.originalNo && <div style={{ color: 'var(--text3)' }}>{r.originalNo}</div>}
                      </td>
                    )}
                    {i === 0 && <td rowSpan={span} style={{ whiteSpace: 'nowrap' }}>{pretty(r.date)}</td>}
                    {i === 0 && <td rowSpan={span} style={{ textAlign: 'right' }}>{money(r.value)}</td>}
                    <td style={{ textAlign: 'right' }}>{t.rate}%</td>
                    <td style={{ textAlign: 'right' }}>{money(t.taxable)}</td>
                    <td style={{ textAlign: 'right' }}>{t.sgst ? money(t.sgst) : '—'}</td>
                    <td style={{ textAlign: 'right' }}>{t.cgst ? money(t.cgst) : '—'}</td>
                    <td style={{ textAlign: 'right' }}>{t.igst ? money(t.igst) : '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{money(t.total)}</td>
                  </tr>
                )) : (
                  <tr key={r.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: 11.5 }}>{r.gstin || '—'}</td>
                    <td>{r.partyName}</td><td>{r.stateCode || '—'}</td><td>{r.stateName || '—'}</td>
                    <td>{r.invoiceNo || '—'}</td><td>{pretty(r.date)}</td>
                    <td style={{ textAlign: 'right' }}>{money(r.value)}</td>
                    <td colSpan={6} style={{ color: 'var(--text3)' }}>No tax lines</td>
                  </tr>
                );
              })}
              <tr style={{ fontWeight: 700, borderTop: '2px solid var(--border)' }}>
                <td colSpan={6}>Total</td>
                <td style={{ textAlign: 'right' }}>{money(data.totals.value)}</td>
                <td />
                <td style={{ textAlign: 'right' }}>{money(data.totals.taxable)}</td>
                <td colSpan={3} />
                <td style={{ textAlign: 'right' }}>{money(data.totals.tax)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </ReportShell>
  );
}
