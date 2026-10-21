/**
 * Who rang how many people today, and how it went.
 *
 * Two numbers per person, and the difference between them is the point:
 * CALLS is how many times they pressed dial, LEADS is how many different
 * people they actually reached out to. A target measured in calls is a target
 * met by redialling the same number, so the list is sorted by leads.
 *
 * The day defaults to today and steps back a day at a time, because "what did
 * the team do yesterday" is the other question this answers.
 */
import { useCallback, useEffect, useState } from 'react';
import { salesApi } from '../../services/api';
import { useT } from '../../i18n/LanguageContext';
import { showToast } from './toast';

const S = {
  title:    { en: '📞 Calling', hi: '📞 कॉलिंग', hinglish: '📞 Calling', gu: '📞 કૉલિંગ', mr: '📞 कॉलिंग', mwr: '📞 कॉलिंग' },
  day:      { en: 'Day', hi: 'दिन', hinglish: 'Day', gu: 'દિવસ', mr: 'दिवस', mwr: 'दिन' },
  people:   { en: 'Callers', hi: 'कॉल करने वाले', hinglish: 'Callers', gu: 'કૉલ કરનાર', mr: 'कॉल करणारे', mwr: 'कॉल करण वाळा' },
  calls:    { en: 'Calls', hi: 'कॉल', hinglish: 'Calls', gu: 'કૉલ', mr: 'कॉल', mwr: 'कॉल' },
  leads:    { en: 'Leads contacted', hi: 'लीड्स कॉन्टैक्ट', hinglish: 'Leads contacted', gu: 'લીડ્સ સંપર્ક', mr: 'लीड्स संपर्क', mwr: 'लीड्स कॉन्टैक्ट' },
  none:     { en: 'Nobody made a call on this day.', hi: 'इस दिन कोई कॉल नहीं हुई।', hinglish: 'Is din koi call nahi hui.', gu: 'આ દિવસે કોઈ કૉલ નથી.', mr: 'या दिवशी कॉल झाला नाही.', mwr: 'इण दिन कोई कॉल कोनी हुयो।' },
  recent:   { en: 'Calls', hi: 'कॉल', hinglish: 'Calls', gu: 'કૉલ', mr: 'कॉल', mwr: 'कॉल' },
  failed:   { en: 'Could not load', hi: 'लोड नहीं हुआ', hinglish: 'Load nahi hua', gu: 'લોડ ન થયું', mr: 'लोड झाले नाही', mwr: 'लोड कोनी हुयो' },
  everyone: { en: 'Everyone', hi: 'सभी', hinglish: 'Everyone', gu: 'બધા', mr: 'सर्व', mwr: 'सगळा' },
};

const TONE = {
  interested: 'badge-green',
  already_customer: 'badge-green',
  call_back: 'badge-amber',
  no_answer: 'badge-blue',
  not_interested: 'badge-red',
  wrong_number: 'badge-red',
};

const today = () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
const shiftDay = (d, by) => {
  const [y, m, dd] = d.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, dd + by));
  return t.toISOString().slice(0, 10);
};
const clock = (ms) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export default function CallingReport() {
  const t = useT(S);
  const [day, setDay] = useState(today());
  const [who, setWho] = useState('');
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      setData(await salesApi.calls({ date: day, ...(who ? { userId: who } : {}) }));
    } catch (e) {
      showToast(e.response?.data?.error || t('failed'), 'error');
    } finally { setBusy(false); }
  }, [day, who, t]);

  useEffect(() => { load(); }, [load]);

  const people = (data && data.people) || [];
  const rows = (data && data.rows) || [];
  const labelOf = (key) => ((data && data.statuses) || []).find((s) => s.key === key)?.label || key;

  return (
    <div>
      <div className="flex items-center" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <button className="btn btn-ghost btn-xs" onClick={() => setDay((d) => shiftDay(d, -1))}>←</button>
        <input className="input" type="date" style={{ width: 160 }} value={day} max={today()}
          data-testid="calling-day" onChange={(e) => setDay(e.target.value)} />
        <button className="btn btn-ghost btn-xs" disabled={day >= today()}
          onClick={() => setDay((d) => shiftDay(d, 1))}>→</button>
        {data && data.seesTeam && people.length > 1 ? (
          <select className="input" style={{ width: 180 }} value={who} onChange={(e) => setWho(e.target.value)}>
            <option value="">{t('everyone')}</option>
            {people.map((p) => <option key={p.userId} value={p.userId}>{p.name}</option>)}
          </select>
        ) : null}
        {busy ? <span style={{ fontSize: 12, color: 'var(--text3)' }}>…</span> : null}
      </div>

      {!people.length ? (
        <div className="card" style={{ textAlign: 'center', padding: 30, color: 'var(--text3)' }}>{t('none')}</div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'auto', marginBottom: 14 }}>
          <table className="crm-table">
            <thead><tr>
              <th>{t('people')}</th><th>{t('leads')}</th><th>{t('calls')}</th><th>{t('recent')}</th>
            </tr></thead>
            <tbody>
              {people.map((p) => (
                <tr key={p.userId} data-testid="calling-person">
                  <td><b>{p.name}</b></td>
                  {/* Leads first and bolder: it is the number that means something. */}
                  <td><b style={{ fontSize: 15 }}>{p.leads}</b></td>
                  <td style={{ color: 'var(--text2)' }}>{p.calls}</td>
                  <td>
                    <div className="flex" style={{ gap: 4, flexWrap: 'wrap' }}>
                      {Object.entries(p.statuses || {}).map(([k, n]) => (
                        <span key={k} className={`badge ${TONE[k] || 'badge-blue'}`}>{labelOf(k)} {n}</span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
              <tr style={{ fontWeight: 700, borderTop: '2px solid var(--border)' }}>
                <td>Total</td>
                <td>{data.totals.leads}</td>
                <td>{data.totals.calls}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {rows.length ? (
        <div className="card" style={{ padding: 0, overflow: 'auto' }}>
          <table className="crm-table">
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td style={{ whiteSpace: 'nowrap', color: 'var(--text3)', fontSize: 12 }}>{clock(r.at)}</td>
                  <td>{r.leadName || '—'}<div style={{ fontSize: 12, color: 'var(--text2)' }}>{r.phone || ''}</div></td>
                  <td><span className={`badge ${TONE[r.status] || 'badge-blue'}`}>{r.statusLabel}</span></td>
                  <td style={{ fontSize: 12, color: 'var(--text2)' }}>
                    {r.note || ''}
                    {r.callBackDate ? <div>↻ {r.callBackDate}</div> : null}
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text3)', whiteSpace: 'nowrap' }}>{r.byName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
