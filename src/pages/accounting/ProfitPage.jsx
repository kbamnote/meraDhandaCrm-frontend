/**
 * Sales Profitability — /accounting/profit. Per-invoice and per-item gross
 * margin, from the costs stamped onto each invoice line at save time.
 *
 * The honest bit: only lines picked from the Items catalog carry a cost, so an
 * invoice of free-text lines has no cost basis at all. Those are reported as
 * "uncosted" and kept OUT of the headline margin rather than being treated as
 * 100% profit. The coverage figure says how much of the period's sales the
 * margin actually speaks for.
 */
import { useEffect, useMemo, useState } from 'react';
import { accountingApi } from '../../services/api';
import { useT } from '../../i18n/LanguageContext';
import { inr } from '../../components/common/DashboardCharts';
import BranchSelect from '../../components/common/BranchSelect';

const iso = (d) => d.toISOString().slice(0, 10);
const monthStart = () => { const d = new Date(); return iso(new Date(d.getFullYear(), d.getMonth(), 1)); };
const fyStart = () => { const d = new Date(); const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1; return `${y}-04-01`; };

const S = {
  title:    { en: 'Sales Profitability', hi: 'बिक्री लाभ', hinglish: 'Sales Profitability' },
  from:     { en: 'From', hi: 'से', hinglish: 'From' },
  to:       { en: 'To', hi: 'तक', hinglish: 'To' },
  thisMonth:{ en: 'This month', hi: 'इस महीने', hinglish: 'This month' },
  thisFy:   { en: 'This FY', hi: 'इस वित्त वर्ष', hinglish: 'This FY' },
  netSales: { en: 'Net Sales', hi: 'शुद्ध बिक्री', hinglish: 'Net Sales' },
  cogs:     { en: 'Cost of Goods', hi: 'माल की लागत', hinglish: 'Cost of Goods' },
  profit:   { en: 'Gross Profit', hi: 'सकल लाभ', hinglish: 'Gross Profit' },
  margin:   { en: 'Margin', hi: 'मार्जिन', hinglish: 'Margin' },
  byInvoice:{ en: 'By Invoice', hi: 'इनवॉइस अनुसार', hinglish: 'By Invoice' },
  byItem:   { en: 'By Item', hi: 'आइटम अनुसार', hinglish: 'By Item' },
  invoiceNo:{ en: 'Invoice', hi: 'इनवॉइस', hinglish: 'Invoice' },
  date:     { en: 'Date', hi: 'दिनांक', hinglish: 'Date' },
  party:    { en: 'Party', hi: 'पार्टी', hinglish: 'Party' },
  item:     { en: 'Item', hi: 'आइटम', hinglish: 'Item' },
  qty:      { en: 'Qty', hi: 'मात्रा', hinglish: 'Qty' },
  sales:    { en: 'Sales', hi: 'बिक्री', hinglish: 'Sales' },
  none:     { en: 'No sales in this period.', hi: 'इस अवधि में कोई बिक्री नहीं।', hinglish: 'Is period mein koi sale nahi.' },
  loading:  { en: 'Loading…', hi: '…', hinglish: 'Loading…' },
  noCost:   { en: 'No cost data', hi: 'लागत नहीं', hinglish: 'No cost data' },
  coverage: { en: 'Margin covers', hi: 'मार्जिन कवरेज', hinglish: 'Margin covers' },
  ofSales:  { en: 'of sales', hi: 'बिक्री का', hinglish: 'of sales' },
  uncostedWarn: {
    en: 'of sales had no cost recorded (free-text lines, or items with no average cost yet). Those invoices are excluded from the margin above.',
    hi: 'बिक्री की लागत दर्ज नहीं है — वे ऊपर के मार्जिन में शामिल नहीं हैं।',
    hinglish: 'sales ki cost record nahi hai — woh margin mein shamil nahi hain.',
  },
};

