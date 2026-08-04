/**
 * GST — /accounting/gst. GSTR-1 invoice-wise summary (from accountingApi.gstReport),
 * a GSTR-3B-style monthly picture, and the net GST liability from the ledger
 * (Output CGST/SGST/IGST less Input credit). Exports the GSTR-1 table to CSV,
 * Excel, PDF or print.
 */
import { useEffect, useMemo, useState } from 'react';
import { accountingApi, ledgerApi } from '../../services/api';
import { useT } from '../../i18n/LanguageContext';
import { Kpi, KpiGrid, inr } from '../../components/common/DashboardCharts';
import { downloadCsv, downloadExcel, downloadPdf, printReport } from './ReportsPage';

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const money = (n) => inr(round2(n));

const S = {
  title:    { en: 'GST', hi: 'जीएसटी', hinglish: 'GST' },
  from:     { en: 'From', hi: 'से', hinglish: 'From' },
  to:       { en: 'To', hi: 'तक', hinglish: 'To' },
  run:      { en: 'Run', hi: 'चलाएँ', hinglish: 'Run' },
  gstr1:    { en: 'GSTR-1 (Invoice-wise)', hi: 'GSTR-1', hinglish: 'GSTR-1' },
  gstr3b:   { en: 'GSTR-3B (Summary)', hi: 'GSTR-3B', hinglish: 'GSTR-3B' },
  liability:{ en: 'GST Liability', hi: 'जीएसटी देयता', hinglish: 'GST Liability' },
  taxable:  { en: 'Taxable', hi: 'कर योग्य', hinglish: 'Taxable' },
  invoice:  { en: 'Invoice No', hi: 'इनवॉइस', hinglish: 'Invoice No' },
  date:     { en: 'Date', hi: 'दिनांक', hinglish: 'Date' },
  client:   { en: 'Client', hi: 'ग्राहक', hinglish: 'Client' },
  gstNo:    { en: 'GSTIN', hinglish: 'GSTIN' },
  total:    { en: 'Total', hi: 'कुल', hinglish: 'Total' },
  output:   { en: 'Output tax', hinglish: 'Output tax' },
  input:    { en: 'Input credit', hinglish: 'Input credit' },
  netPayable: { en: 'Net payable', hi: 'नेट देय', hinglish: 'Net payable' },
  due:      { en: 'Due to GST Dept.', hinglish: 'Due to GST Dept.' },
  credit:   { en: 'Excess credit c/f', hinglish: 'Excess credit c/f' },
  none:     { en: 'No invoices in this period.', hinglish: 'No invoices in this period.' },
  count:    { en: 'Invoices', hinglish: 'Invoices' },
  exportCsv: { en: 'CSV', hinglish: 'CSV' },
  exportExcel: { en: 'Excel', hinglish: 'Excel' },
  exportPdf: { en: 'PDF', hinglish: 'PDF' },
  print:    { en: 'Print', hi: 'प्रिंट', hinglish: 'Print' },
};

