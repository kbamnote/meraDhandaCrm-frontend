/**
 * Staff Dashboard — the DEFAULT personal dashboard for staff/pending users and
 * any role without a dedicated dashboard. Strictly self-service: it shows only
 * the signed-in person's own attendance, leaves, payroll and tasks (via meApi),
 * never any company-wide totals or other people's data. Dependency-free charts
 * via the shared DashboardCharts primitives.
 */
import { useEffect, useState } from 'react';
import { meApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  DashHeader,
  Kpi,
  KpiGrid,
  Section,
  BarList,
  QuickLinks,
  inr,
} from '../../components/common/DashboardCharts';

const asArray = (x) => (Array.isArray(x) ? x : x ? Object.values(x) : []);

export default function StaffDashboard() {
  const { profile } = useAuth();
  const [attendance, setAttendance] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [payroll, setPayroll] = useState([]);
  const [tasks, setTasks] = useState([]);

  useEffect(() => {
    meApi.attendance().then((d) => setAttendance(asArray(d))).catch(() => {});
    meApi.leaves().then((d) => setLeaves(asArray(d))).catch(() => {});
    meApi.payroll().then((d) => setPayroll(asArray(d))).catch(() => {});
    meApi.tasks().then((d) => setTasks(asArray(d))).catch(() => {});
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const thisMonth = today.slice(0, 7); // YYYY-MM

  const todayRec = attendance.find((a) => a && a.date === today) || null;
  const punchedIn = !!(todayRec && todayRec.checkIn) && !(todayRec && todayRec.checkOut);

  const monthAttendance = attendance.filter(
    (a) => a && typeof a.date === 'string' && a.date.startsWith(thisMonth)
  );
  const hoursThisMonth = monthAttendance.reduce((sum, a) => sum + (Number(a.hours) || 0), 0);
  const presentDays = monthAttendance.filter(
    (a) => a && (a.status === 'present' || a.checkIn)
  ).length || 0;

  const pendingLeaves = leaves.filter((l) => l && l.status === 'pending').length || 0;
  const openTasks = tasks.filter((t) => t && t.status !== 'done').length || 0;

  // tasks grouped by status
  const tasksPending = tasks.filter((t) => t && t.status === 'pending').length || 0;
  const tasksInProgress = tasks.filter((t) => t && t.status === 'in-progress').length || 0;
  const tasksDone = tasks.filter((t) => t && t.status === 'done').length || 0;

  // latest salary slip by month/createdAt, guarding the amount field name
  const lastSlip = payroll.slice().sort((a, b) => {
    const am = String((a && (a.month || a.createdAt)) || '');
    const bm = String((b && (b.month || b.createdAt)) || '');
    return am < bm ? 1 : am > bm ? -1 : 0;
  })[0] || null;
  const lastSalaryNum = lastSlip
    ? Number(lastSlip.netSalary ?? lastSlip.net ?? lastSlip.amount)
    : NaN;
  const hasLastSalary = !Number.isNaN(lastSalaryNum) && lastSalaryNum > 0;

  return (
    <div data-legacy-id="page-dashboard">
      <DashHeader
        title={`Welcome, ${(profile && profile.name) || 'there'}`}
        subtitle="Your day at a glance"
      />

      <KpiGrid>
        <Kpi
          label="Today"
          value={punchedIn ? 'In' : todayRec && todayRec.checkOut ? 'Out' : '—'}
          color={punchedIn ? 'var(--green)' : 'var(--text2)'}
          icon="🕒"
        />
        <Kpi label="Hours this month" value={Math.round(hoursThisMonth * 10) / 10} icon="⏱️" />
        <Kpi label="Pending leaves" value={pendingLeaves} color="var(--amber)" icon="📋" />
        <Kpi label="Open tasks" value={openTasks} color="var(--blue)" icon="✅" />
        <Kpi
          label="Last salary"
          value={hasLastSalary ? inr(lastSalaryNum) : '—'}
          sub={hasLastSalary && lastSlip && lastSlip.month ? lastSlip.month : undefined}
          color="var(--green)"
          icon="💰"
        />
      </KpiGrid>

      <Section title="My tasks">
        <BarList
          items={[
            { label: 'Pending', value: tasksPending, color: 'var(--amber)' },
            { label: 'In progress', value: tasksInProgress, color: 'var(--blue)' },
            { label: 'Done', value: tasksDone, color: 'var(--green)' },
          ]}
        />
      </Section>

      <Section title="My attendance this month">
        {presentDays > 0 ? (
          <BarList
            items={[{ label: 'Present days', value: presentDays, color: 'var(--green)' }]}
          />
        ) : (
          <div style={{ color: 'var(--text3)', fontSize: 13 }}>
            No attendance recorded this month yet. Punch in to get started.
          </div>
        )}
      </Section>

      <QuickLinks
        links={[
          { to: '/my-attendance', label: 'Punch Attendance' },
          { to: '/my-leaves', label: 'My Leaves' },
          { to: '/my-salary', label: 'My Salary' },
          { to: '/chat', label: 'Chat' },
          { to: '/profile', label: 'Profile' },
        ]}
      />
    </div>
  );
}
