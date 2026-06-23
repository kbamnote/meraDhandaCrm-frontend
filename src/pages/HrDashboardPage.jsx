import { useEffect, useMemo, useState } from 'react';
import { ref, onValue, db } from '../services/realtime';
import { useAuth } from '../context/AuthContext';
import { useT } from '../i18n/LanguageContext';

const S = {
  hrDashboard: { en: 'HR Dashboard', hi: 'HR डैशबोर्ड', hinglish: 'HR Dashboard', gu: 'HR ડેશબોર્ડ', mr: 'HR डॅशबोर्ड', mwr: 'HR डैशबोर्ड' },
  subtitle: { en: 'People & leave overview', hi: 'लोग और छुट्टी का ओवरव्यू', hinglish: 'People & leave overview', gu: 'લોકો અને રજાનું ઓવરવ્યૂ', mr: 'लोक आणि रजेचा आढावा', mwr: 'लोग अर छुट्टी रो ओवरव्यू' },
  totalStaff: { en: 'Total staff', hi: 'कुल स्टाफ', hinglish: 'Total staff', gu: 'કુલ સ્ટાફ', mr: 'एकूण कर्मचारी', mwr: 'कुल स्टाफ' },
  departments: { en: 'Departments', hi: 'विभाग', hinglish: 'Departments', gu: 'વિભાગો', mr: 'विभाग', mwr: 'विभाग' },
  pendingLeaves: { en: 'Pending leaves', hi: 'पेंडिंग छुट्टियां', hinglish: 'Pending leaves', gu: 'પેન્ડિંગ રજાઓ', mr: 'प्रलंबित रजा', mwr: 'पेंडिंग छुट्टियां' },
  approvedLeaves: { en: 'Approved leaves', hi: 'मंज़ूर छुट्टियां', hinglish: 'Approved leaves', gu: 'મંજૂર રજાઓ', mr: 'मंजूर रजा', mwr: 'मंजूर छुट्टियां' },
  pendingLeaveRequests: { en: 'Pending leave requests', hi: 'पेंडिंग छुट्टी की रिक्वेस्ट', hinglish: 'Pending leave requests', gu: 'પેન્ડિંગ રજા વિનંતીઓ', mr: 'प्रलंबित रजा विनंत्या', mwr: 'पेंडिंग छुट्टी री रिक्वेस्ट' },
  noPending: { en: 'No pending leave requests.', hi: 'कोई पेंडिंग छुट्टी की रिक्वेस्ट नहीं।', hinglish: 'Koi pending leave request nahi.', gu: 'કોઈ પેન્ડિંગ રજા વિનંતી નથી.', mr: 'कोणतीही प्रलंबित रजा विनंती नाही.', mwr: 'कोई पेंडिंग छुट्टी री रिक्वेस्ट कोनी।' },
  staff: { en: 'Staff', hi: 'स्टाफ', hinglish: 'Staff', gu: 'સ્ટાફ', mr: 'कर्मचारी', mwr: 'स्टाफ' },
  type: { en: 'Type', hi: 'प्रकार', hinglish: 'Type', gu: 'પ્રકાર', mr: 'प्रकार', mwr: 'किसम' },
  from: { en: 'From', hi: 'से', hinglish: 'From', gu: 'થી', mr: 'पासून', mwr: 'सूं' },
  to: { en: 'To', hi: 'तक', hinglish: 'To', gu: 'સુધી', mr: 'पर्यंत', mwr: 'तांई' },
  reason: { en: 'Reason', hi: 'कारण', hinglish: 'Reason', gu: 'કારણ', mr: 'कारण', mwr: 'कारण' },
};

export default function HrDashboardPage() {
  const { profile } = useAuth();
  const t = useT(S);
  const [users, setUsers] = useState({});
  const [leaves, setLeaves] = useState({});
  const [attendance, setAttendance] = useState({});
  const [departments, setDepartments] = useState({});

  useEffect(() => {
    const u1 = onValue(ref(db, 'mpw/users'), (snap) => setUsers(snap.val() || {}));
    const u2 = onValue(ref(db, 'mpw/leaves'), (snap) => setLeaves(snap.val() || {}));
    const u3 = onValue(ref(db, 'mpw/attendance'), (snap) => setAttendance(snap.val() || {}));
    const u4 = onValue(ref(db, 'mpw/departments'), (snap) => setDepartments(snap.val() || {}));
    return () => { u1(); u2(); u3(); u4(); };
  }, []);

  const leaveList = useMemo(
    () => Object.entries(leaves || {}).map(([id, l]) => ({ ...(l || {}), id })),
    [leaves]
  );

  const staffCount = Object.keys(users || {}).length;
  const deptCount = Object.keys(departments || {}).length;
  const attendanceCount = Object.keys(attendance || {}).length;

  const pendingLeaves = useMemo(
    () => leaveList.filter((l) => l.status === 'pending'),
    [leaveList]
  );
  const approvedLeaves = useMemo(
    () => leaveList.filter((l) => l.status === 'approved'),
    [leaveList]
  );

  const userName = (uid) => {
    const u = (users || {})[uid];
    return (u && (u.name || u.phone)) || uid || '—';
  };

  const cards = [
    { label: t('totalStaff'), icon: '👥', value: staffCount },
    { label: t('departments'), icon: '🏢', value: deptCount },
    { label: t('pendingLeaves'), icon: '⏳', value: pendingLeaves.length },
    { label: t('approvedLeaves'), icon: '✅', value: approvedLeaves.length },
  ];

  return (
    <div data-legacy-id="page-hr-dashboard">
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>🧑‍💼 {t('hrDashboard')}</h2>
      <div style={{ color: 'var(--text2)', fontSize: 13, marginBottom: 20 }}>
        {t('subtitle')}{profile?.name ? ` · ${profile.name}` : ''}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 12 }}>
        {cards.map((c) => (
          <div key={c.label} className="card">
            <div style={{ fontSize: 24 }}>{c.icon}</div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>{c.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, marginTop: 2 }}>{c.value ?? '—'}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 16, padding: 0, overflow: 'auto' }}>
        <div style={{ fontWeight: 600, padding: '12px 14px' }}>
          {t('pendingLeaveRequests')} ({pendingLeaves.length})
        </div>
        {!pendingLeaves.length ? (
          <div style={{ textAlign: 'center', padding: 30, color: 'var(--text3)' }}>
            {t('noPending')}
          </div>
        ) : (
          <table className="crm-table">
            <thead>
              <tr>
                <th>{t('staff')}</th>
                <th>{t('type')}</th>
                <th>{t('from')}</th>
                <th>{t('to')}</th>
                <th>{t('reason')}</th>
              </tr>
            </thead>
            <tbody>
              {pendingLeaves.map((l) => (
                <tr key={l.id}>
                  <td>{l.userName || userName(l.userId || l.uid)}</td>
                  <td>{l.type ? <span className="badge badge-amber">{l.type}</span> : '—'}</td>
                  <td>{l.fromDate || '—'}</td>
                  <td>{l.toDate || '—'}</td>
                  <td>{l.reason || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
