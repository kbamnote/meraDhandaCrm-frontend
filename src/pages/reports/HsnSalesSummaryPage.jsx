/**
 * HSN Wise Sales Summary — what was sold under each HSN code, one row per
 * HSN *and item*.
 *
 * Not the same cut as the HSN Summary on the GST Sales register: that one
 * groups by HSN and rate, which is what the return's HSN table wants. This one
 * keeps the item name, so two products sharing a code (an ID card and a student
 * ID card both sit under 3926) stay apart and you can see what the code is
 * actually covering. Both reconcile to the same totals.
 *
 * Built from the sales HSN register, so there is one definition of what a
 * billed line is worth and this page cannot disagree with the register.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { accountingApi } from '../../services/api';
import { showToast } from '../../components/common/toast';
import ReportShell, { usePeriod } from '../../components/common/ReportShell';

const money = (n) => '₹' + (Math.round((Number(n) || 0) * 100) / 100)
  .toLocaleString('en-IN', { maximumFractionDigits: 2 });
const qty = (n) => (Number(n) || 0).toLocaleString('en-IN');
const R2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

export default function HsnSalesSummaryPage() {
  const period = usePeriod('week');
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('hsn');   // hsn | value | qty
  const { from, to } = period.range;

  const load = useCallback(async () => {
    if (!from || !to) return;
    setBusy(true);
    try { setData(await accountingApi.gstHsn({ side: 'sales', from, to })); }
    catch (e) { showToast(e.response?.data?.error || 'Could not load the report', 'error'); }
    finally { setBusy(false); }
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => {
    const byKey = new Map();
    for (const l of ((data && data.rows) || [])) {
      // Group on the code AND the item. Grouping on the code alone would hide
      // which product a shared HSN is carrying, which is the whole question
      // this report answers.
      const hsn = l.hsn || '—';
      const name = l.itemName || '—';
      const key = `${hsn}|${name}`;
      const cur = byKey.get(key)
        || { hsn, name, qty: 0, value: 0, taxable: 0, igst: 0, cgst: 0, sgst: 0, tax: 0 };
      cur.qty = R2(cur.qty + l.qty);
      cur.value = R2(cur.value + l.amount);
      cur.taxable = R2(cur.taxable + l.taxable);
      cur.igst = R2(cur.igst + l.igst);
      cur.cgst = R2(cur.cgst + l.cgst);
      cur.sgst = R2(cur.sgst + l.sgst);
      cur.tax = R2(cur.tax + l.igst + l.cgst + l.sgst);
      byKey.set(key, cur);
    }
    const needle = q.trim().toLowerCase();
    const out = [...byKey.values()].filter((r) => !needle
      || r.hsn.toLowerCase().includes(needle) || r.name.toLowerCase().includes(needle));
    const by = {
      hsn: (a, b) => String(a.hsn).localeCompare(String(b.hsn)) || a.name.localeCompare(b.name),
      value: (a, b) => b.value - a.value,
      qty: (a, b) => b.qty - a.qty,
    };
    return out.sort(by[sort] || by.hsn);
  }, [data, q, sort]);

  // Totals follow the rows on screen, so a searched view totals what it shows.
  const totals = useMemo(() => rows.reduce((a, r) => ({
    qty: R2(a.qty + r.qty), value: R2(a.value + r.value), taxable: R2(a.taxable + r.taxable),
    igst: R2(a.igst + r.igst), cgst: R2(a.cgst + r.cgst), sgst: R2(a.sgst + r.sgst),
    tax: R2(a.tax + r.tax),
  }), { qty: 0, value: 0, taxable: 0, igst: 0, cgst: 0, sgst: 0, tax: 0 }), [rows]);

  const grid = useMemo(() => ({
    headers: ['HSN', 'Item Name', 'Total Quantity', 'Total Value', 'Taxable Value',
      'IGST', 'CGST', 'SGST', 'CESS', 'Total Tax Amount'],
    rows: rows.map((r) => [r.hsn, r.name, r.qty, r.value, r.taxable, r.igst, r.cgst, r.sgst, 0, r.tax]),
  }), [rows]);

  const noHsn = rows.filter((r) => r.hsn === '—').length;

  return (
    <ReportShell reportKey="hsn-sales-summary" title="HSN Wise Sales Summary"
      period={period} grid={grid} busy={busy}
      extraControls={(
        <>
          <select className="input" style={{ width: 160 }} value={sort} data-testid="hsn-sort"
            onChange={(e) => setSort(e.target.value)}>
            <option value="hsn">Sort: HSN code</option>
            <option value="value">Sort: Highest value</option>
            <option value="qty">Sort: Highest quantity</option>
          </select>
          <input className="input" style={{ width: 200 }} placeholder="HSN or item…"
            value={q} onChange={(e) => setQ(e.target.value)} />
        </>
      )}
    >
      {noHsn > 0 && (
        <div className="card" style={{ padding: '8px 12px', marginBottom: 10, fontSize: 12.5, color: 'var(--amber)' }}>
          {noHsn} row{noHsn > 1 ? 's' : ''} have no HSN code. Add the HSN on the product
          so the return does not reject it.
        </div>
      )}

      {!rows.length ? (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>
          {(data && data.rows.length) ? 'Nothing matches that search.' : 'No sales in this period.'}
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'auto' }}>
          <table className="crm-table" style={{ fontSize: 12.5 }}>
            <thead>
              <tr>
                <th>HSN</th><th>Item Name</th>
                <th style={{ textAlign: 'right' }}>Total Quantity</th>
                <th style={{ textAlign: 'right' }}>Total Value</th>
                <th style={{ textAlign: 'right' }}>Taxable Value</th>
                <th style={{ textAlign: 'right' }}>IGST</th>
                <th style={{ textAlign: 'right' }}>CGST</th>
                <th style={{ textAlign: 'right' }}>SGST</th>
                <th style={{ textAlign: 'right' }}>CESS</th>
                <th style={{ textAlign: 'right' }}>Total Tax Amount</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.hsn}|${r.name}`} data-testid="hsn-summary-row">
                  <td style={{ fontFamily: 'monospace' }}>
                    {r.hsn === '—' ? <span style={{ color: 'var(--amber)' }}>missing</span> : r.hsn}
                  </td>
                  <td>{r.name}</td>
                  <td style={{ textAlign: 'right' }}>{qty(r.qty)}</td>
                  <td style={{ textAlign: 'right' }}>{money(r.value)}</td>
                  <td style={{ textAlign: 'right' }}>{money(r.taxable)}</td>
                  <td style={{ textAlign: 'right' }}>{r.igst ? money(r.igst) : '—'}</td>
                  <td style={{ textAlign: 'right' }}>{r.cgst ? money(r.cgst) : '—'}</td>
                  <td style={{ textAlign: 'right' }}>{r.sgst ? money(r.sgst) : '—'}</td>
                  {/* No cess is levied on anything this system bills. */}
                  <td style={{ textAlign: 'right', color: 'var(--text3)' }}>—</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{money(r.tax)}</td>
                </tr>
              ))}
              <tr style={{ fontWeight: 700, borderTop: '2px solid var(--border)' }}>
                <td colSpan={2}>Total ({rows.length} item{rows.length > 1 ? 's' : ''})</td>
                <td style={{ textAlign: 'right' }}>{qty(totals.qty)}</td>
                <td style={{ textAlign: 'right' }}>{money(totals.value)}</td>
                <td style={{ textAlign: 'right' }}>{money(totals.taxable)}</td>
                <td style={{ textAlign: 'right' }}>{money(totals.igst)}</td>
                <td style={{ textAlign: 'right' }}>{money(totals.cgst)}</td>
                <td style={{ textAlign: 'right' }}>{money(totals.sgst)}</td>
                <td />
                <td style={{ textAlign: 'right' }}>{money(totals.tax)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </ReportShell>
  );
}
