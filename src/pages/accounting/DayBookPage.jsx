/**
 * Day Book — /accounting/daybook. Tally's home screen: everything that hit the
 * books on a given day, one row per VOUCHER, with day subtotals.
 *
 * Deliberately different from the Journal page (/accounting/entries), which is
 * line-oriented (one row per ledger line, filterable by account) and is where
 * manual vouchers are created. This one answers "what happened today?" — it
 * opens on today, steps a day at a time with ◀ ▶, groups by date and totals
 * each day. Both read the same /ledger/entries projection, so they can never
 * disagree.
 *
 * Read-only by design: a voucher is edited through its source document.
 */
import { useEffect, useMemo, useState } from 'react';
import { ledgerApi } from '../../services/api';
import { useT } from '../../i18n/LanguageContext';
import { inr } from '../../components/common/DashboardCharts';
import BranchSelect from '../../components/common/BranchSelect';

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (isoStr, n) => { const d = new Date(isoStr); d.setDate(d.getDate() + n); return iso(d); };
const today = () => iso(new Date());

const S = {
  title:    { en: 'Day Book', hi: 'दिन-बही', hinglish: 'Day Book' },
  today:    { en: 'Today', hi: 'आज', hinglish: 'Aaj' },
  yesterday:{ en: 'Yesterday', hi: 'कल', hinglish: 'Kal' },
  last7:    { en: 'Last 7 days', hi: 'पिछले 7 दिन', hinglish: 'Last 7 days' },
  thisMonth:{ en: 'This month', hi: 'इस महीने', hinglish: 'This month' },
  from:     { en: 'From', hi: 'से', hinglish: 'From' },
  to:       { en: 'To', hi: 'तक', hinglish: 'To' },
  allTypes: { en: 'All voucher types', hi: 'सभी वाउचर', hinglish: 'All voucher types' },
  vchType:  { en: 'Voucher Type', hi: 'वाउचर प्रकार', hinglish: 'Voucher Type' },
  particulars:{ en: 'Particulars', hi: 'विवरण', hinglish: 'Particulars' },
  reference:{ en: 'Reference', hi: 'संदर्भ', hinglish: 'Reference' },
  debit:    { en: 'Debit', hi: 'डेबिट', hinglish: 'Debit' },
  credit:   { en: 'Credit', hi: 'क्रेडिट', hinglish: 'Credit' },
  none:     { en: 'Nothing was posted in this period.', hi: 'इस अवधि में कुछ नहीं।', hinglish: 'Is period mein kuch post nahi hua.' },
  loading:  { en: 'Loading…', hi: '…', hinglish: 'Loading…' },
  vouchers: { en: 'vouchers', hi: 'वाउचर', hinglish: 'vouchers' },
  dayTotal: { en: 'Day total', hi: 'दिन का कुल', hinglish: 'Day total' },
  grand:    { en: 'Total for the period', hi: 'अवधि का कुल', hinglish: 'Period total' },
  prevDay:  { en: 'Previous day', hi: 'पिछला दिन', hinglish: 'Previous day' },
  nextDay:  { en: 'Next day', hi: 'अगला दिन', hinglish: 'Next day' },
  truncated:{ en: 'Showing the most recent 2000 vouchers — narrow the dates to see the rest.', hi: 'तारीख सीमित करें।', hinglish: 'Dates narrow karein.' },
};

// Voucher type → how it reads in a Day Book, matching Tally's vocabulary.
const VCH_LABEL = {
  invoice: 'Sales', 'credit-note': 'Credit Note', 'debit-note': 'Debit Note',
  payment: 'Receipt', expense: 'Payment', purchase: 'Purchase',
  'purchase-order': 'Purchase', 'stock-out': 'Stock Journal', 'stock-in': 'Stock Journal',
  'opening-balance': 'Opening Balance', tds: 'TDS', journal: 'Journal',
  receipt: 'Receipt', contra: 'Contra',
};
const vchLabel = (t) => VCH_LABEL[t] || String(t || 'journal').replace(/[-_]/g, ' ').replace(/^./, (c) => c.toUpperCase());

const VCH_COLOR = {
  Sales: 'var(--green, #059669)', Receipt: 'var(--blue, #2563EB)',
  Payment: 'var(--red, #DC2626)', Purchase: 'var(--amber, #B45309)',
};

const fmtDay = (d) => {
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
};

