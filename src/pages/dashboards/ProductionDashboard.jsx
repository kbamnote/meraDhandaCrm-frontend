/**
 * Production floor dashboard — for jobsetters and floor managers.
 * Reads the live jobs collection (mpw/jobs) over the realtime shim and counts
 * jobs by pipeline stage: in production, in QC, ready to dispatch, and the
 * number delivered today. Charts use the shared dependency-free primitives.
 */
import { useEffect, useState } from 'react';
import { ref, onValue, db } from '../../services/realtime';
import {
  DashHeader, Kpi, KpiGrid, Section, BarList, QuickLinks,
} from '../../components/common/DashboardCharts';

const AMBER = 'var(--amber)';
const BLUE = 'var(--blue)';
const GREEN = 'var(--green)';

export default function ProductionDashboard() {
  const [jobs, setJobs] = useState({});

  useEffect(() => {
    const unsub = onValue(ref(db, 'mpw/jobs'), (s) => setJobs(s.val() || {}));
    return () => { if (typeof unsub === 'function') unsub(); };
  }, []);

  const list = Object.values(jobs || {});
  const today = new Date().toISOString().slice(0, 10);

  const inProduction = list.filter((j) => j && j.stage === 'production').length;
  const inQc = list.filter((j) => j && j.stage === 'qc').length;
  const inDispatch = list.filter((j) => j && j.stage === 'dispatch').length;
  const deliveredToday = list.filter((j) =>
    j && j.stage === 'delivered' && j.deliveredAt &&
    new Date(j.deliveredAt).toISOString().slice(0, 10) === today
  ).length;

  return (
    <div data-legacy-id="page-dashboard">
      <DashHeader title="Production Floor" subtitle="Live job pipeline across the shop floor" />

      <KpiGrid>
        <Kpi label="In production" value={inProduction} icon="🏭" />
        <Kpi label="In QC" value={inQc} color={AMBER} icon="🔍" />
        <Kpi label="Ready to dispatch" value={inDispatch} color={BLUE} icon="📦" />
        <Kpi label="Delivered today" value={deliveredToday} color={GREEN} icon="✅" />
      </KpiGrid>

      <Section title="Pipeline">
        <BarList items={[
          { label: 'Production', value: inProduction },
          { label: 'QC', value: inQc, color: AMBER },
          { label: 'Dispatch', value: inDispatch, color: BLUE },
          { label: 'Delivered today', value: deliveredToday, color: GREEN },
        ]} />
      </Section>

      <QuickLinks links={[
        { to: '/production', label: 'Production' },
        { to: '/qc', label: 'QC' },
        { to: '/dispatch', label: 'Dispatch' },
        { to: '/assign-prod', label: 'Assign Production' },
      ]} />
    </div>
  );
}
