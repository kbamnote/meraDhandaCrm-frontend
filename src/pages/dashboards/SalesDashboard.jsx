/**
 * Sales role dashboard — a salesperson's own view of their pipeline.
 * Pulls salesApi.report() for tenant-wide deal outcomes, salesApi.leaderboard()
 * to isolate MY row (by profile.id / name), and salesApi.targets(month) for my
 * monthly target. Charts are the shared dependency-free primitives.
 */
import { useEffect, useState } from 'react';
import { salesApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  DashHeader, Kpi, KpiGrid, Section, BarList, QuickLinks, inr,
} from '../../components/common/DashboardCharts';

const GREEN = 'var(--green)';
const RED = 'var(--red)';
const AMBER = 'var(--amber)';

function currentMonth() {
  return new Date().toISOString().slice(0, 7); // "YYYY-MM"
}

export default function SalesDashboard() {
  const { profile } = useAuth();
  const [report, setReport] = useState(null);     // tenant-wide outcome totals
  const [mine, setMine] = useState(null);          // my leaderboard row
  const [target, setTarget] = useState(null);      // my monthly target number

  useEffect(() => {
    salesApi.report().then(setReport).catch(() => {});
  }, []);

  useEffect(() => {
    salesApi.leaderboard().then((rows) => {
      const list = Array.isArray(rows) ? rows : [];
      const myId = profile?.id;
      const myName = profile?.name;
      const found = list.find((r) =>
        (myId && (r.userId === myId)) ||
        (myName && r.name && r.name.toLowerCase() === String(myName).toLowerCase())
      );
      setMine(found || null);
    }).catch(() => {});
  }, [profile?.id, profile?.name]);

  useEffect(() => {
    salesApi.targets(currentMonth()).then((rows) => {
      const list = Array.isArray(rows) ? rows : [];
      const myId = profile?.id;
      const row = list.find((r) => myId && r.userId === myId);
      setTarget(row && row.target != null ? (Number(row.target) || 0) : null);
    }).catch(() => {});
  }, [profile?.id]);

  // Prefer my personal numbers (leaderboard); fall back to tenant report so the
  // page is still useful before a leaderboard row exists for me.
  const leads = (mine?.leads ?? report?.leads ?? report?.total ?? 0) || 0;
  const won = (mine?.won ?? report?.won ?? 0) || 0;
  const lost = (mine?.lost ?? report?.lost ?? 0) || 0;
  // Backend leaderboard has no "pending"; derive it, fall back to report.
  const pending = mine
    ? Math.max(0, leads - won - lost)
    : ((report?.pending ?? 0) || 0);
  const revenue = (mine?.revenue ?? report?.revenue ?? 0) || 0;
  const conversion = (mine?.conversion ?? report?.conversion ?? 0) || 0;

  const achieved = revenue;
  const hasTarget = target != null && target > 0;
  const targetPct = hasTarget ? Math.round((achieved / target) * 100) : 0;

  return (
    <div data-legacy-id="page-dashboard">
      <DashHeader title="My Sales" subtitle="Your leads, deals and monthly target" />

      <KpiGrid>
        <Kpi label="My leads" value={leads} icon="📋" />
        <Kpi label="Won" value={won} color={GREEN} icon="🏆" />
        <Kpi label="Lost" value={lost} color={RED} icon="❌" />
        <Kpi label="Pending" value={pending} color={AMBER} icon="⏳" />
        <Kpi label="Revenue" value={inr(revenue)} color={GREEN} icon="💰" />
        <Kpi label="Conversion" value={`${conversion}%`} icon="📈" />
      </KpiGrid>

      <Section title="Lead outcomes">
        <BarList items={[
          { label: 'Won', value: won, color: GREEN },
          { label: 'Lost', value: lost, color: RED },
          { label: 'Pending', value: pending, color: AMBER },
        ]} />
      </Section>

      <Section title="My target">
        {hasTarget ? (
          <>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 10 }}>
              {inr(achieved)} of {inr(target)} ({targetPct}%) this month
            </div>
            <BarList money items={[
              { label: 'Target', value: target, color: 'var(--blue)' },
              { label: 'Achieved', value: achieved, color: achieved >= target ? GREEN : AMBER },
            ]} />
          </>
        ) : (
          <div style={{ color: 'var(--text3)', fontSize: 13 }}>
            No target set for this month yet. Ask your manager to set one in the Sales Panel.
          </div>
        )}
      </Section>

      <QuickLinks links={[
        { to: '/leads-crm', label: 'Leads' },
        { to: '/sales-panel', label: 'Sales Panel' },
      ]} />
    </div>
  );
}
