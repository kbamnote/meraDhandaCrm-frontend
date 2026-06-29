/**
 * HR Dashboard — people overview for the HR role. Live-reads users, leaves,
 * departments and attendance from the realtime shim and surfaces headcount,
 * today's attendance split and the leave-request pipeline. Dependency-free
 * charts via the shared DashboardCharts primitives.
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

export default function HrDashboard() {
  const [users, setUsers] = useState({});
  const [leaves, setLeaves] = useState({});
  const [departments, setDepartments] = useState({});
  const [attendance, setAttendance] = useState({});

  useEffect(() => {
    const u1 = onValue(ref(db, 'mpw/users'), (s) => setUsers(s.val() || {}));
    const u2 = onValue(ref(db, 'mpw/leaves'), (s) => setLeaves(s.val() || {}));
    const u3 = onValue(ref(db, 'mpw/departments'), (s) => setDepartments(s.val() || {}));
    const u4 = onValue(ref(db, 'mpw/attendance'), (s) => setAttendance(s.val() || {}));
    return () => { u1(); u2(); u3(); u4(); };
  }, []);

  const userList = Object.values(users || {});
  const leaveList = Object.values(leaves || {});
  const attendanceList = Object.values(attendance || {});

  const totalStaff = userList.length || 0;
  const deptCount = Object.keys(departments || {}).length || 0;

  const pendingLeaves = leaveList.filter((l) => l && l.status === 'pending').length || 0;
  const approvedLeaves = leaveList.filter((l) => l && l.status === 'approved').length || 0;
  const rejectedLeaves = leaveList.filter((l) => l && l.status === 'rejected').length || 0;

  const today = new Date().toISOString().slice(0, 10);
  const presentToday = attendanceList.filter(
    (a) => a && a.date === today && (a.checkIn || a.status === 'present')
  ).length || 0;
  const absentToday = Math.max(0, totalStaff - presentToday);

  return (
    <div data-legacy-id="page-dashboard">
      <DashHeader title="People Overview" subtitle="Staff, attendance & leave at a glance" />

      <KpiGrid>
        <Kpi label="Total staff" value={totalStaff} icon="👥" />
        <Kpi label="Departments" value={deptCount} icon="🏢" />
        <Kpi label="Pending leaves" value={pendingLeaves} color="var(--amber)" icon="📋" />
        <Kpi label="Present today" value={presentToday} color="var(--green)" icon="✅" />
      </KpiGrid>

      <Section title="Today attendance">
        <BarList
          items={[
            { label: 'Present', value: presentToday, color: 'var(--green)' },
            { label: 'Absent', value: absentToday, color: 'var(--red)' },
          ]}
        />
      </Section>

      <Section title="Leave requests">
        <BarList
          items={[
            { label: 'Pending', value: pendingLeaves, color: 'var(--amber)' },
            { label: 'Approved', value: approvedLeaves, color: 'var(--green)' },
            { label: 'Rejected', value: rejectedLeaves, color: 'var(--red)' },
          ]}
        />
      </Section>

      <QuickLinks
        links={[
          { to: '/hr-dashboard', label: 'HR Dashboard' },
          { to: '/hr-leaves', label: 'Leaves' },
          { to: '/hr-payroll', label: 'Payroll' },
          { to: '/hr-attendance', label: 'Team Attendance' },
        ]}
      />
    </div>
  );
}
