/**
 * Super Admin — system overview dashboard.
 *
 * Real-time user counts (total + per role) via onValue(mpw/users), plus a
 * best-effort recent-activity peek from auditLogs (admin/superadmin only; the
 * collection 403s for everyone else, which we catch gracefully).
 */
import { useEffect, useMemo, useState } from 'react';
import { ref, onValue, db } from '../services/realtime';
import { dbApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useT } from '../i18n/LanguageContext';
import { showToast } from '../components/common/toast';

const S = {
  superAdmin: { en: 'Super Admin', hi: 'सुपर एडमिन', hinglish: 'Super Admin', gu: 'સુપર એડમિન', mr: 'सुपर अॅडमिन', mwr: 'सुपर एडमिन' },
  systemOverview: { en: 'System overview · signed in as', hi: 'सिस्टम ओवरव्यू · साइन इन', hinglish: 'System overview · signed in as', gu: 'સિસ્ટમ ઓવરવ્યૂ · સાઇન ઇન', mr: 'सिस्टम आढावा · साइन इन', mwr: 'सिस्टम ओवरव्यू · साइन इन' },
  totalUsers: { en: 'Total users', hi: 'कुल यूज़र', hinglish: 'Total users', gu: 'કુલ યૂઝર્સ', mr: 'एकूण युझर', mwr: 'कुल यूज़र' },
  distinctRoles: { en: 'Distinct roles', hi: 'अलग-अलग रोल', hinglish: 'Distinct roles', gu: 'અલગ રોલ્સ', mr: 'वेगवेगळ्या भूमिका', mwr: 'अलग-अलग रोल' },
  pendingUnassigned: { en: 'Pending / unassigned', hi: 'पेंडिंग / अनासाइन', hinglish: 'Pending / unassigned', gu: 'પેન્ડિંગ / અનઅસાઇન', mr: 'प्रलंबित / नियुक्त नाही', mwr: 'पेंडिंग / अनासाइन' },
  usersByRole: { en: 'Users by role', hi: 'रोल के अनुसार यूज़र', hinglish: 'Role ke hisaab se Users', gu: 'રોલ પ્રમાણે યૂઝર્સ', mr: 'भूमिकेनुसार युझर', mwr: 'रोल रे हिसाब सूं यूज़र' },
  noUsers: { en: 'No users yet.', hi: 'अभी तक कोई यूज़र नहीं।', hinglish: 'Abhi tak koi user nahi.', gu: 'હજુ સુધી કોઈ યૂઝર નથી.', mr: 'अद्याप कोणताही युझर नाही.', mwr: 'अजे तांई कोई यूज़र कोनी।' },
  role: { en: 'Role', hi: 'रोल', hinglish: 'Role', gu: 'રોલ', mr: 'भूमिका', mwr: 'रोल' },
  count: { en: 'Count', hi: 'संख्या', hinglish: 'Count', gu: 'સંખ્યા', mr: 'संख्या', mwr: 'गिणती' },
  recentActivity: { en: 'Recent activity', hi: 'हाल की गतिविधि', hinglish: 'Recent activity', gu: 'તાજેતરની પ્રવૃત્તિ', mr: 'अलीकडील क्रियाकलाप', mwr: 'हाल री गतिविधि' },
  restricted: { en: 'restricted', hi: 'सीमित', hinglish: 'restricted', gu: 'પ્રતિબંધિત', mr: 'मर्यादित', mwr: 'सीमित' },
  notAvailable: { en: 'Audit logs are not available for your role.', hi: 'आपके रोल के लिए ऑडिट लॉग उपलब्ध नहीं हैं।', hinglish: 'Aapke role ke liye audit logs available nahi hain.', gu: 'તમારા રોલ માટે ઓડિટ લોગ ઉપલબ્ધ નથી.', mr: 'तुमच्या भूमिकेसाठी ऑडिट लॉग उपलब्ध नाहीत.', mwr: 'थारा रोल खातर ऑडिट लॉग उपलब्ध कोनी।' },
  noRecent: { en: 'No recent activity.', hi: 'कोई हाल की गतिविधि नहीं।', hinglish: 'Koi recent activity nahi.', gu: 'કોઈ તાજેતરની પ્રવૃત્તિ નથી.', mr: 'कोणताही अलीकडील क्रियाकलाप नाही.', mwr: 'कोई हाल री गतिविधि कोनी।' },
  activity: { en: 'activity', hi: 'गतिविधि', hinglish: 'activity', gu: 'પ્રવૃત્તિ', mr: 'क्रियाकलाप', mwr: 'गतिविधि' },
  system: { en: 'system', hi: 'सिस्टम', hinglish: 'system', gu: 'સિસ્ટમ', mr: 'सिस्टम', mwr: 'सिस्टम' },
  loadFailed: { en: 'Failed to load activity', hi: 'गतिविधि लोड नहीं हुई', hinglish: 'Activity load nahi hui', gu: 'પ્રવૃત્તિ લોડ થઈ નહીં', mr: 'क्रियाकलाप लोड झाला नाही', mwr: 'गतिविधि लोड कोनी हुई' },
};