export default function DayBookPage() {
  const t = useT(S);
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(today());
  const [type, setType] = useState('all');
  const [branchId, setBranchId] = useState('');
  const [data, setData] = useState(null);
  const [accounts, setAccounts] = useState([]);

  useEffect(() => {
    ledgerApi.accounts().then((r) => setAccounts(Array.isArray(r) ? r : (r?.accounts || []))).catch(() => setAccounts([]));
  }, []);

  // `t` from useT() is a fresh reference every render — keeping it out of the
  // dep array is what stops this from becoming an infinite fetch loop.
  useEffect(() => {
    let cancelled = false;
    setData(null);
    ledgerApi.entries({ from, to, limit: 2000, ...(branchId ? { branchId } : {}) })
      .then((r) => { if (!cancelled) setData(r); })
      .catch(() => { if (!cancelled) setData({ entries: [], total: 0 }); });
    return () => { cancelled = true; };
  }, [from, to, branchId]);

  const accountName = useMemo(() => {
    const m = {};
    accounts.forEach((a) => { m[a.key || a.id] = a.name; });
    return (key) => m[key] || String(key || '').replace(/^expense:/, '').replace(/[-_]/g, ' ');
  }, [accounts]);

  const typeOptions = useMemo(() => {
    const seen = new Set();
    (data?.entries || []).forEach((e) => seen.add(vchLabel(e.type)));
    return [...seen].sort();
  }, [data]);

  // One row per voucher, grouped by date. The API already sorts date desc.
  const days = useMemo(() => {
    const rows = (data?.entries || [])
      .filter((e) => type === 'all' || vchLabel(e.type) === type)
      .map((e) => {
        const lines = e.lines || [];
        const dr = round2(lines.reduce((s, l) => s + (l.dr || 0), 0));
        const cr = round2(lines.reduce((s, l) => s + (l.cr || 0), 0));
        // Particulars: debited head(s) → credited head(s), the way a voucher reads.
        const drNames = [...new Set(lines.filter((l) => l.dr > 0).map((l) => accountName(l.account)))];
        const crNames = [...new Set(lines.filter((l) => l.cr > 0).map((l) => accountName(l.account)))];
        return { id: e.id, date: e.date, label: vchLabel(e.type), dr, cr, drNames, crNames, ref: e.ref, memo: e.memo };
      });
    const map = new Map();
    rows.forEach((r) => {
      if (!map.has(r.date)) map.set(r.date, []);
      map.get(r.date).push(r);
    });
    return [...map.entries()].map(([date, vouchers]) => ({
      date, vouchers,
      dr: round2(vouchers.reduce((s, v) => s + v.dr, 0)),
      cr: round2(vouchers.reduce((s, v) => s + v.cr, 0)),
    }));
  }, [data, type, accountName]);

  const grand = useMemo(() => ({
    dr: round2(days.reduce((s, d) => s + d.dr, 0)),
    cr: round2(days.reduce((s, d) => s + d.cr, 0)),
    count: days.reduce((s, d) => s + d.vouchers.length, 0),
  }), [days]);

  const setBoth = (d) => { setFrom(d); setTo(d); };
  const singleDay = from === to;
  const sel = { padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 12.5 };
  const COLS = '110px minmax(150px, 1fr) 130px 120px 120px';

  return (
    <div>
      <div className="flex items-center justify-between mb-4" style={{ flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>📓 {t('title')}</h2>
        <div className="flex" style={{ gap: 6, flexWrap: 'wrap' }}>
          <button className="btn btn-xs" style={sel} onClick={() => setBoth(today())}>{t('today')}</button>
          <button className="btn btn-xs" style={sel} onClick={() => setBoth(addDays(today(), -1))}>{t('yesterday')}</button>
          <button className="btn btn-xs" style={sel} onClick={() => { setFrom(addDays(today(), -6)); setTo(today()); }}>{t('last7')}</button>
          <button className="btn btn-xs" style={sel} onClick={() => { const d = new Date(); setFrom(iso(new Date(d.getFullYear(), d.getMonth(), 1))); setTo(today()); }}>{t('thisMonth')}</button>
        </div>
      </div>

      <div className="card flex items-center" style={{ gap: 10, padding: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        {/* Day stepper — only meaningful while looking at a single day */}
        <button className="btn btn-sm btn-ghost" title={t('prevDay')}
          onClick={() => { const d = addDays(from, -1); singleDay ? setBoth(d) : setFrom(d); }}>◀</button>
        <input className="input" type="date" style={{ width: 150 }} value={from} onChange={(e) => setFrom(e.target.value)} />
        <span style={{ color: 'var(--text3)', fontSize: 12 }}>{t('to')}</span>
        <input className="input" type="date" style={{ width: 150 }} value={to} onChange={(e) => setTo(e.target.value)} />
        <button className="btn btn-sm btn-ghost" title={t('nextDay')}
          onClick={() => { const d = addDays(to, 1); singleDay ? setBoth(d) : setTo(d); }}>▶</button>

        <select style={{ ...sel, marginLeft: 'auto' }} value={type} onChange={(e) => setType(e.target.value)}>
          <option value="all">{t('allTypes')}</option>
          {typeOptions.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <BranchSelect value={branchId} onChange={setBranchId} allowAll />
      </div>

      {!data && <div className="card" style={{ padding: 30, textAlign: 'center', color: 'var(--text3)' }}>{t('loading')}</div>}
      {data && !days.length && <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>{t('none')}</div>}

      {data && !!days.length && (
        <>
          <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
            <div style={{ minWidth: 700 }}>
              <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: 8, padding: '9px 12px', fontSize: 11, textTransform: 'uppercase', color: 'var(--text3)', fontWeight: 700, borderBottom: '1px solid var(--border)' }}>
                <div>{t('vchType')}</div><div>{t('particulars')}</div><div>{t('reference')}</div>
                <div style={{ textAlign: 'right' }}>{t('debit')}</div><div style={{ textAlign: 'right' }}>{t('credit')}</div>
              </div>

              {days.map((day) => (
                <div key={day.date}>
                  <div className="flex items-center justify-between"
                    style={{ padding: '8px 12px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)', fontSize: 12.5, fontWeight: 700 }}>
                    <span>{fmtDay(day.date)}</span>
                    <span style={{ color: 'var(--text3)', fontWeight: 500 }}>{day.vouchers.length} {t('vouchers')}</span>
                  </div>

                  {day.vouchers.map((v) => (
                    <div key={v.id} style={{ display: 'grid', gridTemplateColumns: COLS, gap: 8, padding: '9px 12px', borderBottom: '1px solid var(--border)', fontSize: 12.5, alignItems: 'center' }}>
                      <div>
                        <span style={{ fontWeight: 700, color: VCH_COLOR[v.label] || 'var(--text)' }}>{v.label}</span>
                      </div>
                      <div style={{ minWidth: 0, color: 'var(--text2)' }}>
                        <span style={{ color: 'var(--text)' }}>{v.drNames.join(', ') || '—'}</span>
                        <span style={{ color: 'var(--text3)' }}> → {v.crNames.join(', ') || '—'}</span>
                        {v.memo && <span style={{ display: 'block', fontSize: 11, color: 'var(--text3)' }}>{v.memo}</span>}
                      </div>
                      <div style={{ color: 'var(--text3)', fontSize: 11.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {v.ref ? v.ref.collection : '—'}
                      </div>
                      <div style={{ textAlign: 'right', fontWeight: 600 }}>{inr(v.dr)}</div>
                      <div style={{ textAlign: 'right', fontWeight: 600, color: 'var(--green, #059669)' }}>{inr(v.cr)}</div>
                    </div>
                  ))}

                  <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: 8, padding: '8px 12px', borderBottom: '2px solid var(--border)', fontSize: 12.5, fontWeight: 700 }}>
                    <div style={{ gridColumn: '1 / 4', color: 'var(--text3)' }}>{t('dayTotal')}</div>
                    <div style={{ textAlign: 'right' }}>{inr(day.dr)}</div>
                    <div style={{ textAlign: 'right' }}>{inr(day.cr)}</div>
                  </div>
                </div>
              ))}

              <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: 8, padding: '12px', fontSize: 13.5, fontWeight: 800 }}>
                <div style={{ gridColumn: '1 / 4' }}>{t('grand')} · {grand.count} {t('vouchers')}</div>
                <div style={{ textAlign: 'right' }}>{inr(grand.dr)}</div>
                <div style={{ textAlign: 'right' }}>{inr(grand.cr)}</div>
              </div>
            </div>
          </div>

          {data.hasMore && (
            <div style={{ marginTop: 10, fontSize: 12, color: 'var(--amber, #B45309)' }}>⚠️ {t('truncated')}</div>
          )}
        </>
      )}
    </div>
  );
}
