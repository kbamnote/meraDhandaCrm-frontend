/**
 * Designers (admin) — manage the design team: see who's on leave and shift a
 * designer to a department. Writes go through the admin-gated designerManage
 * endpoint. The team = users whose role / customRole is "designer".
 */
import { useEffect, useMemo, useState } from 'react';
import { ref, onValue, db } from '../services/realtime';
import { ordersApi } from '../services/api';
import { useT } from '../i18n/LanguageContext';
import { showToast } from '../components/common/toast';

const S = {
  title:    { en: '🎨 Designers', hi: '🎨 डिज़ाइनर', hinglish: '🎨 Designers', gu: '🎨 ડિઝાઇનર', mr: '🎨 डिझाइनर', mwr: '🎨 डिज़ाइनर' },
  none:     { en: 'No designers yet. Set a user\'s role to "designer".', hi: 'अभी कोई डिज़ाइनर नहीं।', hinglish: 'Abhi koi designer nahi.', gu: 'હજુ કોઈ ડિઝાઇનર નથી.', mr: 'अद्याप डिझाइनर नाही.', mwr: 'अजे कोई डिज़ाइनर कोनी।' },
  onLeave:  { en: 'On leave', hi: 'छुट्टी पर', hinglish: 'On leave', gu: 'રજા પર', mr: 'रजेवर', mwr: 'छुट्टी पर' },
  active:   { en: 'Active', hi: 'एक्टिव', hinglish: 'Active', gu: 'એક્ટિવ', mr: 'सक्रिय', mwr: 'एक्टिव' },
  dept:     { en: 'Dept', hi: 'विभाग', hinglish: 'Dept', gu: 'વિભાગ', mr: 'विभाग', mwr: 'विभाग' },
  shift:    { en: 'Shift dept', hi: 'विभाग बदलें', hinglish: 'Shift dept', gu: 'વિભાગ બદલો', mr: 'विभाग बदला', mwr: 'विभाग बदलो' },
  shiftQ:   { en: 'Department name (blank to clear):', hi: 'विभाग का नाम:', hinglish: 'Department name:', gu: 'વિભાગનું નામ:', mr: 'विभागाचे नाव:', mwr: 'विभाग रो नाम:' },
  setLeave: { en: 'Put on leave', hi: 'छुट्टी पर भेजें', hinglish: 'On leave karein', gu: 'રજા પર મૂકો', mr: 'रजेवर ठेवा', mwr: 'छुट्टी पर भेजो' },
  setActive:{ en: 'Mark active', hi: 'एक्टिव करें', hinglish: 'Active karein', gu: 'એક્ટિવ કરો', mr: 'सक्रिय करा', mwr: 'एक्टिव करो' },
  updated:  { en: 'Updated', hi: 'अपडेट हुआ', hinglish: 'Update hua', gu: 'અપડેટ થયું', mr: 'अपडेट झाले', mwr: 'अपडेट हुयो' },
  failed:   { en: 'Failed', hi: 'नहीं हुआ', hinglish: 'Fail hua', gu: 'નિષ્ફળ', mr: 'अयशस्वी', mwr: 'कोनी हुयो' },
};

export default function DesignersPage() {
  const t = useT(S);
  const [users, setUsers] = useState({});

  useEffect(() => {
    const u = onValue(ref(db, 'mpw/users'), (snap) => setUsers(snap.val() || {}));
    return () => u();
  }, []);

  const designers = useMemo(
    () => Object.entries(users).map(([id, u]) => ({ ...u, id }))
      .filter((u) => u.role === 'designer' || u.customRole === 'designer'),
    [users]
  );

  const manage = async (uid, body, ok) => {
    try { await ordersApi.designerManage(uid, body); showToast(ok || t('updated'), 'success'); }
    catch (e) { showToast(e.response?.data?.error || t('failed'), 'error'); }
  };

  const shift = (u) => {
    const dept = window.prompt(t('shiftQ'), u.department || '');
    if (dept === null) return;
    manage(u.id, { department: dept.trim() });
  };

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>{t('title')} ({designers.length})</h2>
      {!designers.length && <div className="card" style={{ textAlign: 'center', padding: 30, color: 'var(--text3)' }}>{t('none')}</div>}
      {designers.map((u) => (
        <div key={u.id} className="card" style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 15 }}>
                {u.name || u.email || u.phone || u.id}{' '}
                <span className={`badge ${u.onLeave ? 'badge-amber' : 'badge-green'}`}>{u.onLeave ? `🌴 ${t('onLeave')}` : `✓ ${t('active')}`}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
                {t('dept')}: {u.department || '—'}
              </div>
            </div>
            <div className="flex gap-2">
              <button className="btn btn-ghost btn-sm" onClick={() => shift(u)}>{t('shift')}</button>
              <button className="btn btn-sm" onClick={() => manage(u.id, { onLeave: !u.onLeave })}
                style={{ background: u.onLeave ? 'var(--surface2)' : 'var(--amber)', color: u.onLeave ? 'var(--text2)' : '#fff', border: 'none' }}>
                {u.onLeave ? t('setActive') : t('setLeave')}
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
