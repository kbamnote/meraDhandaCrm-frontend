/**
 * AdminDashboard — business-overview dashboard for owner/admin/superadmin/manager.
 * Pulls a single analyticsApi.overview() snapshot and renders KPIs, a 12-month
 * revenue column chart, jobs-by-stage + sales-funnel bar lists, and quick links.
 * Uses only the shared dependency-free primitives from DashboardCharts.
 */
import { useEffect, useState } from 'react';
import { analyticsApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  DashHeader, Kpi, KpiGrid, Section, BarList, ColumnChart, QuickLinks, inr,
} from '../../components/common/DashboardCharts';

const STAGE_LABELS = {
  enquiry: 'Enquiry', designer: 'Designer', jobsetter: 'Jobsetter',
  production: 'Production', qc: 'QC', dispatch: 'Dispatch',
  delivered: 'Delivered', hold: 'Hold', cancelled: 'Cancelled',
};

export default function AdminDashboard() {
  const { profile } = useAuth();
  const [data, setData] = useState(null);

  useEffect(() => {
    analyticsApi.overview().then(setData).catch(() => {});
  }, []);

  const k = data?.kpis || {};
  const funnel = data?.salesFunnel || {};
  const jobsByStage = data?.jobsByStage || {};
  const monthlyRevenue = Array.isArray(data?.monthlyRevenue) ? data.monthlyRevenue : [];

  const revenueCols = monthlyRevenue.map((m) => ({
    label: (m && m.month ? String(m.month) : '').slice(5),
    value: Number(m && m.revenue) || 0,
  }));

  const stageItems = Object.keys(STAGE_LABELS).map((key) => ({
    label: STAGE_LABELS[key],
    value: Number(jobsByStage[key]) || 0,
  }));

  const funnelItems = [
    { label: 'Won', value: Number(funnel.won) || 0, color: 'var(--green)' },
    { label: 'Lost', value: Number(funnel.lost) || 0, color: 'var(--red)' },
    { label: 'Pending', value: Number(funnel.pending) || 0, color: 'var(--amber)' },
  ];

  return (
    <div data-legacy-id="page-dashboard">
      <DashHeader
        title="Business Overview"
        subtitle={`Welcome${profile?.name ? `, ${profile.name}` : ''}`}
      />

      <KpiGrid>
        <Kpi label="Revenue" value={inr(k.revenue || 0)} color="var(--blue)" icon="💰" />
        <Kpi label="Collected" value={inr(k.collected || 0)} color="var(--green)" />
        <Kpi label="Outstanding" value={inr(k.outstanding || 0)} color="var(--amber)" />
        <Kpi label="Profit" value={inr(k.profit || 0)} color={(Number(k.profit) || 0) >= 0 ? 'var(--green)' : 'var(--red)'} />
        <Kpi label="Jobs" value={k.jobsTotal || 0} />
        <Kpi label="Delivered" value={k.delivered || 0} color="var(--green)" />
        <Kpi label="Leads" value={k.leads || 0} />
        <Kpi label="Conversion" value={`${k.conversion || 0}%`} />
      </KpiGrid>

      <Section title="Revenue — last 12 months">
        <ColumnChart data={revenueCols} money />
      </Section>

      <Section title="Jobs by stage">
        <BarList items={stageItems} />
      </Section>

      <Section title="Sales funnel">
        <BarList items={funnelItems} />
      </Section>

      <QuickLinks
        links={[
          { to: '/analytics', label: 'Analytics' },
          { to: '/job-cards', label: 'Job Cards' },
          { to: '/accounting', label: 'Accounting' },
          { to: '/permissions', label: 'Team' },
        ]}
      />
    </div>
  );
}
