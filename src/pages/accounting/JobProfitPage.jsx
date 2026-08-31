/**
 * Job Profitability — /accounting/job-profit. Each job treated as a cost centre.
 *
 * Revenue is the invoice raised against the job (net of tax and discount), or
 * the job's own quoted amount while it's still unbilled. Cost is the material
 * consumed at department completion, valued at moving-average and read from the
 * ledger's COGS lines — so it agrees with the P&L rather than being re-derived.
 *
 * IMPORTANT: this is a MATERIAL margin, not a net margin. Nothing in the system
 * records labour hours or a machine rate against a job, so wages, power and
 * machine time are NOT deducted. The page says so on screen, because a 70%
 * "profit" that silently ignores labour is worse than no number at all.
 */
import { useEffect, useMemo, useState } from 'react';
import { accountingApi } from '../../services/api';
import { useT } from '../../i18n/LanguageContext';
import { inr } from '../../components/common/DashboardCharts';

const iso = (d) => d.toISOString().slice(0, 10);
const monthStart = () => { const d = new Date(); return iso(new Date(d.getFullYear(), d.getMonth(), 1)); };
const fyStart = () => { const d = new Date(); const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1; return `${y}-04-01`; };

const STAGES = ['enquiry', 'designer', 'jobsetter', 'production', 'qc', 'dispatch', 'delivered'];

const S = {
  title:    { en: 'Job Profitability', hi: 'जॉब लाभप्रदता', hinglish: 'Job Profitability' },
  from:     { en: 'From', hi: 'से', hinglish: 'From' },
  to:       { en: 'To', hi: 'तक', hinglish: 'To' },
  thisMonth:{ en: 'This month', hi: 'इस महीने', hinglish: 'This month' },
  thisFy:   { en: 'This FY', hi: 'इस वित्त वर्ष', hinglish: 'This FY' },
  allStages:{ en: 'All stages', hi: 'सभी चरण', hinglish: 'All stages' },
  revenue:  { en: 'Revenue', hi: 'आय', hinglish: 'Revenue' },
  material: { en: 'Material Cost', hi: 'सामग्री लागत', hinglish: 'Material Cost' },
  margin:   { en: 'Material Margin', hi: 'सामग्री मार्जिन', hinglish: 'Material Margin' },
  marginPct:{ en: 'Margin %', hi: 'मार्जिन %', hinglish: 'Margin %' },
  covered:  { en: 'Costed', hi: 'लागत दर्ज', hinglish: 'Costed' },
  jobNo:    { en: 'Job', hi: 'जॉब', hinglish: 'Job' },
  client:   { en: 'Client', hi: 'ग्राहक', hinglish: 'Client' },
  stage:    { en: 'Stage', hi: 'चरण', hinglish: 'Stage' },
  billed:   { en: 'Billed', hi: 'बिल हुआ', hinglish: 'Billed' },
  quoted:   { en: 'Quoted', hi: 'कोटेड', hinglish: 'Quoted' },
  noCost:   { en: 'No material logged', hi: 'सामग्री दर्ज नहीं', hinglish: 'Material log nahi hua' },
  none:     { en: 'No jobs in this period.', hi: 'इस अवधि में कोई जॉब नहीं।', hinglish: 'Is period mein koi job nahi.' },
  loading:  { en: 'Loading…', hi: '…', hinglish: 'Loading…' },
  labourWarn: {
    en: 'Material only — labour, power and machine time are NOT deducted. Nothing in the system records hours against a job, so treat this as gross material margin, not profit.',
    hi: 'केवल सामग्री — मजदूरी, बिजली और मशीन समय शामिल नहीं हैं।',
    hinglish: 'Sirf material — labour, power aur machine time deduct nahi hue hain.',
  },
  coverageWarn: {
    en: 'of revenue comes from jobs where no material was logged. Those jobs are excluded from the margin above.',
    hi: 'आय उन जॉब्स से है जिनमें सामग्री दर्ज नहीं हुई।',
    hinglish: 'revenue un jobs se hai jinme material log nahi hua.',
  },
};

const marginColor = (pct) => {
  if (pct == null) return 'var(--text3)';
  if (pct < 0) return 'var(--red, #DC2626)';
  if (pct < 20) return 'var(--amber, #B45309)';
  return 'var(--green, #059669)';
};
const pct = (v) => (v == null ? '—' : `${v}%`);

