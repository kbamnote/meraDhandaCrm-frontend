/**
 * The invoice-wise GST registers — GSTR-1 (Sales) and GSTR-2 (Purchase).
 *
 * One component renders both: the row is the same shape on either side of the
 * books, and a register that drifts from its opposite number is how a return
 * stops reconciling. Only the documents read, the tabs offered and two column
 * labels differ, so those are configuration rather than a second file.
 *
 * A document billed at two rates is ONE invoice with two tax lines, not two
 * invoices — that is how the portal shows it and how it reconciles — so the
 * party, number and value cells span the rate rows beneath them.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { accountingApi } from '../../services/api';
import { showToast } from '../../components/common/toast';
import { downloadJson } from '../../components/common/reportExport';
import ReportShell, { usePeriod } from '../../components/common/ReportShell';

const money = (n) => (Math.round((Number(n) || 0) * 100) / 100)
  .toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pretty = (iso) => (iso ? iso.split('-').reverse().join('-') : '—');
const R2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const REGISTERS = {
  gstr1: {
    title: 'GSTR-1 (Sales)',
    partyLabel: 'Customer Name',
    numberLabel: 'Invoice Number',
    // The portal's own CDNR sections, in its order.
    tabs: [
      { key: 'sales', label: 'Sales', doc: 'sales' },
      { key: 'credit', label: 'Sales Return / Credit Note', doc: 'credit' },
      // Named for what this system actually stores. Debit notes here are raised
      // against a SALES invoice (an extra charge to a customer), which is what
      // belongs in GSTR-1 — they are not purchase returns.
      { key: 'debit', label: 'Debit Note', doc: 'debit' },
    ],
    load: ({ doc, from, to }) => accountingApi.gstr1({ doc, from, to }),
    // The offline-tool upload file, for the period on screen.
    json: true,
    note: 'A working register, not a filed return. Check it against the portal '
      + 'before uploading: this system does not push invoices to the IRN, so nothing '
      + 'here is auto-populated for you.',
  },
  gstr2: {
    title: 'GSTR-2 (Purchase)',
    partyLabel: 'Party Name',
    numberLabel: 'Invoice No / Original No',
    tabs: [
      { key: 'purchase', label: 'Purchase', doc: 'purchase' },
      // No `doc`: nothing in this system is a purchase return yet. Debit notes
      // exist, but they are raised against sales invoices, so showing them here
      // would file a customer charge as a supplier return.
      { key: 'returns', label: 'Purchase Return', doc: null,
        empty: 'Purchase returns are not recorded separately yet. The debit notes this '
          + 'system stores are raised against sales invoices, so they belong in GSTR-1, '
          + 'not here.' },
    ],
    load: ({ from, to }) => accountingApi.gstr2({ from, to }),
    json: false,
  },
};

export default function GstRegisterPage({ register }) {
  const cfg = REGISTERS[register];
  const period = usePeriod('month');
  const [tabKey, setTabKey] = useState(cfg.tabs[0].key);
  const [view, setView] = useState('invoice');   // invoice | rate
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const { from, to } = period.range;
  const tab = cfg.tabs.find((t) => t.key === tabKey) || cfg.tabs[0];

  const load = useCallback(async () => {
    if (!from || !to || !tab.doc) { setData(null); return; }
    setBusy(true);
    try { setData(await cfg.load({ doc: tab.doc, from, to })); }
    catch (e) { showToast(e.response?.data?.error || 'Could not load the report', 'error'); }
    finally { setBusy(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, tab.doc, register]);

  useEffect(() => { load(); }, [load]);

  const rows = (data && data.rows) || [];

  // One row per RATE across the period — what the return's rate-wise boxes
  // want, and the counterpart to the invoice-wise view.
  const rateRows = useMemo(() => {
    const byRate = new Map();
    for (const r of rows) {
      for (const t of r.taxLines) {
        const cur = byRate.get(t.rate)
          || { rate: t.rate, docs: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 };
        cur.docs += 1;
        cur.taxable = R2(cur.taxable + t.taxable);
        cur.cgst = R2(cur.cgst + t.cgst);
        cur.sgst = R2(cur.sgst + t.sgst);
        cur.igst = R2(cur.igst + t.igst);
        cur.total = R2(cur.total + t.total);
        byRate.set(t.rate, cur);
      }
    }
    return [...byRate.values()].sort((a, b) => a.rate - b.rate);
  }, [rows]);

  // The export writes one spreadsheet line per TAX line: a merged cell cannot
  // be summed, and this is a file people pivot.
  const grid = useMemo(() => (view === 'rate' ? {
    headers: ['Tax %', 'Documents', 'Taxable Value', 'CGST', 'SGST', 'IGST', 'Total Tax'],
    rows: rateRows.map((r) => [`${r.rate}%`, r.docs, r.taxable, r.cgst, r.sgst, r.igst, r.total]),
  } : {
    headers: ['GSTIN', cfg.partyLabel, 'State Code', 'State Name', 'Number', 'Original No',
      'Date', 'Invoice Value', 'Tax %', 'Taxable Value', 'CGST', 'SGST', 'IGST', 'CESS', 'Total Tax'],
    rows: rows.flatMap((r) => r.taxLines.map((t) => [
      r.gstin || '', r.partyName, r.stateCode || '', r.stateName || '',
      r.invoiceNo || '', r.originalNo || '', r.date,
      r.value, `${t.rate}%`, t.taxable, t.cgst, t.sgst, t.igst, 0, t.total,
    ])),
  }), [view, rows, rateRows, cfg.partyLabel]);

  const downloadReturnJson = async () => {
    try {
      const json = await accountingApi.gstExport({ from, to });
      downloadJson(`gstr1-${from}-to-${to}.json`, json);
    } catch (e) {
      showToast(e.response?.data?.error || 'Could not build the JSON file', 'error');
    }
  };

  const controls = (
    <>
      <div className="flex" style={{ gap: 4, flexWrap: 'wrap' }}>
        {cfg.tabs.map((t) => (
          <button key={t.key} type="button" data-testid="register-tab"
            className={`btn btn-sm ${tabKey === t.key ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setTabKey(t.key)}>{t.label}</button>
        ))}
      </div>
      {tab.doc && (
        <select className="input" style={{ width: 150 }} value={view} data-testid="register-view"
          onChange={(e) => setView(e.target.value)}>
          <option value="invoice">Invoice View</option>
          <option value="rate">Rate Summary</option>
        </select>
      )}
      {cfg.json && tab.key === 'sales' && (
        <button className="btn btn-ghost btn-sm" onClick={downloadReturnJson} data-testid="register-json">
          Download JSON
        </button>
      )}
    </>
  );

  return (
    <ReportShell reportKey={register} title={cfg.title} period={period}
      grid={grid} busy={busy} extraControls={controls}>

      {!tab.doc ? (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>
          {tab.empty}
        </div>
      ) : !rows.length ? (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>
          {busy ? 'Loading…' : `Nothing in this period under ${tab.label}.`}
        </div>
      ) : view === 'rate' ? (
        <div className="card" style={{ padding: 0, overflow: 'auto' }}>
          <table className="crm-table" style={{ fontSize: 12.5 }}>
            <thead>
              <tr>
                <th>Tax Rate</th><th style={{ textAlign: 'right' }}>Documents</th>
                <th style={{ textAlign: 'right' }}>Taxable Value</th>
                <th style={{ textAlign: 'right' }}>CGST</th><th style={{ textAlign: 'right' }}>SGST</th>
                <th style={{ textAlign: 'right' }}>IGST</th><th style={{ textAlign: 'right' }}>Total Tax</th>
              </tr>
            </thead>
            <tbody>
              {rateRows.map((r) => (
                <tr key={r.rate} data-testid="register-rate-row">
                  <td style={{ fontWeight: 600 }}>{r.rate}%</td>
                  <td style={{ textAlign: 'right' }}>{r.docs}</td>
                  <td style={{ textAlign: 'right' }}>{money(r.taxable)}</td>
                  <td style={{ textAlign: 'right' }}>{r.cgst ? money(r.cgst) : '—'}</td>
                  <td style={{ textAlign: 'right' }}>{r.sgst ? money(r.sgst) : '—'}</td>
                  <td style={{ textAlign: 'right' }}>{r.igst ? money(r.igst) : '—'}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{money(r.total)}</td>
                </tr>
              ))}
              <tr style={{ fontWeight: 700, borderTop: '2px solid var(--border)' }}>
                <td colSpan={2}>Total</td>
                <td style={{ textAlign: 'right' }}>{money(data.totals.taxable)}</td>
                <td colSpan={3} />
                <td style={{ textAlign: 'right' }}>{money(data.totals.tax)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'auto' }}>
          <table className="crm-table" style={{ fontSize: 12.5 }}>
            <thead>
              <tr>
                <th rowSpan={2}>GSTIN</th>
                <th rowSpan={2}>{cfg.partyLabel}</th>
                <th colSpan={2} style={{ textAlign: 'center' }}>Place of Supply</th>
                <th colSpan={3} style={{ textAlign: 'center' }}>Invoice Details</th>
                <th rowSpan={2}>Total Tax(%)</th>
                <th rowSpan={2}>Taxable Value</th>
                <th colSpan={5} style={{ textAlign: 'center' }}>Amount of Tax</th>
              </tr>
              <tr>
                <th>State Code</th><th>State Name</th>
                <th>{cfg.numberLabel}</th><th>Invoice Date</th><th>Invoice Value</th>
                <th>CGST</th><th>SGST/UTGST</th><th>IGST</th><th>CESS</th><th>Total Tax</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const span = Math.max(1, r.taxLines.length);
                return r.taxLines.map((t, i) => (
                  <tr key={`${r.id}-${i}`} data-testid="register-row">
                    {/* Written once per DOCUMENT, spanning its rate rows. */}
                    {i === 0 && <td rowSpan={span} style={{ fontFamily: 'monospace', fontSize: 11.5 }}>{r.gstin || '—'}</td>}
                    {i === 0 && <td rowSpan={span}>{r.partyName}</td>}
                    {i === 0 && <td rowSpan={span} style={{ textAlign: 'center' }}>{r.stateCode || '—'}</td>}
                    {i === 0 && <td rowSpan={span}>{r.stateName || '—'}</td>}
                    {i === 0 && (
                      <td rowSpan={span} style={{ fontFamily: 'monospace', fontSize: 11.5 }}>
                        <div>{r.invoiceNo || '—'}</div>
                        {/* The document this one corrects, where there is one. */}
                        {r.originalNo && <div style={{ color: 'var(--text3)' }}>{r.originalNo}</div>}
                      </td>
                    )}
                    {i === 0 && <td rowSpan={span} style={{ whiteSpace: 'nowrap' }}>{pretty(r.date)}</td>}
                    {i === 0 && <td rowSpan={span} style={{ textAlign: 'right' }}>{money(r.value)}</td>}
                    <td style={{ textAlign: 'right' }}>{t.rate}%</td>
                    <td style={{ textAlign: 'right' }}>{money(t.taxable)}</td>
                    <td style={{ textAlign: 'right' }}>{t.cgst ? money(t.cgst) : '—'}</td>
                    <td style={{ textAlign: 'right' }}>{t.sgst ? money(t.sgst) : '—'}</td>
                    <td style={{ textAlign: 'right' }}>{t.igst ? money(t.igst) : '—'}</td>
                    {/* No cess is levied on anything this system bills. */}
                    <td style={{ textAlign: 'right', color: 'var(--text3)' }}>—</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{money(t.total)}</td>
                  </tr>
                ));
              })}
              <tr style={{ fontWeight: 700, borderTop: '2px solid var(--border)' }}>
                <td colSpan={6}>Total ({rows.length})</td>
                <td style={{ textAlign: 'right' }}>{money(data.totals.value)}</td>
                <td />
                <td style={{ textAlign: 'right' }}>{money(data.totals.taxable)}</td>
                <td colSpan={4} />
                <td style={{ textAlign: 'right' }}>{money(data.totals.tax)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {cfg.note && (
        <div className="card" style={{ marginTop: 12, padding: '10px 14px', fontSize: 12, color: 'var(--text3)' }}>
          {cfg.note}
        </div>
      )}
    </ReportShell>
  );
}

// The route table renders components with no props, so each register gets a name.
export const Gstr1Page = () => <GstRegisterPage register="gstr1" />;
export const Gstr2Page = () => <GstRegisterPage register="gstr2" />;
