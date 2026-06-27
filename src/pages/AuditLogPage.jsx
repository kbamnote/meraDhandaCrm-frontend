/**
 * Audit Log — read-only viewer of tenant audit events (auditApi.list).
 * Fetch-on-mount + a Refresh button + an Action filter (catalog + All) that
 * re-fetches. Renders a table: Time, Actor, Action (badge), Summary, Target.
 * Super Admin module — REST fetch only (no realtime).
 */
import { useEffect, useState } from 'react';
import { auditApi } from '../services/api';
import { useT } from '../i18n/LanguageContext';

const ACTIONS = [
  'user.create', 'role.change', 'user.update',
  'apikey.create', 'apikey.revoke',
  'webhook.create', 'webhook.delete',
  'domain.set', 'domain.verify',
  'referral.signup',
];

// badge tone per action group
const ACTION_TONE = {
  'user.create': 'badge-green',
  'role.change': 'badge-amber',
  'user.update': 'badge-blue',
  'apikey.create': 'badge-green',
  'apikey.revoke': 'badge-red',
  'webhook.create': 'badge-green',
  'webhook.delete': 'badge-red',
  'domain.set': 'badge-blue',
  'domain.verify': 'badge-green',
  'referral.signup': 'badge-amber',
};

const S = {
  title:   { en: '📜 Audit Log', hi: '📜 ऑडिट लॉग', hinglish: '📜 Audit Log', gu: '📜 ઓડિટ લોગ', mr: '📜 ऑडिट लॉग', mwr: '📜 ऑडिट लॉग' },
  refresh: { en: 'Refresh', hi: 'रिफ्रेश', hinglish: 'Refresh', gu: 'રિફ્રેશ', mr: 'रिफ्रेश', mwr: 'रिफ्रेश' },
  all:     { en: 'All actions', hi: 'सभी एक्शन', hinglish: 'All actions', gu: 'બધી ક્રિયાઓ', mr: 'सर्व क्रिया', mwr: 'सगळी एक्शन' },
  time:    { en: 'Time', hi: 'समय', hinglish: 'Time', gu: 'સમય', mr: 'वेळ', mwr: 'टैम' },
  actor:   { en: 'Actor', hi: 'एक्टर', hinglish: 'Actor', gu: 'કર્તા', mr: 'कर्ता', mwr: 'एक्टर' },
  action:  { en: 'Action', hi: 'एक्शन', hinglish: 'Action', gu: 'ક્રિયા', mr: 'क्रिया', mwr: 'एक्शन' },
  summary: { en: 'Summary', hi: 'सारांश', hinglish: 'Summary', gu: 'સારાંશ', mr: 'सारांश', mwr: 'सारांश' },
  target:  { en: 'Target', hi: 'टारगेट', hinglish: 'Target', gu: 'લક્ષ્ય', mr: 'लक्ष्य', mwr: 'टारगेट' },
  none:    { en: 'No audit events yet.', hi: 'अभी कोई ऑडिट इवेंट नहीं।', hinglish: 'Abhi koi audit event nahi.', gu: 'હજુ કોઈ ઓડિટ ઇવેન્ટ નથી.', mr: 'अद्याप ऑडिट इव्हेंट नाही.', mwr: 'अजे कोई ऑडिट इवेंट कोनी।' },
};

export default function AuditLogPage() {
  const t = useT(S);
  const [action, setAction] = useState('');
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    setBusy(true);
    auditApi.list({ limit: 200, action: action || undefined })
      .then((r) => setRows(Array.isArray(r) ? r : r?.rows || []))
      .catch(() => setRows([]))
      .finally(() => setBusy(false));
  };

  useEffect(() => { load(); }, [action]); // eslint-disable-line

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>{t('title')}</h2>
        <div className="flex gap-2 items-center">
          <select className="input btn-sm" style={{ width: 'auto' }} value={action} onChange={(e) => setAction(e.target.value)}>
            <option value="">{t('all')}</option>
            {ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <button className="btn btn-ghost btn-sm" onClick={load} disabled={busy}>{busy ? '…' : t('refresh')}</button>
        </div>
      </div>

      {!rows ? (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>…</div>
      ) : !rows.length ? (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>{t('none')}</div>
      ) : (
        <div className="card" style={{ overflowX: 'auto', padding: 0 }}>
          <table className="crm-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>{t('time')}</th>
                <th>{t('actor')}</th>
                <th>{t('action')}</th>
                <th>{t('summary')}</th>
                <th>{t('target')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row._id || `${row.ts}-${row.action}`}>
                  <td style={{ whiteSpace: 'nowrap', fontSize: 12, color: 'var(--text2)' }}>
                    {row.ts ? new Date(row.ts).toLocaleString() : '—'}
                  </td>
                  <td style={{ fontSize: 13 }}>{row.actorName || row.actorId || '—'}</td>
                  <td><span className={`badge ${ACTION_TONE[row.action] || 'badge-blue'}`}>{row.action || '—'}</span></td>
                  <td style={{ fontSize: 13, color: 'var(--text2)' }}>{row.summary || '—'}</td>
                  <td style={{ fontSize: 12, color: 'var(--text3)' }}>
                    {row.targetType ? `${row.targetType}${row.targetId ? ` · ${row.targetId}` : ''}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
