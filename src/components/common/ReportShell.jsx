/**
 * The frame every report screen shares: back arrow, title, a Favourite star,
 * the period picker, and the three export buttons.
 *
 * It exists so a new report is a query and a table, not another copy of this
 * header — and so every report exports the same way. The page hands it a
 * `grid` ({ headers, rows }) and the buttons do the rest.
 *
 * Favourites live in this browser only. They decide which tiles sit at the top
 * of the Reports hub for the person using it, which is a preference, not
 * company data — syncing it would mean one person's habits reordering
 * everybody's screen.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { downloadCsv, downloadExcel, downloadPdf, printReport } from '../../pages/accounting/ReportsPage';

const FAV_KEY = 'md.reportFavourites';

export function loadFavourites() {
  try { return new Set(JSON.parse(localStorage.getItem(FAV_KEY) || '[]')); }
  catch (e) { return new Set(); }
}
export function saveFavourites(set) {
  try { localStorage.setItem(FAV_KEY, JSON.stringify([...set])); }
  catch (e) { /* private window — favourites just don't persist */ }
}
export function toggleFavourite(key) {
  const set = loadFavourites();
  if (set.has(key)) set.delete(key); else set.add(key);
  saveFavourites(set);
  return set;
}

// ── the period picker ──────────────────────────────────────────────────────
const iso = (d) => d.toISOString().slice(0, 10);
const shift = (days) => { const d = new Date(); d.setDate(d.getDate() + days); return iso(d); };
const monthStart = (back = 0) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - back); return iso(d); };
const monthEnd = (back = 0) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - back + 1); d.setDate(0); return iso(d); };

/** Financial year starts in April, so Jan–Mar belongs to the year before. */
function fyRange(back = 0) {
  const now = new Date();
  const y = (now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1) - back;
  return { from: `${y}-04-01`, to: `${y + 1}-03-31` };
}

export const PERIODS = [
  { key: 'today', label: 'Today', range: () => ({ from: iso(new Date()), to: iso(new Date()) }) },
  { key: 'week', label: 'This Week', range: () => ({ from: shift(-6), to: iso(new Date()) }) },
  { key: 'month', label: 'This Month', range: () => ({ from: monthStart(0), to: iso(new Date()) }) },
  { key: 'lastMonth', label: 'Last Month', range: () => ({ from: monthStart(1), to: monthEnd(1) }) },
  { key: 'quarter', label: 'Last 90 Days', range: () => ({ from: shift(-89), to: iso(new Date()) }) },
  { key: 'fy', label: 'This Financial Year', range: () => fyRange(0) },
  { key: 'prevFy', label: 'Previous Financial Year', range: () => fyRange(1) },
  { key: 'year', label: 'Last 365 Days', range: () => ({ from: shift(-364), to: iso(new Date()) }) },
  { key: 'custom', label: 'Custom…', range: null },
];

export function usePeriod(initial = 'month') {
  const [key, setKey] = useState(initial);
  const [custom, setCustom] = useState(() => PERIODS.find((p) => p.key === initial)?.range?.() || { from: '', to: '' });
  const range = useMemo(() => {
    const p = PERIODS.find((x) => x.key === key);
    return p && p.range ? p.range() : custom;
  }, [key, custom]);
  return { key, setKey, custom, setCustom, range };
}

export function PeriodPicker({ period }) {
  const { key, setKey, custom, setCustom } = period;
  return (
    <div className="flex items-center" style={{ gap: 8, flexWrap: 'wrap' }}>
      <select className="input" style={{ width: 200 }} value={key} data-testid="report-period"
        onChange={(e) => setKey(e.target.value)}>
        {PERIODS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
      </select>
      {key === 'custom' && (
        <>
          <input className="input" type="date" style={{ width: 150 }} value={custom.from}
            onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} />
          <span style={{ color: 'var(--text3)' }}>→</span>
          <input className="input" type="date" style={{ width: 150 }} value={custom.to}
            onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} />
        </>
      )}
    </div>
  );
}

/**
 * @param grid  { headers, rows } — what the export buttons send out. Built by
 *              the page from what is on screen, so a filtered view exports
 *              what the reader is actually looking at.
 */
export default function ReportShell({ reportKey, title, period, grid, busy, children, extraControls }) {
  const navigate = useNavigate();
  const [favs, setFavs] = useState(loadFavourites);
  const isFav = favs.has(reportKey);
  const file = (ext) => `${reportKey}-${(period && period.range.from) || ''}-to-${(period && period.range.to) || ''}.${ext}`;
  const empty = !grid || !grid.rows || grid.rows.length === 0;

  useEffect(() => { document.title = `${title} · Reports`; }, [title]);

  return (
    <div data-legacy-id={`page-report-${reportKey}`}>
      <div className="flex items-center" style={{ gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/reports')} title="Back to Reports">←</button>
        <h2 style={{ fontSize: 19, fontWeight: 600, margin: 0 }}>{title}</h2>
        <button className="btn btn-ghost btn-xs" data-testid="report-fav"
          title={isFav ? 'Remove from Favourites' : 'Add to Favourites'}
          onClick={() => setFavs(new Set(toggleFavourite(reportKey)))}>
          <span style={{ color: isFav ? 'var(--amber)' : 'var(--text3)' }}>{isFav ? '★' : '☆'}</span>
          {' '}Favourite
        </button>
      </div>

      <div className="flex items-center justify-between" style={{ gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <div className="flex items-center" style={{ gap: 8, flexWrap: 'wrap' }}>
          <PeriodPicker period={period} />
          {extraControls}
        </div>
        {/* Disabled on an empty report: a spreadsheet with only headers in it
            looks like the data was lost rather than absent. */}
        <div className="flex" style={{ gap: 6, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost btn-sm" disabled={empty}
            onClick={() => downloadCsv(file('csv'), grid)}>CSV</button>
          <button className="btn btn-ghost btn-sm" data-testid="report-excel" disabled={empty}
            onClick={() => downloadExcel(file('xlsx'), grid)}>Download Excel</button>
          <button className="btn btn-ghost btn-sm" disabled={empty}
            onClick={() => downloadPdf(title, grid, file('pdf'))}>PDF</button>
          <button className="btn btn-ghost btn-sm" data-testid="report-print" disabled={empty}
            onClick={() => printReport(title, grid)}>Print</button>
        </div>
      </div>

      {busy && <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>Loading…</div>}
      {children}
    </div>
  );
}