const marginColor = (pct) => {
  if (pct == null) return 'var(--text3)';
  if (pct < 0) return 'var(--red, #DC2626)';
  if (pct < 15) return 'var(--amber, #B45309)';
  return 'var(--green, #059669)';
};
const fmtDate = (d) => {
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? (d || '—') : dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
};
const pct = (v) => (v == null ? '—' : `${v}%`);

export default function ProfitPage() {
  const t = useT(S);
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(iso(new Date()));
  const [branchId, setBranchId] = useState('');
  const [tab, setTab] = useState('invoice');
  const [data, setData] = useState(null);

  // `t` is a fresh ref each render (useT) — never a dependency.
  useEffect(() => {
    let cancelled = false;
    setData(null);
    accountingApi.profit({ from, to, ...(branchId ? { branchId } : {}) })
      .then((r) => { if (!cancelled) setData(r); })
      .catch(() => { if (!cancelled) setData({ summary: null, invoices: [], items: [] }); });
    return () => { cancelled = true; };
  }, [from, to, branchId]);

  const sum = data?.summary;
  const uncostedShare = useMemo(() => {
    if (!sum || !sum.netSales) return 0;
    return Math.round((sum.uncostedSales / sum.netSales) * 100);
  }, [sum]);

  const sel = { padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 12.5 };
  const INV_COLS = '95px minmax(120px, 1.4fr) minmax(120px, 1fr) 110px 110px 110px 80px';
  const ITEM_COLS = 'minmax(150px, 1.6fr) 90px 110px 110px 110px 80px';

  return (
    <div>
      <div className="flex items-center justify-between mb-4" style={{ flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>📈 {t('title')}</h2>
        <div className="flex" style={{ gap: 6, flexWrap: 'wrap' }}>
          <button className="btn btn-xs" style={sel} onClick={() => { setFrom(monthStart()); setTo(iso(new Date())); }}>{t('thisMonth')}</button>
          <button className="btn btn-xs" style={sel} onClick={() => { setFrom(fyStart()); setTo(iso(new Date())); }}>{t('thisFy')}</button>
        </div>
      </div>

      <div className="card flex items-center" style={{ gap: 10, padding: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: 'var(--text3)' }}>{t('from')}</span>
        <input className="input" type="date" style={{ width: 150 }} value={from} onChange={(e) => setFrom(e.target.value)} />
        <span style={{ fontSize: 12, color: 'var(--text3)' }}>{t('to')}</span>
        <input className="input" type="date" style={{ width: 150 }} value={to} onChange={(e) => setTo(e.target.value)} />
        <div style={{ marginLeft: 'auto', minWidth: 160 }}><BranchSelect value={branchId} onChange={setBranchId} allowAll /></div>
      </div>

      {!data && <div className="card" style={{ padding: 30, textAlign: 'center', color: 'var(--text3)' }}>{t('loading')}</div>}

      {data && sum && (
        <>
          <div className="card" style={{ padding: 16, marginBottom: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16 }}>
              <Tile label={t('netSales')} value={inr(sum.netSales)} />
              <Tile label={t('cogs')} value={inr(sum.cogs)} />
              <Tile label={t('profit')} value={inr(sum.grossProfit)} color={marginColor(sum.marginPct)} />
              <Tile label={t('margin')} value={pct(sum.marginPct)} color={marginColor(sum.marginPct)} />
              <Tile label={t('coverage')} value={pct(sum.coveragePct)} sub={t('ofSales')} />
            </div>
            {uncostedShare > 0 && (
              <div style={{ marginTop: 12, padding: '9px 12px', borderRadius: 8, background: 'rgba(245,158,11,.12)', color: 'var(--amber, #B45309)', fontSize: 12.5 }}>
                ⚠️ <b>{inr(sum.uncostedSales)}</b> ({uncostedShare}%) {t('uncostedWarn')}
              </div>
            )}
          </div>

          <div className="flex" style={{ gap: 2, borderBottom: '1px solid var(--border)', marginBottom: 12 }}>
            {[['invoice', t('byInvoice')], ['item', t('byItem')]].map(([k, label]) => (
              <button key={k} onClick={() => setTab(k)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: '10px 14px', fontSize: 13,
                  fontWeight: tab === k ? 700 : 500,
                  color: tab === k ? 'var(--blue, #C05621)' : 'var(--text2)',
                  borderBottom: tab === k ? '2px solid var(--blue, #C05621)' : '2px solid transparent',
                }}>{label}</button>
            ))}
          </div>

          {!data.invoices.length && <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>{t('none')}</div>}

          {!!data.invoices.length && tab === 'invoice' && (
            <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
              <div style={{ minWidth: 780 }}>
                <Head cols={INV_COLS} numericFrom={3} labels={[t('date'), t('invoiceNo'), t('party'), t('netSales'), t('cogs'), t('profit'), t('margin')]} />
                {data.invoices.map((r) => (
                  <div key={r.id} style={{ display: 'grid', gridTemplateColumns: INV_COLS, gap: 8, padding: '9px 12px', borderBottom: '1px solid var(--border)', fontSize: 12.5, alignItems: 'center' }}>
                    <div style={{ color: 'var(--text2)' }}>{fmtDate(r.date)}</div>
                    <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.invoiceNo}</div>
                    <div style={{ color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.clientName}</div>
                    <div style={{ textAlign: 'right' }}>{inr(r.netSales)}</div>
                    <div style={{ textAlign: 'right', color: 'var(--text2)' }}>{r.cogs == null ? '—' : inr(r.cogs)}</div>
                    <div style={{ textAlign: 'right', fontWeight: 700, color: marginColor(r.marginPct) }}>
                      {r.grossProfit == null ? <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text3)' }}>{t('noCost')}</span> : inr(r.grossProfit)}
                    </div>
                    <div style={{ textAlign: 'right', fontWeight: 700, color: marginColor(r.marginPct) }}>{pct(r.marginPct)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'item' && (
            <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
              <div style={{ minWidth: 660 }}>
                <Head cols={ITEM_COLS} numericFrom={1} labels={[t('item'), t('qty'), t('sales'), t('cogs'), t('profit'), t('margin')]} />
                {!data.items.length && <div style={{ padding: 30, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>{t('none')}</div>}
                {data.items.map((r, i) => (
                  <div key={(r.itemId || r.name) + i} style={{ display: 'grid', gridTemplateColumns: ITEM_COLS, gap: 8, padding: '9px 12px', borderBottom: '1px solid var(--border)', fontSize: 12.5, alignItems: 'center' }}>
                    <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</div>
                    <div style={{ textAlign: 'right', color: 'var(--text2)' }}>{r.qty}</div>
                    <div style={{ textAlign: 'right' }}>{inr(r.sales)}</div>
                    <div style={{ textAlign: 'right', color: 'var(--text2)' }}>{inr(r.cogs)}</div>
                    <div style={{ textAlign: 'right', fontWeight: 700, color: marginColor(r.marginPct) }}>{inr(r.grossProfit)}</div>
                    <div style={{ textAlign: 'right', fontWeight: 700, color: marginColor(r.marginPct) }}>{pct(r.marginPct)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Tile({ label, value, color, sub }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: .3 }}>
        {label}{sub ? <span style={{ textTransform: 'none', fontWeight: 500 }}> {sub}</span> : null}
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, color: color || 'var(--text)' }}>{value}</div>
    </div>
  );
}

// `numericFrom` is the index at which columns start being amounts and so become
// right-aligned, matching the body rows.
function Head({ cols, labels, numericFrom }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 8, padding: '9px 12px', fontSize: 11, textTransform: 'uppercase', color: 'var(--text3)', fontWeight: 700, borderBottom: '1px solid var(--border)' }}>
      {labels.map((l, i) => (
        <div key={l} style={{ textAlign: i >= numericFrom ? 'right' : 'left' }}>{l}</div>
      ))}
    </div>
  );
}
