/**
 * Sales role dashboard — a rep'''s own month.
 *
 * Orders they actually won (salesApi.myPerformance: job cards credited to them,
 * with what was billed and collected against each) and their monthly target.
 *
 * The lead KPIs that used to sit at the top are gone: a rep'''s work now starts
 * from a shop visit, and the Leads CRM is not part of their nav any more, so
 * figures they could not click through to were just noise.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { salesApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  DashHeader, Kpi, KpiGrid, Section, BarList, QuickLinks, inr,
} from '../../components/common/DashboardCharts';

const GREEN = 'var(--green)';
const AMBER = 'var(--amber)';

function currentMonth() {
  return new Date().toISOString().slice(0, 7); // "YYYY-MM"
}

export default function SalesDashboard() {
  const { profile } = useAuth();
  const [target, setTarget] = useState(null);      // my monthly target number
  // Orders I actually won — job cards credited to me, and what has been billed
  // and collected against them.
  const [perf, setPerf] = useState(null);
  // Today's calling, and the follow-ups this rep promised.
  const [calling, setCalling] = useState(null);

  useEffect(() => {
    salesApi.myPerformance().then(setPerf).catch(() => {});
    salesApi.myCalling().then(setCalling).catch(() => {});
  }, []);

  useEffect(() => {
    salesApi.targets(currentMonth()).then((rows) => {
      const list = Array.isArray(rows) ? rows : [];
      const myId = profile?.id;
      const row = list.find((r) => myId && r.userId === myId);
      setTarget(row && row.target != null ? (Number(row.target) || 0) : null);
    }).catch(() => {});
  }, [profile?.id]);

  // A target is about money brought in, so it is measured against the orders
  // actually won.
  const achieved = (perf && perf.orderValue) || 0;
  const hasTarget = target != null && target > 0;
  const targetPct = hasTarget ? Math.round((achieved / target) * 100) : 0;

  // Dialled is how many times they pressed call; reached is how many of
  // those actually connected. The gap between them is the day's real story.
  const st = (calling && calling.statuses) || {};
  const lab = (calling && calling.labels) || {};
  const bars = Object.keys(lab)
    .map((k) => ({ label: lab[k], value: st[k] || 0 }))
    .filter((b) => b.value > 0)
    .sort((a, b) => b.value - a.value);

  return (
    <div data-legacy-id="page-dashboard">
      <DashHeader title="My Sales" subtitle="Your calls, shop visits, orders and monthly target" />

      {calling && (
        <Section title="My calling today">
          <KpiGrid>
            <Kpi label="Dialled" value={calling.dialled} icon="☎️" />
            {/* Not the same as dialled: a number that never answered is not
                somebody you spoke to. */}
            <Kpi label="Connected" value={calling.reached} color={GREEN} icon="✅" />
            <Kpi label="People contacted" value={calling.leads} icon="👥" />
            <Kpi label="Interested" value={st.interested || 0} color={GREEN} icon="👍" />
            <Kpi label="Not interested" value={st.not_interested || 0} icon="👎" />
            <Kpi label="Follow-ups due" value={calling.followUpsDue} color={AMBER} icon="↻" />
          </KpiGrid>

          {!!bars.length && <BarList items={bars} />}

          {/* The ones they promised to ring back. Overdue first, because
              that is the promise already broken. */}
          {!!(calling.followUps || []).length && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }}>
                Call back
              </div>
              {calling.followUps.slice(0, 8).map((f) => (
                <div key={f.id} className="flex items-center justify-between"
                  style={{ fontSize: 12.5, padding: '3px 0', borderBottom: '1px solid var(--border)' }}>
                  <span>{f.name || '—'} <span style={{ color: 'var(--text3)' }}>{f.phone}</span></span>
                  <span style={{ color: f.overdue ? 'var(--red)' : 'var(--text2)', fontWeight: f.overdue ? 700 : 400 }}>
                    {f.nextCallBack}
                  </span>
                </div>
              ))}
              <div style={{ marginTop: 6 }}><Link to="/leads-crm">Open Leads CRM</Link></div>
            </div>
          )}
        </Section>
      )}

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
            No target set for this month yet. Ask your manager to set one.
          </div>
        )}
      </Section>

      <QuickLinks links={[
        { to: '/my-attendance', label: 'My Attendance' },
        { to: '/visits', label: 'Shop Visits' },
      ]} />
    </div>
  );
}