export default function JobProfitPage() {
  const t = useT(S);
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(iso(new Date()));
  const [stage, setStage] = useState('');
  const [data, setData] = useState(null);
  const [sort, setSort] = useState('margin'); // margin | revenue | date

  // `t` is unstable per render (useT) — never a dependency.
  useEffect(() => {
    let cancelled = false;
    setData(null);
    accountingApi.jobProfit({ from, to, ...(stage ? { stage } : {}) })
      .then((r) => { if (!cancelled) setData(r); })
      .catch(() => { if (!cancelled) setData({ summary: null, jobs: [] }); });
    return () => { cancelled = true; };
  }, [from, to, stage]);

  const sum = data?.summary;
  const rows = useMemo(() => {
    const list = [...(data?.jobs || [])];
    if (sort === 'revenue') list.sort((a, b) => b.revenue - a.revenue);
    else if (sort === 'date') list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    else {
      // Costed jobs first, worst margin at the top — that's what needs attention.
      list.sort((a, b) => {
        if (a.materialMargin == null && b.materialMargin == null) return 0;
        if (a.materialMargin == null) return 1;
        if (b.materialMargin == null) return -1;
        return (a.marginPct ?? 0) - (b.marginPct ?? 0);
      });
    }
    return list;
  }, [data, sort]);

  const uncoveredPct = sum && sum.coveragePct != null ? round(100 - sum.coveragePct) : 0;
  const sel = { padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 12.5 };
  const COLS = '110px minmax(120px, 1.3fr) 100px 110px 110px 110px 80px';

  return (
    <div>
      <div className="flex items-center justify-between mb-4" style={{ flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>🏭 {t('title')}</h2>
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
        <select style={sel} value={stage} onChange={(e) => setStage(e.target.value)}>
          <option value="">{t('allStages')}</option>
          {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select style={{ ...sel, marginLeft: 'auto' }} value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="margin">Worst margin first</option>
          <option value="revenue">Highest revenue first</option>
          <option value="date">Newest first</option>
        </select>
      </div>

      <div className="card" style={{ padding: '9px 12px', marginBottom: 12, background: 'rgba(245,158,11,.10)', color: 'var(--amber, #B45309)', fontSize: 12.5 }}>
        ⚠️ {t('labourWarn')}
      </div>

      {!data && <div className="card" style={{ padding: 30, textAlign: 'center', color: 'var(--text3)' }}>{t('loading')}</div>}
      {data && !rows.length && <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>{t('none')}</div>}

      {data && sum && !!rows.length && (
        <>
          <div className="card" style={{ padding: 16, marginBottom: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16 }}>
              <Tile label={t('revenue')} value={inr(sum.revenue)} />
              <Tile label={t('material')} value={inr(sum.materialCost)} />
              <Tile label={t('margin')} value={inr(sum.materialMargin)} color={marginColor(sum.marginPct)} />
              <Tile label={t('marginPct')} value={pct(sum.marginPct)} color={marginColor(sum.marginPct)} />
              <Tile label={t('covered')} value={`${sum.jobsWithCost}/${sum.jobs}`} />
            </div>
            {uncoveredPct > 0 && (
              <div style={{ marginTop: 12, padding: '9px 12px', borderRadius: 8, background: 'var(--surface2)', color: 'var(--text2)', fontSize: 12.5 }}>
                {uncoveredPct}% {t('coverageWarn')}
              </div>
            )}
          </div>

          <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
            <div style={{ minWidth: 780 }}>
              <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: 8, padding: '9px 12px', fontSize: 11, textTransform: 'uppercase', color: 'var(--text3)', fontWeight: 700, borderBottom: '1px solid var(--border)' }}>
                <div>{t('jobNo')}</div><div>{t('client')}</div><div>{t('stage')}</div>
                <div style={{ textAlign: 'right' }}>{t('revenue')}</div>
                <div style={{ textAlign: 'right' }}>{t('material')}</div>
                <div style={{ textAlign: 'right' }}>{t('margin')}</div>
                <div style={{ textAlign: 'right' }}>%</div>
              </div>
              {rows.map((r) => (
                <div key={r.id} style={{ display: 'grid', gridTemplateColumns: COLS, gap: 8, padding: '9px 12px', borderBottom: '1px solid var(--border)', fontSize: 12.5, alignItems: 'center' }}>
                  <div style={{ fontWeight: 600 }}>
                    {r.jobNo || '—'}
                    <span style={{ display: 'block', fontSize: 10.5, fontWeight: 500, color: r.billed ? 'var(--green, #059669)' : 'var(--text3)' }}>
                      {r.billed ? `${t('billed')} · ${r.invoiceNo}` : t('quoted')}
                    </span>
                  </div>
                  <div style={{ color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.clientName}</div>
                  <div style={{ color: 'var(--text3)', textTransform: 'capitalize' }}>{r.stage || '—'}</div>
                  <div style={{ textAlign: 'right' }}>{inr(r.revenue)}</div>
                  <div style={{ textAlign: 'right', color: 'var(--text2)' }}>{r.materialCost > 0 ? inr(r.materialCost) : '—'}</div>
                  <div style={{ textAlign: 'right', fontWeight: 700, color: marginColor(r.marginPct) }}>
                    {r.materialMargin == null
                      ? <span style={{ fontSize: 10.5, fontWeight: 500, color: 'var(--text3)' }}>{t('noCost')}</span>
                      : inr(r.materialMargin)}
                  </div>
                  <div style={{ textAlign: 'right', fontWeight: 700, color: marginColor(r.marginPct) }}>{pct(r.marginPct)}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const round = (n) => Math.round(Number(n) || 0);

function Tile({ label, value, color }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: .3 }}>{label}</div>
      <div style={{ fontSize: 19, fontWeight: 800, color: color || 'var(--text)' }}>{value}</div>
    </div>
  );
}
