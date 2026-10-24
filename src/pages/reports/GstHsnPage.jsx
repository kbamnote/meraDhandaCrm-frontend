/**
 * GST Sales / Purchase — With HSN.
 *
 * The line-level register behind the returns: every billed line with its HSN,
 * rate and tax split. One component serves both sides because the row is the
 * same shape either way — only the documents it reads differ — so the two
 * screens cannot drift apart in formatting or in what they total.
 *
 * Below the register sits the HSN summary, grouped by HSN *and* rate. Grouping
 * by HSN alone would merge two rates under one code and the summary would no
 * longer reconcile with the table above it.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { accountingApi } from '../../services/api';
import { showToast } from '../../components/common/toast';
import ReportShell, { usePeriod } from '../../components/common/ReportShell';

const money = (n) => (Math.round((Number(n) || 0) * 100) / 100)
  .toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pretty = (iso) => (iso ? iso.split('-').reverse().join('-') : '—');
const R2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// The route table renders components with no props, so each side gets a name.
export const GstSalesHsnPage = () => <GstHsnPage side="sales" />;
export const GstPurchaseHsnPage = () => <GstHsnPage side="purchase" />;

export default function GstHsnPage({ side = 'sales' }) {
  const period = usePeriod('month');
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState('detail');    // detail | summary
  const [q, setQ] = useState('');
  const { from, to } = period.range;
  const purchase = side === 'purchase';

  const load = useCallback(async () => {
    if (!from || !to) return;
    setBusy(true);
    try { setData(await accountingApi.gstHsn({ side, from, to })); }
    catch (e) { showToast(e.response?.data?.error || 'Could not load the report', 'error'); }
    finally { setBusy(false); }
  }, [side, from, to]);

  useEffect(() => { load(); }, [load]);

  // Search covers party, item and HSN — the three things people look a row up by.
  const rows = useMemo(() => {
    const all = (data && data.rows) || [];
    const needle = q.trim().toLowerCase();
    if (!needle) return all;
    return all.filter((r) => [r.partyName, r.itemName, r.hsn, r.invoiceNo]
      .some((v) => String(v || '').toLowerCase().includes(needle)));
  }, [data, q]);

  // Grouped by HSN *and* rate: one code billed at two rates is two summary rows.
  const summary = useMemo(() => {
    const byKey = new Map();
    for (const r of rows) {
      const key = `${r.hsn || '—'}|${r.taxRate}`;
      const cur = byKey.get(key)
        || { hsn: r.hsn || '—', taxRate: r.taxRate, qty: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0, amount: 0 };
      cur.qty = R2(cur.qty + r.qty);
      cur.taxable = R2(cur.taxable + r.taxable);
      cur.cgst = R2(cur.cgst + r.cgst);
      cur.sgst = R2(cur.sgst + r.sgst);
      cur.igst = R2(cur.igst + r.igst);
      cur.amount = R2(cur.amount + r.amount);
      byKey.set(key, cur);
    }
    return [...byKey.values()].sort((a, b) => String(a.hsn).localeCompare(String(b.hsn)) || a.taxRate - b.taxRate);
  }, [rows]);

  // Totals follow the FILTERED rows, so a searched view totals what it shows.
  const totals = useMemo(() => rows.reduce((a, r) => ({
    taxable: R2(a.taxable + r.taxable), cgst: R2(a.cgst + r.cgst),
    sgst: R2(a.sgst + r.sgst), igst: R2(a.igst + r.igst), amount: R2(a.amount + r.amount),
  }), { taxable: 0, cgst: 0, sgst: 0, igst: 0, amount: 0 }), [rows]);

  const grid = useMemo(() => (view === 'summary' ? {
    headers: ['HSN', 'Tax %', 'Qty', 'Taxable Value', 'CGST', 'SGST', 'IGST', 'Total'],
    rows: summary.map((s) => [s.hsn, `${s.taxRate}%`, s.qty, s.taxable, s.cgst, s.sgst, s.igst, s.amount]),
  } : {
    headers: ['Date', purchase ? 'Bill No' : 'Invoice No', 'GSTIN', 'Party', 'Item', 'HSN',
      'Qty', 'Unit', 'Rate', 'Tax %', 'Taxable Value', 'CGST', 'SGST', 'IGST', 'Total'],
    rows: rows.map((r) => [r.date, r.invoiceNo || '', r.gstin || '', r.partyName, r.itemName,
      r.hsn || '', r.qty, r.unit || '', r.rate, `${r.taxRate}%`, r.taxable, r.cgst, r.sgst, r.igst, r.amount]),
  }), [view, rows, summary, purchase]);

  const noHsn = rows.filter((r) => !r.hsn).length;

  return (
    <ReportShell
      reportKey={purchase ? 'gst-purchase-hsn' : 'gst-sales-hsn'}
      title={`GST ${purchase ? 'Purchase' : 'Sales'} (With HSN)`}
      period={period} grid={grid} busy={busy}
      extraControls={(
        <>
          <div className="flex" style={{ gap: 4 }}>
            {[['detail', 'Line Detail'], ['summary', 'HSN Summary']].map(([k, label]) => (
              <button key={k} type="button" data-testid="hsn-view"
                className={`btn btn-sm ${view === k ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setView(k)}>{label}</button>
            ))}
          </div>
          <input className="input" style={{ width: 200 }} placeholder="Party, item or HSN…"
            value={q} onChange={(e) => setQ(e.target.value)} />
        </>
      )}
    >
      {/* An HSN-less line is a filing problem, not a display problem, so say so. */}
      {noHsn > 0 && (
        <div className="card" style={{ padding: '8px 12px', marginBottom: 10, fontSize: 12.5, color: 'var(--amber)' }}>
          {noHsn} line{noHsn > 1 ? 's' : ''} in this period have no HSN code. Add the HSN
          on the product so the return does not reject it.
        </div>
      )}

      {!rows.length ? (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>
          {(data && data.rows.length) ? 'No rows match that search.' : `No ${purchase ? 'purchase bills' : 'invoices'} in this period.`}
        </div>
      ) : view === 'summary' ? (
        <div className="card" style={{ padding: 0, overflow: 'auto' }}>
          <table className="crm-table" style={{ fontSize: 12.5 }}>
            <thead>
              <tr>
                <th>HSN / SAC</th><th>Tax %</th><th style={{ textAlign: 'right' }}>Qty</th>
                <th style={{ textAlign: 'right' }}>Taxable Value</th>
                <th style={{ textAlign: 'right' }}>CGST</th><th style={{ textAlign: 'right' }}>SGST</th>
                <th style={{ textAlign: 'right' }}>IGST</th><th style={{ textAlign: 'right' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((s) => (
                <tr key={`${s.hsn}-${s.taxRate}`} data-testid="hsn-summary-row">
                  <td style={{ fontFamily: 'monospace' }}>{s.hsn}</td>
                  <td>{s.taxRate}%</td>
                  <td style={{ textAlign: 'right' }}>{s.qty}</td>
                  <td style={{ textAlign: 'right' }}>{money(s.taxable)}</td>
                  <td style={{ textAlign: 'right' }}>{s.cgst ? money(s.cgst) : '—'}</td>
                  <td style={{ textAlign: 'right' }}>{s.sgst ? money(s.sgst) : '—'}</td>
                  <td style={{ textAlign: 'right' }}>{s.igst ? money(s.igst) : '—'}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{money(s.amount)}</td>
                </tr>
              ))}
              <tr style={{ fontWeight: 700, borderTop: '2px solid var(--border)' }}>
                <td colSpan={3}>Total</td>
                <td style={{ textAlign: 'right' }}>{money(totals.taxable)}</td>
                <td style={{ textAlign: 'right' }}>{money(totals.cgst)}</td>
                <td style={{ textAlign: 'right' }}>{money(totals.sgst)}</td>
                <td style={{ textAlign: 'right' }}>{money(totals.igst)}</td>
                <td style={{ textAlign: 'right' }}>{money(totals.amount)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'auto' }}>
          <table className="crm-table" style={{ fontSize: 12.5 }}>
            <thead>
              <tr>
                <th>Date</th>
                <th>{purchase ? 'Bill No' : 'Invoice No'}</th>
                <th>GSTIN</th><th>Party Name</th><th>Item</th><th>HSN</th>
                <th style={{ textAlign: 'right' }}>Qty</th><th>Unit</th>
                <th style={{ textAlign: 'right' }}>Rate</th><th>Tax %</th>
                <th style={{ textAlign: 'right' }}>Taxable Value</th>
                <th style={{ textAlign: 'right' }}>CGST</th><th style={{ textAlign: 'right' }}>SGST</th>
                <th style={{ textAlign: 'right' }}>IGST</th><th style={{ textAlign: 'right' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={`${r.invoiceNo}-${r.hsn}-${i}`} data-testid="hsn-row">
                  <td style={{ whiteSpace: 'nowrap' }}>{pretty(r.date)}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 11.5 }}>
                    <div>{r.invoiceNo || '—'}</div>
                    {r.originalNo && <div style={{ color: 'var(--text3)' }}>{r.originalNo}</div>}
                  </td>
                  <td style={{ fontFamily: 'monospace', fontSize: 11.5 }}>{r.gstin || '—'}</td>
                  <td>{r.partyName}</td>
                  <td>{r.itemName}</td>
                  <td style={{ fontFamily: 'monospace' }}>
                    {r.hsn || <span style={{ color: 'var(--amber)' }}>missing</span>}
                  </td>
                  <td style={{ textAlign: 'right' }}>{r.qty}</td>
                  <td>{r.unit || '—'}</td>
                  <td style={{ textAlign: 'right' }}>{money(r.rate)}</td>
                  <td>{r.taxRate}%</td>
                  <td style={{ textAlign: 'right' }}>{money(r.taxable)}</td>
                  <td style={{ textAlign: 'right' }}>{r.cgst ? money(r.cgst) : '—'}</td>
                  <td style={{ textAlign: 'right' }}>{r.sgst ? money(r.sgst) : '—'}</td>
                  <td style={{ textAlign: 'right' }}>{r.igst ? money(r.igst) : '—'}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{money(r.amount)}</td>
                </tr>
              ))}
              <tr style={{ fontWeight: 700, borderTop: '2px solid var(--border)' }}>
                <td colSpan={10}>Total ({rows.length} line{rows.length > 1 ? 's' : ''})</td>
                <td style={{ textAlign: 'right' }}>{money(totals.taxable)}</td>
                <td style={{ textAlign: 'right' }}>{money(totals.cgst)}</td>
                <td style={{ textAlign: 'right' }}>{money(totals.sgst)}</td>
                <td style={{ textAlign: 'right' }}>{money(totals.igst)}</td>
                <td style={{ textAlign: 'right' }}>{money(totals.amount)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </ReportShell>
  );
}
