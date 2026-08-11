/**
 * Reports — /accounting/reports. Trial Balance, P&L, Balance Sheet, Cash Flow,
 * Ledger (journal) and Outstanding — every one reading the double-entry ledger
 * projection, so they agree by construction. Each report exports to CSV, Excel
 * (xlsx), PDF (pdfmake) or Print.
 */
import { useEffect, useMemo, useState } from 'react';
import { ref, onValue, db } from '../../services/realtime';
import { accountingApi, ledgerApi } from '../../services/api';
import { useT } from '../../i18n/LanguageContext';
import { inr } from '../../components/common/DashboardCharts';
import BranchSelect from '../../components/common/BranchSelect';

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const money = (n) => inr(round2(n));
const blank = (v) => (v === undefined || v === null || v === '' ? '—' : v);

const S = {
  title:    { en: 'Reports', hi: 'रिपोर्ट', hinglish: 'Reports' },
  trialBalance: { en: 'Trial Balance', hi: 'ट्रायल बैलेंस', hinglish: 'Trial Balance' },
  pnl:      { en: 'P&L', hi: 'P&L', hinglish: 'P&L' },
  balanceSheet: { en: 'Balance Sheet', hi: 'बैलेंस शीट', hinglish: 'Balance Sheet' },
  cashFlow: { en: 'Cash Flow', hi: 'कैश फ्लो', hinglish: 'Cash Flow' },
  ledger:   { en: 'Ledger', hi: 'लेजर', hinglish: 'Ledger' },
  outstanding: { en: 'Outstanding', hi: 'बकाया', hinglish: 'Outstanding' },
  from:     { en: 'From', hi: 'से', hinglish: 'From' },
  to:       { en: 'To', hi: 'तक', hinglish: 'To' },
  asOf:     { en: 'As of', hi: 'तक', hinglish: 'As of' },
  months:   { en: 'Months', hi: 'महीने', hinglish: 'Months' },
  run:      { en: 'Run', hi: 'चलाएँ', hinglish: 'Run' },
  account:  { en: 'Account', hi: 'खाता', hinglish: 'Account' },
  name:     { en: 'Name', hi: 'नाम', hinglish: 'Name' },
  debit:    { en: 'Debit', hi: 'डेबिट', hinglish: 'Debit' },
  credit:   { en: 'Credit', hi: 'क्रेडिट', hinglish: 'Credit' },
  income:   { en: 'Income', hi: 'आय', hinglish: 'Income' },
  expense:  { en: 'Expenses', hi: 'खर्च', hinglish: 'Expenses' },
  profit:   { en: 'Profit', hi: 'लाभ', hinglish: 'Profit' },
  loss:     { en: 'Loss', hi: 'घाटा', hinglish: 'Loss' },
  assets:   { en: 'Assets', hi: 'संपत्ति', hinglish: 'Assets' },
  liabilities: { en: 'Liabilities', hi: 'देनदारियाँ', hinglish: 'Liabilities' },
  equity:   { en: 'Equity', hi: 'इक्विटी', hinglish: 'Equity' },
  total:    { en: 'Total', hi: 'कुल', hinglish: 'Total' },
  in:       { en: 'Cash In', hi: 'आय', hinglish: 'Cash In' },
  out:      { en: 'Cash Out', hi: 'व्यय', hinglish: 'Cash Out' },
  net:      { en: 'Net', hi: 'नेट', hinglish: 'Net' },
  date:     { en: 'Date', hi: 'दिनांक', hinglish: 'Date' },
  type:     { en: 'Type', hi: 'प्रकार', hinglish: 'Type' },
  reference:{ en: 'Reference', hi: 'रेफ', hinglish: 'Reference' },
  party:    { en: 'Party', hi: 'पार्टी', hinglish: 'Party' },
  client:   { en: 'Client', hi: 'ग्राहक', hinglish: 'Client' },
  invoiced: { en: 'Invoiced', hi: 'इनवॉइस्ड', hinglish: 'Invoiced' },
  paid:     { en: 'Paid', hi: 'पेड', hinglish: 'Paid' },
  balanced: { en: 'Balanced ✓', hi: 'बैलेंस्ड ✓', hinglish: 'Balanced ✓' },
  exportCsv: { en: 'CSV', hinglish: 'CSV' },
  exportExcel: { en: 'Excel', hinglish: 'Excel' },
  exportPdf: { en: 'PDF', hinglish: 'PDF' },
  print:    { en: 'Print', hi: 'प्रिंट', hinglish: 'Print' },
  branch:   { en: 'Branch', hi: 'शाखा', hinglish: 'Branch' },
  allBranches: { en: 'All branches', hi: 'सभी शाखाएँ', hinglish: 'All branches' },
};

