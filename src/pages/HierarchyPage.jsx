/**
 * HierarchyPage — read-only org view.
 *
 * Real-time subscribe to mpw/users + mpw/departments. Group users by their
 * department (fallback 'Unassigned') and render one card per department, each
 * listing its users with a role badge. No writes.
 */
import { useEffect, useMemo, useState } from 'react';
import { ref, onValue, db } from '../services/realtime';
import { useT } from '../i18n/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../services/api';
import { showToast } from '../components/common/toast';

const S = {
  orgHierarchy: { en: 'Org Hierarchy', hi: 'संगठन पदानुक्रम', hinglish: 'Org Hierarchy', gu: 'સંસ્થા પદાનુક્રમ', mr: 'संस्था उतरंड', mwr: 'संगठन पदानुक्रम' },
  person: { en: 'person', hi: 'व्यक्ति', hinglish: 'person', gu: 'વ્યક્તિ', mr: 'व्यक्ती', mwr: 'व्यक्ति' },
  people: { en: 'people', hi: 'लोग', hinglish: 'people', gu: 'લોકો', mr: 'लोक', mwr: 'लोग' },
  across: { en: 'across', hi: 'में', hinglish: 'across', gu: 'માં', mr: 'मध्ये', mwr: 'में' },
  department: { en: 'department', hi: 'विभाग', hinglish: 'department', gu: 'વિભાગ', mr: 'विभाग', mwr: 'विभाग' },
  departments: { en: 'departments', hi: 'विभाग', hinglish: 'departments', gu: 'વિભાગો', mr: 'विभाग', mwr: 'विभाग' },
  noUsers: { en: 'No users yet.', hi: 'अभी तक कोई यूज़र नहीं।', hinglish: 'Abhi tak koi user nahi.', gu: 'હજુ સુધી કોઈ યૂઝર નથી.', mr: 'अद्याप कोणतेही युझर नाहीत.', mwr: 'अजे तांई कोई यूज़र कोनी।' },
  pending: { en: 'pending', hi: 'पेंडिंग', hinglish: 'pending', gu: 'પેન્ડિંગ', mr: 'प्रलंबित', mwr: 'पेंडिंग' },
  reportsTo: { en: 'Reports to', hi: 'रिपोर्ट करता है', hinglish: 'Reports to', gu: 'રિપોર્ટ કરે', mr: 'रिपोर्ट करतो', mwr: 'रिपोर्ट करै' },
  noManager: { en: '— No manager —', hi: '— कोई मैनेजर नहीं —', hinglish: '— No manager —', gu: '— કોઈ મેનેજર નહીં —', mr: '— मॅनेजर नाही —', mwr: '— कोई मैनेजर कोनी —' },
  managerSaved: { en: 'Manager updated', hi: 'मैनेजर अपडेट हो गया', hinglish: 'Manager update ho gaya', gu: 'મેનેજર અપડેટ થયો', mr: 'मॅनेजर अपडेट झाला', mwr: 'मैनेजर अपडेट हो ग्यो' },
  failed: { en: 'Failed', hi: 'नहीं हुआ', hinglish: 'Fail hua', gu: 'નિષ્ફળ', mr: 'अयशस्वी', mwr: 'कोनी हुयो' },
};

const ROLE_BADGE = {
  admin: 'badge-red', superadmin: 'badge-red', owner: 'badge-red',
  manager: 'badge-amber', floor_manager: 'badge-amber', hr: 'badge-amber',
  designer: 'badge-blue', jobsetter: 'badge-blue', sales: 'badge-blue',
  staff: 'badge-green', pending: 'badge-amber',
};

const UNASSIGNED = 'Unassigned';