function fmtTime(ts) {
  if (!ts) return '—';
  try {
    const d = typeof ts === 'number' ? new Date(ts) : new Date(String(ts));
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString();
  } catch { return '—'; }
}

export default function SuperAdminPage() {
  const { profile } = useAuth();
  const t = useT(S);
  const [users, setUsers] = useState({});
  const [logs, setLogs] = useState([]);
  const [logsOk, setLogsOk] = useState(true);

  // Real-time user list.
  useEffect(() => {
    const u = onValue(ref(db, 'mpw/users'), (snap) => setUsers(snap.val() || {}));
    return () => u();
  }, []);

  // Best-effort audit logs (may 403 for non-superadmins).
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const map = await dbApi.list('auditLogs');
        if (!active) return;
        const arr = Object.entries(map || {}).map(([id, l]) => ({ ...l, id }));
        arr.sort((a, b) => {
          const ta = Number(a.ts || a.timestamp || 0);
          const tb = Number(b.ts || b.timestamp || 0);
          return tb - ta;
        });
        setLogs(arr);
      } catch (err) {
        if (!active) return;
        setLogsOk(false);
        setLogs([]);
        if (err.response?.status && err.response.status !== 403) {
          showToast(err.response?.data?.error || t('loadFailed'), 'error');
        }
      }
    })();
    return () => { active = false; };
  }, []);

  const userList = useMemo(
    () => Object.entries(users).map(([id, u]) => ({ ...u, id })),
    [users]
  );

  const total = userList.length;

  const byRole = useMemo(() => {
    const counts = {};
    userList.forEach((u) => {
      const role = u.role || 'unassigned';
      counts[role] = (counts[role] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [userList]);

  const pending = useMemo(
    () => userList.filter((u) => !u.role || u.role === 'pending').length,
    [userList]
  );

  const recent = logs.slice(0, 6);

  return (
    <div data-legacy-id="page-superadmin">
      <div className="mb-4">
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>🛡️ {t('superAdmin')}</h2>
        <div style={{ fontSize: 13, color: 'var(--text2)' }}>
          {t('systemOverview')} <b>{profile?.name || profile?.phone || '—'}</b>
          {profile?.role && <> · <span className="badge badge-blue">{profile.role}</span></>}
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))',
          gap: 12,
          marginBottom: 20,
        }}
      >
        <div className="card">
          <div style={{ fontSize: 24 }}>👥</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>{t('totalUsers')}</div>
          <div style={{ fontSize: 28, fontWeight: 700, marginTop: 2 }}>{total}</div>
        </div>
        <div className="card">
          <div style={{ fontSize: 24 }}>🧩</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>{t('distinctRoles')}</div>
          <div style={{ fontSize: 28, fontWeight: 700, marginTop: 2 }}>{byRole.length}</div>
        </div>
        <div className="card">
          <div style={{ fontSize: 24 }}>⏳</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>{t('pendingUnassigned')}</div>
          <div style={{ fontSize: 28, fontWeight: 700, marginTop: 2 }}>{pending}</div>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))',
          gap: 16,
        }}
      >
        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 10 }}>{t('usersByRole')}</div>
          {!byRole.length ? (
            <div style={{ fontSize: 13, color: 'var(--text3)' }}>{t('noUsers')}</div>
          ) : (
            <table className="crm-table">
              <thead>
                <tr>
                  <th>{t('role')}</th>
                  <th style={{ width: 80, textAlign: 'right' }}>{t('count')}</th>
                </tr>
              </thead>
              <tbody>
                {byRole.map(([role, count]) => (
                  <tr key={role}>
                    <td><span className="badge badge-blue">{role}</span></td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <div style={{ fontWeight: 600 }}>{t('recentActivity')}</div>
            {!logsOk && <span className="badge badge-amber">{t('restricted')}</span>}
          </div>
          {!logsOk ? (
            <div style={{ fontSize: 13, color: 'var(--text3)' }}>
              {t('notAvailable')}
            </div>
          ) : !recent.length ? (
            <div style={{ fontSize: 13, color: 'var(--text3)' }}>{t('noRecent')}</div>
          ) : (
            <div>
              {recent.map((l) => (
                <div
                  key={l.id}
                  style={{
                    fontSize: 12,
                    padding: '8px 0',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  <div style={{ fontWeight: 600 }}>
                    {l.action || l.event || l.type || t('activity')}
                  </div>
                  <div style={{ color: 'var(--text3)', marginTop: 2 }}>
                    {(l.actor || l.userName || l.user || l.by || t('system'))}
                    {' · '}
                    {fmtTime(l.ts || l.timestamp || l.createdAt)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