// ── Export helpers (CSV / Excel / PDF / Print) ──────────────────────────────
export function downloadCsv(filename, grid) {
  const esc = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const csv = [grid.headers, ...grid.rows].map((r) => r.map(esc).join(',')).join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export function downloadExcel(filename, grid) {
  import('xlsx').then((XLSX) => {
    const ws = XLSX.utils.aoa_to_sheet([grid.headers, ...grid.rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Report');
    XLSX.writeFile(wb, filename);
  }).catch(() => {});
}

// Pretty-printed JSON (GSTR-1 export, backup, etc.)
export function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export async function downloadPdf(title, grid, filename) {
  try {
    const [{ default: pdfMake }, { default: pdfFonts }] = await Promise.all([
      import('pdfmake/build/pdfmake'),
      import('pdfmake/build/vfs_fonts'),
    ]);
    pdfMake.vfs = pdfFonts.pdfMake && pdfFonts.pdfMake.vfs;
    const body = [grid.headers.map((h) => ({ text: h, bold: true })), ...grid.rows.map((r) => r.map((c) => ({ text: String(c) })))];
    const doc = {
      content: [
        { text: title, style: 'title' },
        { text: new Date().toLocaleDateString(), style: 'sub' },
        { layout: 'lightHorizontalLines', table: { headerRows: 1, widths: grid.headers.map((_, i) => (i === 0 ? 'auto' : '*')), body } },
      ],
      styles: { title: { fontSize: 16, bold: true, margin: [0, 0, 0, 4] }, sub: { fontSize: 10, margin: [0, 0, 0, 12] } },
    };
    pdfMake.createPdf(doc).download(filename);
  } catch (e) { /* pdfmake failed to load — the CSV/Excel/Print paths still work */ }
}

export function printReport(title, grid) {
  const w = window.open('', '_blank', 'width=900,height=650');
  if (!w) return;
  const right = (h) => /₹|Amount|Debit|Credit|Balance|Total|In|Out|Net/.test(h);
  w.document.write(`<html><head><title>${title}</title><style>
    body{font-family:Arial,Helvetica,sans-serif;padding:24px;color:#111}
    h2{font-size:20px;margin:0 0 4px} .sub{color:#666;font-size:12px;margin-bottom:16px}
    table{width:100%;border-collapse:collapse;font-size:12px}
    th,td{border:1px solid #ccc;padding:4px 8px;text-align:left}
    th{background:#f4f4f4;font-weight:700} td.r,th.r{text-align:right}
  </style></head><body>`);
  w.document.write(`<h2>${title}</h2><div class="sub">${new Date().toLocaleString()}</div>`);
  w.document.write('<table><thead><tr>' + grid.headers.map((h) => `<th class="${right(h) ? 'r' : ''}">${h}</th>`).join('') + '</tr></thead><tbody>');
  grid.rows.forEach((r) => w.document.write('<tr>' + r.map((c) => `<td>${c}</td>`).join('') + '</tr>'));
  w.document.write('</tbody></table></body></html>');
  w.document.close();
  w.focus();
  w.print();
}

// ── Generic renderer ─────────────────────────────────────────────────────────
function ReportView({ title, grid, t, rightCols, onExport }) {
  return (
    <div>
      <div className="flex" style={{ gap: 6, marginBottom: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <button className="btn btn-sm btn-ghost" onClick={() => downloadCsv('report.csv', grid)}>{t('exportCsv')}</button>
        <button className="btn btn-sm btn-ghost" onClick={() => downloadExcel('report.xlsx', grid)}>{t('exportExcel')}</button>
        <button className="btn btn-sm btn-ghost" onClick={() => downloadPdf(title, grid, 'report.pdf')}>{t('exportPdf')}</button>
        <button className="btn btn-sm btn-ghost" onClick={() => printReport(title, grid)}>{t('print')}</button>
      </div>
      {onExport ? onExport() : null}
      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        <table className="table table-sm" style={{ minWidth: 560, margin: 0 }}>
          <thead>
            <tr>{grid.headers.map((h, i) => <th key={i} style={{ textAlign: rightCols && rightCols[i] ? 'right' : 'left' }}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {grid.rows.map((r, i) => (
              <tr key={i}>{r.map((c, j) => <td key={j} style={{ textAlign: rightCols && rightCols[j] ? 'right' : 'left' }}>{c}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const t = useT(S);
  const [tab, setTab] = useState('trialBalance');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [asOf, setAsOf] = useState('');
  const [months, setMonths] = useState(12);
  const [branchId, setBranchId] = useState('');
  const [tb, setTb] = useState(null);
  const [pnl, setPnl] = useState(null);
  const [bs, setBs] = useState(null);
  const [cf, setCf] = useState(null);
  const [entries, setEntries] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [clientLedger, setClientLedger] = useState([]);
  const [vendorPos, setVendorPos] = useState([]);

  useEffect(() => {
    ledgerApi.accounts().then(setAccounts).catch(() => setAccounts([]));
    accountingApi.ledger().then(setClientLedger).catch(() => setClientLedger([]));
    const u = onValue(ref(db, 'mpw/purchaseOrders'), (s) => {
      const list = Object.entries(s.val() || {}).map(([id, v]) => ({ ...v, id }));
      setVendorPos(list.filter((p) => String(p.status || '').toLowerCase() === 'received'));
    });
    return () => u();
  }, []);

  const acctName = useMemo(() => { const m = {}; accounts.forEach((a) => { m[a.key] = a.name; }); return m; }, [accounts]);
  const nm = (k) => acctName[k] || k;

  const run = (t) => {
    const k = t || tab;
    const b = branchId || undefined;
    if (k === 'trialBalance') ledgerApi.trialBalance({ from: from || undefined, to: to || undefined, branchId: b }).then(setTb).catch(() => setTb(null));
    if (k === 'pnl') ledgerApi.pnl({ from: from || undefined, to: to || undefined, branchId: b }).then(setPnl).catch(() => setPnl(null));
    if (k === 'balanceSheet') ledgerApi.balanceSheet({ asOf: asOf || undefined, branchId: b }).then(setBs).catch(() => setBs(null));
    if (k === 'cashFlow') ledgerApi.cashFlow({ months, branchId: b }).then(setCf).catch(() => setCf(null));
    if (k === 'ledger') ledgerApi.entries({ from: from || undefined, to: to || undefined, branchId: b }).then((r) => setEntries(r.entries || [])).catch(() => setEntries(null));
  };

  useEffect(() => { run(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [branchId]);

  // ── Per-report grids ─────────────────────────────────────────────────────
  let title = t(tab); let grid = null; let rightCols = null;

  if (tab === 'trialBalance' && tb) {
    title = t('trialBalance');
    grid = {
      headers: [t('account'), t('name'), t('debit'), t('credit')],
      rows: tb.rows.map((r) => [r.account, nm(r.account), r.dr ? money(r.dr) : '', r.cr ? money(r.cr) : '']),
    };
    grid.rows.push([t('total'), '', money(tb.totalDr), money(tb.totalCr)]);
    rightCols = [false, false, true, true];
  }

  if (tab === 'pnl' && pnl) {
    title = t('pnl');
    const rows = [
      ...[pnl.income || []].map((r) => [t('income'), r.name, '', money(r.amount)]),
      ...[pnl.expense || []].map((r) => [t('expense'), r.name, '', money(r.amount)]),
    ];
    rows.push([t('total') + ' ' + t('income'), '', '', money(pnl.totalIncome)]);
    rows.push([t('total') + ' ' + t('expense'), '', '', money(pnl.totalExpense)]);
    rows.push([pnl.profit >= 0 ? t('profit') : t('loss'), '', '', money(Math.abs(pnl.profit))]);
    grid = { headers: [t('type'), t('name'), '', 'Amount'], rows };
    rightCols = [false, false, false, true];
  }

  if (tab === 'balanceSheet' && bs) {
    title = t('balanceSheet');
    const rows = [
      ...bs.assets.map((r) => [t('assets'), r.name, '', money(r.balance)]),
      [t('assets') + ' ' + t('total'), '', '', money(bs.totalAssets)],
      ...bs.liabilities.map((r) => [t('liabilities'), r.name, '', money(r.balance)]),
      [t('liabilities') + ' ' + t('total'), '', '', money(bs.totalLiabilities)],
      ...bs.equity.map((r) => [t('equity'), r.name, '', money(r.balance)]),
      [t('equity') + ' ' + t('total'), '', '', money(bs.equityTotal)],
    ];
    grid = { headers: [t('type'), t('name'), '', 'Amount'], rows };
    rightCols = [false, false, false, true];
  }

  if (tab === 'cashFlow' && cf) {
    title = t('cashFlow');
    grid = {
      headers: ['Month', t('in'), t('out'), t('net')],
      rows: cf.series.map((r) => [r.month, money(r.in), money(r.out), money(r.net)]),
    };
    rightCols = [false, true, true, true];
  }

  if (tab === 'ledger' && entries) {
    title = t('ledger');
    const rows = [];
    entries.forEach((e) => {
      const ref = e.ref ? `${e.ref.collection} ${String(e.ref.id).slice(0, 8)}` : '—';
      e.lines.forEach((l) => {
        rows.push([e.date, e.type, ref, nm(l.account), l.partyId ? `${l.partyType} ${String(l.partyId).slice(0, 8)}` : '', l.dr ? money(l.dr) : '', l.cr ? money(l.cr) : '']);
      });
    });
    grid = { headers: [t('date'), t('type'), t('reference'), t('account'), t('party'), t('debit'), t('credit')], rows };
    rightCols = [false, false, false, false, false, true, true];
  }

  if (tab === 'outstanding') {
    title = t('outstanding');
    const clients = clientLedger.filter((r) => r.outstanding > 0);
    const vendorRows = vendorPos.reduce((m, p) => {
      const key = p.vendorId || p.vendorName || '—';
      m[key] = round2((m[key] || 0) + (p.total || 0));
      return m;
    }, {});
    const vendors = Object.entries(vendorRows).map(([name, total]) => ({ name, outstanding: total }));
    grid = {
      headers: [t('type'), t('client'), t('invoiced'), t('paid'), t('outstanding')],
      rows: [
        ...clients.map((r) => [t('client'), r.clientName, money(r.invoiced), money(r.paid), money(r.outstanding)]),
        ...vendors.map((r) => [t('expense'), r.name, money(r.outstanding), '', money(r.outstanding)]),
      ],
    };
    rightCols = [false, false, true, true, true];
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4" style={{ flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>{t('title')}</h2>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {['trialBalance', 'pnl', 'balanceSheet', 'cashFlow', 'ledger', 'outstanding'].map((k) => (
          <button key={k} className="btn btn-xs" onClick={() => { setTab(k); run(k); }}
            style={{ background: tab === k ? 'var(--blue, #C05621)' : 'var(--surface2)', color: tab === k ? '#fff' : 'var(--text2)', border: 'none', borderRadius: 14 }}>
            {t(k)}
          </button>
        ))}
      </div>

      <div className="flex gap-2 mb-4" style={{ alignItems: 'flex-end', flexWrap: 'wrap' }}>
        {tab !== 'balanceSheet' && tab !== 'cashFlow' && tab !== 'outstanding' && (
          <>
            <div className="form-group" style={{ margin: 0 }}><label>{t('from')}</label><input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
            <div className="form-group" style={{ margin: 0 }}><label>{t('to')}</label><input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          </>
        )}
        {tab === 'balanceSheet' && (
          <div className="form-group" style={{ margin: 0 }}><label>{t('asOf')}</label><input className="input" type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} /></div>
        )}
        {tab === 'cashFlow' && (
          <div className="form-group" style={{ margin: 0 }}><label>{t('months')}</label><input className="input" type="number" min={1} max={24} value={months} onChange={(e) => setMonths(Number(e.target.value))} /></div>
        )}
        <div className="form-group" style={{ margin: 0 }}><label>{t('branch')}</label>
          <BranchSelect value={branchId} onChange={setBranchId} allowAll allLabel={t('allBranches')} style={{ width: 170 }} />
        </div>
        <button className="btn btn-primary btn-sm" onClick={run}>{t('run')}</button>
      </div>

      {tab === 'trialBalance' && tb && (
        <div style={{ marginBottom: 8, color: round2(tb.totalDr - tb.totalCr) === 0 ? 'var(--green)' : 'var(--red)', fontSize: 13, fontWeight: 600 }}>
          {round2(tb.totalDr - tb.totalCr) === 0 ? t('balanced') : `⚠ Δ ${money(tb.totalDr - tb.totalCr)}`}
        </div>
      )}
      {tab === 'balanceSheet' && bs && (
        <div style={{ marginBottom: 8, color: bs.balanced ? 'var(--green)' : 'var(--red)', fontSize: 13, fontWeight: 600 }}>
          {bs.balanced ? t('balanced') : `⚠ Assets − Liab − Equity = ${money(round2(bs.totalAssets - bs.totalLiabilities - bs.equityTotal))}`}
        </div>
      )}

      {grid
        ? <ReportView title={title} grid={grid} t={t} rightCols={rightCols} />
        : <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>…</div>}
    </div>
  );
}
