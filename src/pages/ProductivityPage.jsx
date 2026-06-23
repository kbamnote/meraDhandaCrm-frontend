import { useEffect, useMemo, useState } from 'react';
import { ref, onValue, db } from '../services/realtime';
import { useAuth } from '../context/AuthContext';
import { useT } from '../i18n/LanguageContext';

const S = {
  productivity: { en: 'Productivity', hi: 'प्रोडक्टिविटी', hinglish: 'Productivity', gu: 'પ્રોડક્ટિવિટી', mr: 'प्रॉडक्टिव्हिटी', mwr: 'प्रोडक्टिविटी' },
  subtitle: { en: 'Task throughput & attendance', hi: 'टास्क थ्रूपुट और हाजिरी', hinglish: 'Task throughput & attendance', gu: 'ટાસ્ક થ્રૂપુટ અને હાજરી', mr: 'टास्क थ्रूपुट आणि हजेरी', mwr: 'टास्क थ्रूपुट अर हाजरी' },
  totalTasks: { en: 'Total tasks', hi: 'कुल टास्क', hinglish: 'Total tasks', gu: 'કુલ ટાસ્ક', mr: 'एकूण टास्क', mwr: 'कुल टास्क' },
  doneTasks: { en: 'Done tasks', hi: 'पूरे टास्क', hinglish: 'Done tasks', gu: 'પૂર્ણ ટાસ્ક', mr: 'पूर्ण टास्क', mwr: 'पूरा टास्क' },
  completion: { en: 'Completion', hi: 'पूर्णता', hinglish: 'Completion', gu: 'પૂર્ણતા', mr: 'पूर्णता', mwr: 'पूर्णता' },
  attendanceRecords: { en: 'Attendance records', hi: 'हाजिरी रिकॉर्ड', hinglish: 'Attendance records', gu: 'હાજરી રેકોર્ડ', mr: 'हजेरी नोंदी', mwr: 'हाजरी रिकॉर्ड' },
  tasksPerAssignee: { en: 'Tasks per assignee', hi: 'प्रति व्यक्ति टास्क', hinglish: 'Tasks per assignee', gu: 'દરેક અસાઇનીના ટાસ્ક', mr: 'प्रत्येक नियुक्तानुसार टास्क', mwr: 'हर व्यक्ति रा टास्क' },
  noTasks: { en: 'No tasks yet.', hi: 'अभी तक कोई टास्क नहीं।', hinglish: 'Abhi tak koi task nahi.', gu: 'હજુ સુધી કોઈ ટાસ્ક નથી.', mr: 'अद्याप कोणतेही टास्क नाहीत.', mwr: 'अजे तांई कोई टास्क कोनी।' },
  unassigned: { en: 'Unassigned', hi: 'अनासाइन', hinglish: 'Unassigned', gu: 'અનઅસાઇન', mr: 'नियुक्त नाही', mwr: 'अनासाइन' },
  assignee: { en: 'Assignee', hi: 'व्यक्ति', hinglish: 'Assignee', gu: 'અસાઇની', mr: 'नियुक्त व्यक्ती', mwr: 'व्यक्ति' },
  total: { en: 'Total', hi: 'कुल', hinglish: 'Total', gu: 'કુલ', mr: 'एकूण', mwr: 'कुल' },
  done: { en: 'Done', hi: 'पूरे', hinglish: 'Done', gu: 'પૂર્ણ', mr: 'पूर्ण', mwr: 'पूरा' },
};

const UNASSIGNED = '__unassigned__';

export default function ProductivityPage() {
  const { profile } = useAuth();
  const t = useT(S);
  const [tasks, setTasks] = useState({});
  const [attendance, setAttendance] = useState({});

  useEffect(() => {
    const u1 = onValue(ref(db, 'mpw/tasks'), (snap) => setTasks(snap.val() || {}));
    const u2 = onValue(ref(db, 'mpw/attendance'), (snap) => setAttendance(snap.val() || {}));
    return () => { u1(); u2(); };
  }, []);

  const taskList = useMemo(() => Object.values(tasks || {}), [tasks]);

  const totalTasks = taskList.length;
  const doneTasks = useMemo(
    () => taskList.filter((t) => t && t.status === 'done').length,
    [taskList]
  );
  const completion = totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0;
  const attendanceCount = Object.keys(attendance || {}).length;

  const perAssignee = useMemo(() => {
    const map = {};
    taskList.forEach((tk) => {
      const name = (tk && (tk.assignedToName || tk.assignedTo)) || UNASSIGNED;
      if (!map[name]) map[name] = { name, total: 0, done: 0 };
      map[name].total += 1;
      if (tk && tk.status === 'done') map[name].done += 1;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [taskList]);

  const cards = [
    { label: t('totalTasks'), icon: '📋', value: totalTasks },
    { label: t('doneTasks'), icon: '✅', value: doneTasks },
    { label: t('completion'), icon: '📈', value: `${completion}%` },
    { label: t('attendanceRecords'), icon: '🕒', value: attendanceCount },
  ];

  return (
    <div data-legacy-id="page-productivity">
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>🚀 {t('productivity')}</h2>
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
          {t('tasksPerAssignee')}
        </div>
        {!perAssignee.length ? (
          <div style={{ textAlign: 'center', padding: 30, color: 'var(--text3)' }}>
            {t('noTasks')}
          </div>
        ) : (
          <table className="crm-table">
            <thead>
              <tr>
                <th>{t('assignee')}</th>
                <th>{t('total')}</th>
                <th>{t('done')}</th>
                <th>{t('completion')}</th>
              </tr>
            </thead>
            <tbody>
              {perAssignee.map((a) => {
                const pct = a.total ? Math.round((a.done / a.total) * 100) : 0;
                return (
                  <tr key={a.name}>
                    <td>{a.name === UNASSIGNED ? t('unassigned') : a.name}</td>
                    <td>{a.total}</td>
                    <td>{a.done}</td>
                    <td>
                      <span className={`badge ${pct >= 100 ? 'badge-green' : pct >= 50 ? 'badge-blue' : 'badge-amber'}`}>
                        {pct}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