export default function HierarchyPage() {
  const t = useT(S);
  const { hasRole } = useAuth();
  const canEdit = hasRole('admin', 'superadmin', 'owner');
  const [users, setUsers] = useState({});
  const [departments, setDepartments] = useState({});

  useEffect(() => {
    const u1 = onValue(ref(db, 'mpw/users'), (snap) => setUsers(snap.val() || {}));
    const u2 = onValue(ref(db, 'mpw/departments'), (snap) => setDepartments(snap.val() || {}));
    return () => { u1(); u2(); };
  }, []);

  // id -> display name, for the reports-to picker + manager display.
  const userName = useMemo(() => {
    const m = {};
    Object.entries(users).forEach(([id, u]) => { m[id] = u?.name || u?.email || id; });
    return m;
  }, [users]);

  // Candidate managers for the picker (everyone, sorted by name).
  const managerOptions = useMemo(
    () => Object.entries(users)
      .map(([id, u]) => ({ id, name: u?.name || u?.email || id }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [users]
  );

  const setManager = async (uid, reportsTo) => {
    try {
      await authApi.updateUser(uid, { reportsTo: reportsTo || null });
      showToast(t('managerSaved'), 'success');
    } catch (err) {
      showToast(err.response?.data?.error || t('failed'), 'error');
    }
  };

  // Map a department id (or name) to a readable label.
  const deptLabel = useMemo(() => {
    const m = {};
    Object.entries(departments).forEach(([id, d]) => {
      m[id] = (d && (d.name || d.title)) || id;
    });
    return m;
  }, [departments]);

  // Group users by department label.
  const groups = useMemo(() => {
    const byDept = {};
    Object.entries(users).forEach(([id, u]) => {
      const raw = u?.department;
      const label = raw ? (deptLabel[raw] || raw) : UNASSIGNED;
      if (!byDept[label]) byDept[label] = [];
      byDept[label].push({ ...u, id });
    });
    // Sort: named departments first (alpha), Unassigned last.
    const names = Object.keys(byDept).sort((a, b) => {
      if (a === UNASSIGNED) return 1;
      if (b === UNASSIGNED) return -1;
      return a.localeCompare(b);
    });
    return names.map((name) => ({
      name,
      members: byDept[name].sort((a, b) =>
        (a.name || a.phone || '').localeCompare(b.name || b.phone || '')
      ),
    }));
  }, [users, deptLabel]);

  const totalUsers = Object.keys(users).length;

  return (
    <div data-legacy-id="page-hierarchy">
      <div className="mb-4">
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>🏢 {t('orgHierarchy')}</h2>
        <div style={{ fontSize: 13, color: 'var(--text2)' }}>
          {totalUsers} {totalUsers === 1 ? t('person') : t('people')} {t('across')} {groups.length}{' '}
          {groups.length === 1 ? t('department') : t('departments')}
        </div>
      </div>

      {!groups.length ? (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>
          {t('noUsers')}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 12 }}>
          {groups.map((g) => (
            <div key={g.name} className="card">
              <div className="flex items-center justify-between mb-2">
                <div style={{ fontSize: 15, fontWeight: 600 }}>{g.name}</div>
                <span className="badge badge-blue">{g.members.length}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {g.members.map((u) => (
                  <div
                    key={u.id}
                    style={{ paddingBottom: 8, borderBottom: '1px solid var(--border)' }}
                  >
                    <div className="flex items-center justify-between">
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>
                          {u.name || u.phone || u.id}
                        </div>
                        {u.phone && u.name && (
                          <div style={{ fontSize: 11, color: 'var(--text3)' }}>{u.phone}</div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <span className={`badge ${ROLE_BADGE[u.role] || 'badge-blue'}`}>
                          {u.role || t('pending')}
                        </span>
                        {u.customRole && (
                          <span className="badge badge-blue">{u.customRole}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2" style={{ marginTop: 6, fontSize: 11, color: 'var(--text3)' }}>
                      <span style={{ whiteSpace: 'nowrap' }}>↳ {t('reportsTo')}:</span>
                      {canEdit ? (
                        <select
                          className="input"
                          style={{ height: 28, padding: '2px 6px', fontSize: 12, flex: 1, minWidth: 0 }}
                          value={u.reportsTo || ''}
                          onChange={(e) => setManager(u.id, e.target.value)}
                        >
                          <option value="">{t('noManager')}</option>
                          {managerOptions
                            .filter((o) => o.id !== u.id)
                            .map((o) => (
                              <option key={o.id} value={o.id}>{o.name}</option>
                            ))}
                        </select>
                      ) : (
                        <span style={{ color: 'var(--text2)' }}>
                          {u.reportsTo ? (userName[u.reportsTo] || u.reportsTo) : '—'}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
