/**
 * Analytics — consolidated business dashboard (KPIs, monthly revenue trend,
 * jobs-by-stage, sales funnel) from analyticsApi.overview, with an FY/all filter.
 * Dependency-free charts (CSS/SVG bars) to keep the bundle lean.
 */
import { useEffect, useState } from 'react';
import { analyticsApi } from '../services/api';
import { useT } from '../i18n/LanguageContext';

const inr = (n) => '₹' + (Math.round((Number(n) || 0) * 100) / 100).toLocaleString('en-IN');
const RUST = '#C05621';

function currentFY() {
  const d = new Date();
  const startY = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return { from: `${startY}-04-01`, to: `${startY + 1}-03-31`, label: `FY ${String(startY).slice(-2)}-${String(startY + 1).slice(-2)}` };
}

const S = {
  title:   { en: '📊 Analytics', hi: '📊 एनालिटिक्स', hinglish: '📊 Analytics', gu: '📊 એનાલિટિક્સ', mr: '📊 अॅनालिटिक्स', mwr: '📊 एनालिटिक्स' },
  all:     { en: 'All time', hi: 'सभी समय', hinglish: 'All time', gu: 'બધો સમય', mr: 'सर्व काळ', mwr: 'सगळो टैम' },
  revenue: { en: 'Revenue', hi: 'रेवेन्यू', hinglish: 'Revenue', gu: 'આવક', mr: 'महसूल', mwr: 'रेवेन्यू' },
  collected:{ en: 'Collected', hi: 'वसूल', hinglish: 'Collected', gu: 'વસૂલ', mr: 'जमा', mwr: 'वसूल' },
  outstanding:{ en: 'Outstanding', hi: 'बकाया', hinglish: 'Outstanding', gu: 'બાકી', mr: 'थकबाकी', mwr: 'बकाया' },
  profit:  { en: 'Profit', hi: 'लाभ', hinglish: 'Profit', gu: 'નફો', mr: 'नफा', mwr: 'लाभ' },
  jobs:    { en: 'Jobs', hi: 'जॉब', hinglish: 'Jobs', gu: 'જોબ', mr: 'जॉब', mwr: 'जॉब' },
  delivered:{ en: 'Delivered', hi: 'डिलीवर', hinglish: 'Delivered', gu: 'ડિલિવર્ડ', mr: 'डिलिव्हर्ड', mwr: 'डिलीवर' },
  leads:   { en: 'Leads', hi: 'लीड्स', hinglish: 'Leads', gu: 'લીડ્સ', mr: 'लीड्स', mwr: 'लीड्स' },
  conversion:{ en: 'Conversion', hi: 'कन्वर्ज़न', hinglish: 'Conversion', gu: 'કન્વર્ઝન', mr: 'रूपांतर', mwr: 'कन्वर्ज़न' },
  monthlyRev:{ en: 'Monthly revenue (12 mo)', hi: 'मासिक रेवेन्यू (12 माह)', hinglish: 'Monthly revenue (12 mo)', gu: 'માસિક આવક (12 મહિના)', mr: 'मासिक महसूल (12 महिने)', mwr: 'मासिक रेवेन्यू (12 महीना)' },
  byStage: { en: 'Jobs by stage', hi: 'स्टेज अनुसार जॉब', hinglish: 'Jobs by stage', gu: 'સ્ટેજ પ્રમાણે જોબ', mr: 'स्टेजनुसार जॉब', mwr: 'स्टेज अनुसार जॉब' },
  funnel:  { en: 'Sales funnel', hi: 'सेल्स फनल', hinglish: 'Sales funnel', gu: 'સેલ્સ ફનલ', mr: 'सेल्स फनेल', mwr: 'सेल्स फनल' },
  won:     { en: 'Won', hi: 'जीते', hinglish: 'Won', gu: 'જીત્યા', mr: 'जिंकले', mwr: 'जीत्या' },
  lost:    { en: 'Lost', hi: 'हारे', hinglish: 'Lost', gu: 'હાર્યા', mr: 'हरले', mwr: 'हार्या' },
  pending: { en: 'Pending', hi: 'पेंडिंग', hinglish: 'Pending', gu: 'પેન્ડિંગ', mr: 'प्रलंबित', mwr: 'पेंडिंग' },
  noData:  { en: 'No data in this period.', hi: 'इस अवधि में डेटा नहीं।', hinglish: 'Is period mein data nahi.', gu: 'આ સમયગાળામાં ડેટા નથી.', mr: 'या कालावधीत डेटा नाही.', mwr: 'इण अवधि मांय डेटा कोनी।' },
};