export default function GstPage() {
  const t = useT(S);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [data, setData] = useState(null);
  const [accounts, setAccounts] = useState([]);

  const run = () => accountingApi.gstReport({ from: from || undefined, to: to || undefined }).then(setData).catch(() => setData(null));
  useEffect(() => { run(); ledgerApi.accounts().then(setAccounts).catch(() => setAccounts([])); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const acct = (k) => accounts.find((a) => a.key === k)?.balance || 0;
  const output = round2(acct('cgst_payable') + acct('sgst_payable') + acct('igst_payable'));
  const input = round2(acct('cgst_input') + acct('sgst_input') + acct('igst_input'));
  const net = round2(output - input);

  const grid = useMemo(() => (data ? {
    headers: [t('invoice'), t('date'), t('client'), t('gstNo'), t('taxable'), 'CGST', 'SGST', 'IGST', t('total')],
    rows: data.rows.map((r) => [r.invoiceNo, r.date, r.clientName, r.gstNo || '', money(r.taxable), money(r.cgst), money(r.sgst), money(r.igst), money(r.total)]),
  } : null), [data, t]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4" style={{ flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>{t('title')}</h2>
        {grid && (
          <div className="flex" style={{ gap: 6 }}>
            <button className="btn btn-sm btn-ghost" onClick={() => downloadCsv('gstr1.csv', grid)}>{t('exportCsv')}</button>
            <button className="btn btn-sm btn-ghost" onClick={() => downloadExcel('gstr1.xlsx', grid)}>{t('exportExcel')}</button>
            <button className="btn btn-sm btn-ghost" onClick={() => downloadPdf(t('gstr1'), grid, 'gstr1.pdf')}>{t('exportPdf')}</button>
            <button className="btn btn-sm btn-ghost" onClick={() => printReport(t('gstr1'), grid)}>{t('print')}</button>
          </div>
        )}
      </div>

      <div className="flex gap-2 mb-4" style={{ alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div className="form-group" style={{ margin: 0 }}><label>{t('from')}</label><input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div className="form-group" style={{ margin: 0 }}><label>{t('to')}</label><input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <button className="btn btn-primary btn-sm" onClick={run}>{t('run')}</button>
      </div>

      {data && (
        <>
          <KpiGrid>
            <Kpi label={t('taxable')} value={money(data.summary.taxable)} icon="🧾" color="var(--text)" />
            <Kpi label="CGST" value={money(data.summary.cgst)} icon="🧮" color="var(--blue)" />
            <Kpi label="SGST" value={money(data.summary.sgst)} icon="🧮" color="var(--blue)" />
            <Kpi label="IGST" value={money(data.summary.igst)} icon="🧮" color="var(--blue)" />
            <Kpi label={t('total')} value={money(data.summary.total)} icon="💳" color="var(--green)" />
            <Kpi label={t('count')} value={data.summary.count} icon="📄" color="var(--text)" />
          </KpiGrid>

          <div className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>{t('gstr3b')}</h3>
            <Row label={t('output')} value={money(output)} />
            <Row label={t('input')} value={'− ' + money(input)} />
            <div style={{ borderTop: '1px solid var(--border)', marginTop: 6, paddingTop: 6 }}>
              <Row label={t('netPayable')} value={money(net)} bold color={net > 0 ? 'var(--red)' : 'var(--green)'} />
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6 }}>
              {net > 0 ? `⚠ ${t('due')} ${money(net)}` : `✅ ${t('credit')} ${money(Math.abs(net))}`}
            </div>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'auto' }}>
            <div style={{ padding: '12px 14px', fontSize: 15, fontWeight: 700, borderBottom: '1px solid var(--border)' }}>{t('gstr1')}</div>
            <table className="table table-sm" style={{ minWidth: 760, margin: 0 }}>
              <thead>
                <tr>{grid.headers.map((h, i) => <th key={i} style={{ textAlign: i >= 4 ? 'right' : 'left' }}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {data.rows.length === 0 && <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--text3)', padding: 24 }}>{t('none')}</td></tr>}
                {data.rows.map((r, i) => (
                  <tr key={i}>
                    <td style={{ fontFamily: 'monospace' }}>{r.invoiceNo}</td>
                    <td>{r.date}</td>
                    <td>{r.clientName}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{r.gstNo || ''}</td>
                    <td style={{ textAlign: 'right' }}>{money(r.taxable)}</td>
                    <td style={{ textAlign: 'right' }}>{money(r.cgst)}</td>
                    <td style={{ textAlign: 'right' }}>{money(r.sgst)}</td>
                    <td style={{ textAlign: 'right' }}>{money(r.igst)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{money(r.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {!data && <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>…</div>}
    </div>
  );
}

function Row({ label, value, bold, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
      <span style={{ fontWeight: bold ? 700 : 400 }}>{label}</span>
      <span style={{ fontWeight: bold ? 700 : 500, color: color || 'var(--text)' }}>{value}</span>
    </div>
  );
}
