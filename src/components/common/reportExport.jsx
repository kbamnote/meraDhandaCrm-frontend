/**
 * How every report leaves this app: CSV, Excel, emailed Excel, PDF and Print.
 *
 * These used to live in ReportsPage, which meant four other screens imported
 * their export helpers from a page they never render. They are here now so the
 * button row below can sit beside them — a shared row that imported from a page
 * which imported the row back would be a cycle.
 *
 * One row, used everywhere, so a report cannot offer three ways out on one
 * screen and five on another.
 */
import { useState } from 'react';
import { accountingApi } from '../../services/api';
import { showToast } from './toast';

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

/** The workbook, as bytes. Shared by the download and the email. */
async function buildWorkbook(grid, type) {
  const XLSX = await import('xlsx');
  const ws = XLSX.utils.aoa_to_sheet([grid.headers, ...grid.rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Report');
  return { XLSX, wb, out: type ? XLSX.write(wb, { bookType: 'xlsx', type }) : null };
}

export function downloadExcel(filename, grid) {
  buildWorkbook(grid).then(({ XLSX, wb }) => XLSX.writeFile(wb, filename)).catch(() => {});
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

/**
 * Build the same workbook the download writes and post it to be mailed.
 *
 * Built in the browser rather than on the server so what lands in the inbox is
 * the filtered view the sender was actually looking at, not a second rendering
 * of the report that is free to disagree with it.
 *
 * Resolves true when it was sent, false when the sender cancelled or it failed
 * — the caller only needs to know whether to stop showing "Sending…".
 */
export async function emailExcel({ title, grid, filename }) {
  const to = window.prompt(`Email "${title}" to which address?`);
  if (!to || !to.trim()) return false;          // cancelled
  try {
    const { out } = await buildWorkbook(grid, 'base64');
    await accountingApi.emailReport({
      to: to.trim(), subject: title, filename: filename || 'report.xlsx', content: out,
    });
    showToast(`Sent to ${to.trim()}`, 'success');
    return true;
  } catch (e) {
    showToast(e.response?.data?.error || 'Could not send that email', 'error');
    return false;
  }
}

/**
 * The export row every report screen shows.
 *
 * @param fileBase  the download name without an extension
 * @param size      'sm' or 'xs', to match the screen it sits on
 * @param labels    overrides, for screens that translate their buttons
 */
export default function ExportButtons({ title, grid, fileBase, size = 'sm', labels = {}, children }) {
  const [emailing, setEmailing] = useState(false);
  // A spreadsheet with only headers in it looks like the data was lost rather
  // than absent, so nothing is exportable until there is something to export.
  const empty = !grid || !grid.rows || grid.rows.length === 0;
  const cls = `btn btn-${size} btn-ghost`;
  // Some callers pass the report's title as the base ("P&L", "Cash & Bank"),
  // so strip whatever a filename cannot carry rather than trusting it.
  const name = (ext) => `${String(fileBase || 'report').replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '') || 'report'}.${ext}`;

  const send = async () => {
    setEmailing(true);
    try { await emailExcel({ title, grid, filename: name('xlsx') }); }
    finally { setEmailing(false); }
  };

  return (
    <div className="flex" style={{ gap: 6, flexWrap: 'wrap' }}>
      <button className={cls} disabled={empty}
        onClick={() => downloadCsv(name('csv'), grid)}>{labels.csv || 'CSV'}</button>
      <button className={cls} data-testid="report-email" disabled={empty || emailing}
        onClick={send}>{emailing ? 'Sending…' : (labels.email || 'Email Excel')}</button>
      <button className={cls} data-testid="report-excel" disabled={empty}
        onClick={() => downloadExcel(name('xlsx'), grid)}>{labels.excel || 'Download Excel'}</button>
      <button className={cls} disabled={empty}
        onClick={() => downloadPdf(title, grid, name('pdf'))}>{labels.pdf || 'PDF'}</button>
      <button className={cls} data-testid="report-print" disabled={empty}
        onClick={() => printReport(title, grid)}>{labels.print || 'Print'}</button>
      {children}
    </div>
  );
}