const STAGE_COLOR = { enquiry: '#6B7280', designer: '#8B5CF6', jobsetter: '#0EA5E9', production: '#F59E0B', qc: '#CA8A04', dispatch: '#3B82F6', delivered: '#16A34A', hold: '#9CA3AF', cancelled: '#DC2626' };

export default function AnalyticsPage() {
  const t = useT(S);
  const fy = currentFY();
  const [range, setRange] = useState('fy');
  const [data, setData] = useState(null);

  useEffect(() => {
    const params = range === 'fy' ? { from: fy.from, to: fy.to } : {};
    analyticsApi.overview(params).then(setData).catch(() => setData(null));
  }, [range]); // eslint-disable-line

  const k = data?.kpis;
  const stageData = data ? Object.entries(data.jobsByStage).filter(([, v]) => v > 0) : [];
  const maxStage = Math.max(1, ...stageData.map(([, v]) => v));
  const maxRev = data ? Math.max(1, ...data.monthlyRevenue.map((m) => m.revenue)) : 1;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>{t('title')}</h2>
        <div style={{ display: 'flex', gap: 6 }}>
          {[['fy', fy.label], ['all', t('all')]].map(([k2, label]) => (
            <button key={k2} className="btn btn-xs" onClick={() => setRange(k2)}
              style={{ background: range === k2 ? RUST : 'var(--surface2)', color: range === k2 ? '#fff' : 'var(--text2)', border: 'none', borderRadius: 12 }}>{label}</button>
          ))}
        </div>
      </div>

      {!data ? <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>…</div> : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginBottom: 16 }}>
            <Kpi label={t('revenue')} value={inr(k.revenue)} color="var(--green)" />
            <Kpi label={t('collected')} value={inr(k.collected)} />
            <Kpi label={t('outstanding')} value={inr(k.outstanding)} color="var(--red)" />
            <Kpi label={t('profit')} value={inr(k.profit)} color={k.profit >= 0 ? 'var(--green)' : 'var(--red)'} />
            <Kpi label={t('jobs')} value={k.jobsTotal} />
            <Kpi label={t('delivered')} value={k.delivered} color="var(--green)" />
            <Kpi label={t('leads')} value={k.leads} />
            <Kpi label={t('conversion')} value={`${k.conversion}%`} />
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{t('monthlyRev')}</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 160 }}>
              {data.monthlyRevenue.map((m, i) => (
                <div key={i} title={inr(m.revenue)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                  <div style={{ width: '72%', height: `${Math.round((m.revenue / maxRev) * 100)}%`, background: RUST, borderRadius: '3px 3px 0 0', minHeight: m.revenue > 0 ? 3 : 0 }} />
                  <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 4 }}>{m.month.slice(5)}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            <div className="card">
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>{t('byStage')}</div>
              {!stageData.length && <div style={{ color: 'var(--text3)', fontSize: 13 }}>{t('noData')}</div>}
              {stageData.map(([stage, count]) => (
                <Bar key={stage} label={stage} value={count} max={maxStage} color={STAGE_COLOR[stage] || RUST} />
              ))}
            </div>
            <div className="card">
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>{t('funnel')}</div>
              <Bar label={t('leads')} value={data.salesFunnel.total} max={data.salesFunnel.total} color="#6B7280" />
              <Bar label={t('won')} value={data.salesFunnel.won} max={data.salesFunnel.total} color="#16A34A" />
              <Bar label={t('lost')} value={data.salesFunnel.lost} max={data.salesFunnel.total} color="#DC2626" />
              <Bar label={t('pending')} value={data.salesFunnel.pending} max={data.salesFunnel.total} color="#F59E0B" />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, color }) {
  return (
    <div className="card" style={{ padding: 14 }}>
      <div style={{ fontSize: 20, fontWeight: 800, color: color || 'var(--text)' }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>{label}</div>
    </div>
  );
}

function Bar({ label, value, max, color }) {
  const pct = max ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}><span style={{ textTransform: 'capitalize' }}>{label}</span><span>{value}</span></div>
      <div style={{ height: 8, background: 'var(--surface2)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color }} />
      </div>
    </div>
  );
}
