/**
 * Sales role dashboard — a salesperson's own view of their pipeline.
 * Pulls salesApi.report() for tenant-wide deal outcomes, salesApi.leaderboard()
 * to isolate MY row (by profile.id / name), and salesApi.targets(month) for my
 * monthly target. Charts are the shared dependency-free primitives.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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
  // Orders I actually won — job cards credited to me, and what has been
  // billed and collected against them. Separate from the lead pipeline
  // above: a lead is a conversation, an order is work in the building.
  const [perf, setPerf] = useState(null);

  useEffect(() => {
    salesApi.report().then(setReport).catch(() => {});
    salesApi.myPerformance().then(setPerf).catch(() => {});
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

  // Measured against orders won when there are any — a target is about
  // money brought in, and an order in the building is a firmer claim on
  // that than a lead marked won. Falls back to the lead figure otherwise.
  const achieved = perf && perf.orderValue ? perf.orderValue : revenue;
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

      {perf && (
        <Section title="My orders this month">
          <KpiGrid>
            <Kpi label="Orders won" value={perf.orders} icon="📦" />
            <Kpi label="Order value" value={inr(perf.orderValue)} color={GREEN} icon="💰" />
            <Kpi label="Billed" value={inr(perf.billed)} icon="🧾" />
            <Kpi label="Collected" value={inr(perf.collected)} color={GREEN} icon="✅" />
            <Kpi label="Yet to collect" value={inr(perf.pending)} color={AMBER} icon="⏳" />
            <Kpi label="Shops visited" value={perf.visits} icon="🏪" />
          </KpiGrid>
          {/* Order value is what the customer agreed to; collected is what
              actually arrived. Showing only the first would flatter the
              number, showing only the second would hide work in progress. */}
          {!!perf.visits && (
            <div style={{ fontSize: 12.5, color: 'var(--text2)', marginTop: 8 }}>
              {perf.ordersFromVisits} of {perf.visits} shop visits turned into an order ({perf.conversion}%).{' '}
              <Link to="/visits">See visits</Link>
            </div>
          )}
          {!!(perf.recent || []).length && (
            <div style={{ marginTop: 10 }}>
              {perf.recent.map((j) => (
                <div key={j.id} className="flex items-center justify-between" style={{ fontSize: 12.5, padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                  <span><b>{j.jobNo}</b> · {j.clientName}</span>
                  <span>{inr(j.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

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
        { to: '/visits', label: 'Shop Visits' },
      ]} />
    </div>
  );
}
