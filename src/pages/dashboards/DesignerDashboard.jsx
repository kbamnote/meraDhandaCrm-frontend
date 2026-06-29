/**
 * Designer Dashboard — the design team's personal view. Live-reads the jobs
 * collection and splits it into the designer's own workload (by stage, awaiting
 * client approval, ready) and the open pool of unclaimed design jobs they can
 * pick up. Dependency-free charts via the shared DashboardCharts primitives.
 */
import { useEffect, useState } from 'react';
import { ref, onValue, db } from '../../services/realtime';
import {
  DashHeader,
  Kpi,
  KpiGrid,
  Section,
  BarList,
  QuickLinks,
} from '../../components/common/DashboardCharts';
import { useAuth } from '../../context/AuthContext';

export default function DesignerDashboard() {
  const { profile } = useAuth();
  const me = profile?.id;
  const [jobs, setJobs] = useState({});

  useEffect(() => {
    const u = onValue(ref(db, 'mpw/jobs'), (s) => setJobs(s.val() || {}));
    return () => u();
  }, []);

  const jobList = Object.values(jobs || {}).filter(Boolean);

  const myJobs = jobList.filter((j) => j && j.designerId === me);
  const pool = jobList.filter(
    (j) =>
      j &&
      j.stage === 'designer' &&
      !j.designerId &&
      !((j.designerRejectedBy || []).includes(me))
  );
  const sentApproval = myJobs.filter((j) => j && j.designClientPending);
  const ready = myJobs.filter((j) => j && j.designReady);

  // Group my jobs by stage for the bar list.
  const byStage = {};
  myJobs.forEach((j) => {
    const stage = (j && j.stage) || 'unknown';
    byStage[stage] = (byStage[stage] || 0) + 1;
  });
  const myByStage = Object.entries(byStage)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);

  return (
    <div data-legacy-id="page-dashboard">
      <DashHeader title="My Design Work" subtitle="Your jobs, approvals & the open pool" />

      <KpiGrid>
        <Kpi label="My jobs" value={myJobs.length || 0} icon="🎨" />
        <Kpi label="Available pool" value={pool.length || 0} color="var(--blue)" icon="📥" />
        <Kpi label="Awaiting client" value={sentApproval.length || 0} color="var(--amber)" icon="⏳" />
        <Kpi label="Ready" value={ready.length || 0} color="var(--green)" icon="✅" />
      </KpiGrid>

      <Section title="My jobs by stage">
        <BarList items={myByStage} />
      </Section>

      <Section title="Available pool">
        {pool.length ? (
          <div style={{ fontSize: 14, color: 'var(--text2)' }}>
            <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--blue)' }}>{pool.length}</span>{' '}
            {pool.length === 1 ? 'job waiting to be picked up' : 'jobs waiting to be picked up'}
          </div>
        ) : (
          <div style={{ color: 'var(--text3)', fontSize: 13 }}>No jobs in the pool right now.</div>
        )}
      </Section>

      <QuickLinks
        links={[
          { to: '/designer', label: 'Designer Panel' },
          { to: '/job-cards', label: 'Job Cards' },
        ]}
      />
    </div>
  );
}
