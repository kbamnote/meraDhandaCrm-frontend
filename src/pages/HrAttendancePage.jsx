/**
 * HR — Team Attendance. Owner / admin / HR view of every teammate's attendance
 * for a chosen day (present AND absent), with the punch-in/out selfies captured
 * on the mobile app. Click a selfie to enlarge. Data via hrApi.attendance(date).
 *
 * "Date range" mode shows each teammate's totals over any custom period
 * (hrApi.attendanceSummary), and clicking a name lists their days in it.
 * Read-only (the punch itself happens on the app).
 */
import { useEffect, useState, useCallback } from 'react';
import { hrApi } from '../services/api';
import { useT } from '../i18n/LanguageContext';
import { showToast } from '../components/common/toast';

const S = {
  title: { en: '🕒 Team Attendance', hi: '🕒 टीम उपस्थिति', hinglish: '🕒 Team Attendance', gu: '🕒 ટીમ હાજરી', mr: '🕒 टीम उपस्थिती', mwr: '🕒 टीम हाजरी' },
  present: { en: 'present', hi: 'उपस्थित', hinglish: 'present', gu: 'હાજર', mr: 'उपस्थित', mwr: 'हाजर' },
  of: { en: 'of', hi: 'में से', hinglish: 'of', gu: 'માંથી', mr: 'पैकी', mwr: 'में सूं' },
  thName: { en: 'Teammate', hi: 'टीममेट', hinglish: 'Teammate', gu: 'ટીમમેટ', mr: 'टीममेट', mwr: 'टीममेट' },
  thStatus: { en: 'Status', hi: 'स्थिति', hinglish: 'Status', gu: 'સ્થિતિ', mr: 'स्थिती', mwr: 'स्थिति' },
  thIn: { en: 'In', hi: 'इन', hinglish: 'In', gu: 'ઇન', mr: 'इन', mwr: 'इन' },
  thOut: { en: 'Out', hi: 'आउट', hinglish: 'Out', gu: 'આઉટ', mr: 'आउट', mwr: 'आउट' },
  thHours: { en: 'Hours', hi: 'घंटे', hinglish: 'Hours', gu: 'કલાક', mr: 'तास', mwr: 'घंटा' },
  thInSelfie: { en: 'In selfie', hi: 'इन सेल्फी', hinglish: 'In selfie', gu: 'ઇન સેલ્ફી', mr: 'इन सेल्फी', mwr: 'इन सेल्फी' },
  thOutSelfie: { en: 'Out selfie', hi: 'आउट सेल्फी', hinglish: 'Out selfie', gu: 'આઉટ સેલ્ફી', mr: 'आउट सेल्फी', mwr: 'आउट सेल्फी' },
  today: { en: 'Today', hi: 'आज', hinglish: 'Today', gu: 'આજે', mr: 'आज', mwr: 'आज' },
  noTeam: { en: 'No teammates found.', hi: 'कोई टीममेट नहीं।', hinglish: 'Koi teammate nahi.', gu: 'કોઈ ટીમમેટ નથી.', mr: 'टीममेट नाहीत.', mwr: 'कोई टीममेट कोनी।' },
  failed: { en: 'Failed to load', hi: 'लोड नहीं हुआ', hinglish: 'Load nahi hua', gu: 'લોડ નિષ્ફળ', mr: 'लोड झाले नाही', mwr: 'लोड कोनी हुयो' },
  day: { en: 'Day', hi: 'दिन', hinglish: 'Day', gu: 'દિવસ', mr: 'दिवस', mwr: 'दिन' },
  range: { en: 'Date range', hi: 'तारीख सीमा', hinglish: 'Date range', gu: 'તારીખ શ્રેણી', mr: 'तारीख श्रेणी', mwr: 'तारीख सीमा' },
  from: { en: 'From', hi: 'से', hinglish: 'From', gu: 'થી', mr: 'पासून', mwr: 'सूं' },
  to: { en: 'To', hi: 'तक', hinglish: 'To', gu: 'સુધી', mr: 'पर्यंत', mwr: 'तांई' },
  last7: { en: 'Last 7 days', hi: 'पिछले 7 दिन', hinglish: 'Last 7 days', gu: 'છેલ્લા 7 દિવસ', mr: 'मागील 7 दिवस', mwr: 'पाछला 7 दिन' },
  thisMonth: { en: 'This month', hi: 'इस महीने', hinglish: 'This month', gu: 'આ મહિને', mr: 'हा महिना', mwr: 'इण महीने' },
  lastMonth: { en: 'Last month', hi: 'पिछला महीना', hinglish: 'Last month', gu: 'ગયા મહિને', mr: 'मागील महिना', mwr: 'पाछलो महीनो' },
  workingDays: { en: 'working days', hi: 'कार्य दिवस', hinglish: 'working days', gu: 'કામકાજના દિવસ', mr: 'कामाचे दिवस', mwr: 'काम रा दिन' },
  thPresent: { en: 'Present', hi: 'उपस्थित', hinglish: 'Present', gu: 'હાજર', mr: 'उपस्थित', mwr: 'हाजर' },
  thLate: { en: 'Late', hi: 'देर से', hinglish: 'Late', gu: 'મોડા', mr: 'उशीरा', mwr: 'मोड़ो' },
  thHalf: { en: 'Half day', hi: 'आधा दिन', hinglish: 'Half day', gu: 'અડધો દિવસ', mr: 'अर्धा दिवस', mwr: 'आधो दिन' },
  thLeave: { en: 'Leave', hi: 'छुट्टी', hinglish: 'Leave', gu: 'રજા', mr: 'रजा', mwr: 'छुट्टी' },
  thAbsent: { en: 'Absent', hi: 'अनुपस्थित', hinglish: 'Absent', gu: 'ગેરહાજર', mr: 'अनुपस्थित', mwr: 'गैरहाजर' },
  badRange: { en: 'From date must be on or before To date', hi: 'शुरू की तारीख अंत की तारीख से पहले होनी चाहिए', hinglish: 'From date, To date se pehle honi chahiye', gu: 'શરૂઆતની તારીખ અંતની તારીખ પહેલાં હોવી જોઈએ', mr: 'सुरुवातीची तारीख शेवटच्या तारखेपूर्वी असावी', mwr: 'सरू री तारीख आखिरी तारीख सूं पैला होवणी चाईजे' },
};

// ── Date helpers (local calendar dates as 'YYYY-MM-DD') ────────────────────
const pad2 = (n) => String(n).padStart(2, '0');
const isoDay = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const parseDay = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };

// Quick picks for the range mode. `today` is passed in so they agree with the
// page's own idea of today.
export function rangePreset(kind, today) {
  const t = parseDay(today);
  if (kind === 'last7') { const f = new Date(t); f.setDate(f.getDate() - 6); return { from: isoDay(f), to: today }; }
  if (kind === 'thisMonth') return { from: isoDay(new Date(t.getFullYear(), t.getMonth(), 1)), to: today };
  if (kind === 'lastMonth') {
    return { from: isoDay(new Date(t.getFullYear(), t.getMonth() - 1, 1)), to: isoDay(new Date(t.getFullYear(), t.getMonth(), 0)) };
  }
  return null;
}

// Every day from `from` to `to` (capped at `today`), newest first, marking
// Sundays — the rows of the per-person view. Shared by month and range views.
export function listDays(from, to, today) {
  const end = to < today ? to : today;
  const out = [];
  for (let d = parseDay(from); isoDay(d) <= end; d.setDate(d.getDate() + 1)) {
    out.push({ date: isoDay(d), isSunday: d.getDay() === 0 });
  }
  return out.reverse();
}

const STATUS_BADGE = { present: 'badge-green', absent: 'badge-red', leave: 'badge-amber', 'half-day': 'badge-amber', late: 'badge-amber' };
const fmt = (ms) => (ms ? new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—');

function Thumb({ uri, onOpen }) {
  if (!uri) return <span style={{ color: 'var(--text3)' }}>—</span>;
  return (
    <img
      src={uri}
      alt="selfie"
      onClick={() => onOpen(uri)}
      style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', cursor: 'pointer', border: '1px solid var(--border)' }}
    />
  );
}

// `range` ({ from, to }) opens the view on that custom period (from the range
// mode); without it the view is month-by-month as before.
function UserAttendanceModal({ user, range, onClose }) {
  const todayStr = new Date().toISOString().slice(0, 7);
  const todayDay = isoDay(new Date());
  const [month, setMonth] = useState(todayStr);
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState([]);

  const from = range ? range.from : `${month}-01`;
  const to = range ? range.to : isoDay(new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0));

  useEffect(() => {
    setLoading(true);
    const req = range
      ? hrApi.userAttendanceRange(user.userId, range.from, range.to)
      : hrApi.userAttendance(user.userId, month);
    req
      .then((res) => setRecords(Array.isArray(res) ? res : []))
      .catch((e) => showToast('Failed to load user attendance', 'error'))
      .finally(() => setLoading(false));
  }, [user.userId, month, range]);

  const byDate = new Map(records.map((r) => [r.date, r]));
  const allDays = listDays(from, to, todayDay).map((d) => ({ ...d, record: byDate.get(d.date) }));
  const workingDays = allDays.filter((d) => !d.isSunday).length;

  const presentDays = records.filter(r => r.status && r.status !== 'absent').length;
  const absentDays = Math.max(0, workingDays - presentDays);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className="card" style={{ width: '100%', maxWidth: 500, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 18, fontWeight: 600 }}>{user.username}'s Attendance</h3>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 24, cursor: 'pointer', color: 'var(--text3)' }}>&times;</button>
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          {range ? (
            <div style={{ fontSize: 13, color: 'var(--text2)' }} data-testid="modal-range">{range.from} → {range.to}</div>
          ) : (
            <input type="month" className="input" value={month} max={todayStr} onChange={(e) => setMonth(e.target.value)} />
          )}
        </div>

        <div style={{ display: 'flex', gap: 16, marginBottom: 16, background: 'var(--surface2)', padding: 12, borderRadius: 8 }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text2)' }}>Present</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--green)' }}>{presentDays}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text2)' }}>Absent (approx)</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--red)' }}>{absentDays}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text2)' }}>Working Days</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{workingDays}</div>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? <div style={{ padding: 20, textAlign: 'center' }}>Loading...</div> : 
           (
             <table className="crm-table">
               <thead><tr><th>Date</th><th>Status</th><th>In</th><th>Out</th><th>In Selfie</th><th>Out Selfie</th></tr></thead>
               <tbody>
                 {allDays.map(({ date, isSunday, record }) => {
                   if (record) {
                     return (
                       <tr key={date}>
                         <td>{date}</td>
                         <td><span className={`badge ${STATUS_BADGE[String(record.status || '').toLowerCase()] || 'badge-blue'}`}>{record.status}</span></td>
                         <td>{fmt(record.checkIn)}</td>
                         <td>{fmt(record.checkOut)}</td>
                         <td><Thumb uri={record.inSelfie} onOpen={() => window.open(record.inSelfie, '_blank')} /></td>
                         <td><Thumb uri={record.outSelfie} onOpen={() => window.open(record.outSelfie, '_blank')} /></td>
                       </tr>
                     );
                   }
                   if (isSunday) {
                     return (
                       <tr key={date} style={{ background: 'var(--surface2)', opacity: 0.7 }}>
                         <td>{date}</td>
                         <td><span className="badge badge-gray">Sunday Off</span></td>
                         <td>—</td><td>—</td><td>—</td><td>—</td>
                       </tr>
                     );
                   }
                   return (
                     <tr key={date} style={{ background: '#fef2f2' }}>
                       <td>{date}</td>
                       <td><span className="badge badge-red">absent</span></td>
                       <td>—</td><td>—</td><td>—</td><td>—</td>
                     </tr>
                   );
                 })}
               </tbody>
             </table>
           )}
        </div>
      </div>
    </div>
  );
}

export default function HrAttendancePage() {
  const t = useT(S);
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  // 'day' = one day with selfies (as before); 'range' = totals over a period.
  const [mode, setMode] = useState('day');
  const [range, setRange] = useState(() => rangePreset('thisMonth', isoDay(new Date())));

  const load = useCallback(async (d) => {
    setLoading(true);
    try {
      const res = await hrApi.attendance(d);
      setRows(Array.isArray(res?.rows) ? res.rows : []);
    } catch (err) {
      showToast(err.response?.data?.error || t('failed'), 'error');
      setRows([]);
    } finally { setLoading(false); }
    // `t` from useT() is a fresh ref every render; depending on it makes `load`
    // unstable so the effect below re-fires every render → infinite re-fetch
    // loop (spinner never clears). Keep `load` stable with [] deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (mode === 'day') load(date); }, [date, load, mode]);

  const presentCount = rows.filter((r) => r.status !== 'absent').length;

  return (
    <div data-legacy-id="page-hr-attendance">
      <div className="flex items-center justify-between mb-4" style={{ flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600 }}>{t('title')}</h2>
          {mode === 'day' && (
            <div style={{ fontSize: 13, color: 'var(--text2)' }}>
              {presentCount} {t('present')} {t('of')} {rows.length}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2" style={{ flexWrap: 'wrap' }}>
          <div className="flex" style={{ gap: 4 }} role="tablist">
            <button type="button" className={`btn btn-sm ${mode === 'day' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setMode('day')}>{t('day')}</button>
            <button type="button" className={`btn btn-sm ${mode === 'range' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setMode('range')}>{t('range')}</button>
          </div>
          {mode === 'day' && (
            <input
              type="date"
              className="input"
              style={{ maxWidth: 180 }}
              value={date}
              max={today}
              onChange={(e) => setDate(e.target.value || today)}
            />
          )}
        </div>
      </div>

      {mode === 'range' ? (
        <RangeView t={t} range={range} setRange={setRange} today={today} onOpen={setSelectedUser} />
      ) : (
      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>…</div>
        ) : !rows.length ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>{t('noTeam')}</div>
        ) : (
          <table className="crm-table">
            <thead>
              <tr>
                <th>{t('thName')}</th>
                <th>{t('thStatus')}</th>
                <th>{t('thIn')}</th>
                <th>{t('thOut')}</th>
                <th>{t('thHours')}</th>
                <th>{t('thInSelfie')}</th>
                <th>{t('thOutSelfie')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.userId}>
                  <td>
                    <div onClick={() => setSelectedUser(r)} style={{ cursor: 'pointer', display: 'inline-block' }}>
                      <b style={{ color: 'var(--primary)', textDecoration: 'underline' }}>{r.username}</b>
                      {r.department ? <div style={{ fontSize: 11, color: 'var(--text3)' }}>{r.department}</div> : null}
                    </div>
                  </td>
                  <td><span className={`badge ${STATUS_BADGE[String(r.status || '').toLowerCase()] || 'badge-blue'}`}>{r.status}</span></td>
                  <td>{fmt(r.checkIn)}{r.inDistance != null ? <span style={{ color: 'var(--text3)', fontSize: 11 }}> · {r.inDistance}m</span> : null}</td>
                  <td>{fmt(r.checkOut)}{r.outDistance != null ? <span style={{ color: 'var(--text3)', fontSize: 11 }}> · {r.outDistance}m</span> : null}</td>
                  <td>{r.hours ? `${r.hours}h` : '—'}</td>
                  <td><Thumb uri={r.inSelfie} onOpen={setZoom} /></td>
                  <td><Thumb uri={r.outSelfie} onOpen={setZoom} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      )}

      {zoom && (
        <div
          onClick={() => setZoom(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, cursor: 'zoom-out' }}
        >
          <img src={zoom} alt="selfie" style={{ maxWidth: '90%', maxHeight: '90%', borderRadius: 12 }} />
        </div>
      )}

      {selectedUser && (
        <UserAttendanceModal
          user={selectedUser}
          range={mode === 'range' ? range : null}
          onClose={() => setSelectedUser(null)}
        />
      )}
    </div>
  );
}

// Totals per teammate over a custom period. Clicking a name opens their days in
// the same period.
function RangeView({ t, range, setRange, today, onOpen }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const valid = !!range.from && !!range.to && range.from <= range.to;

  useEffect(() => {
    if (!valid) return undefined;
    let cancelled = false;
    setLoading(true);
    hrApi.attendanceSummary(range.from, range.to)
      .then((res) => { if (!cancelled) setData(res); })
      .catch((err) => { if (!cancelled) { showToast(err.response?.data?.error || t('failed'), 'error'); setData(null); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // `t` is only used for the error text; keep it out of the deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.from, range.to, valid]);

  const rows = Array.isArray(data?.rows) ? data.rows : [];
  const setEnd = (k, v) => setRange((r) => ({ ...r, [k]: v || r[k] }));

  return (
    <>
      <div className="card" style={{ marginBottom: 12, display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label>{t('from')}</label>
          <input type="date" className="input" data-testid="range-from" value={range.from} max={today} onChange={(e) => setEnd('from', e.target.value)} />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label>{t('to')}</label>
          <input type="date" className="input" data-testid="range-to" value={range.to} max={today} onChange={(e) => setEnd('to', e.target.value)} />
        </div>
        <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
          {['last7', 'thisMonth', 'lastMonth'].map((k) => (
            <button key={k} type="button" className="btn btn-ghost btn-sm" onClick={() => setRange(rangePreset(k, today))}>{t(k)}</button>
          ))}
        </div>
        {valid && data && (
          <div style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--text2)' }} data-testid="working-days">
            {data.workingDays} {t('workingDays')}
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        {!valid ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--red)' }}>{t('badRange')}</div>
        ) : loading && !data ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>…</div>
        ) : !rows.length ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>{t('noTeam')}</div>
        ) : (
          <table className="crm-table" data-testid="range-table" style={{ opacity: loading ? 0.6 : 1 }}>
            <thead>
              <tr>
                <th>{t('thName')}</th>
                <th>{t('thPresent')}</th>
                <th>{t('thLate')}</th>
                <th>{t('thHalf')}</th>
                <th>{t('thLeave')}</th>
                <th>{t('thAbsent')}</th>
                <th>{t('thHours')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.userId}>
                  <td>
                    <div onClick={() => onOpen(r)} style={{ cursor: 'pointer', display: 'inline-block' }}>
                      <b style={{ color: 'var(--primary)', textDecoration: 'underline' }}>{r.username}</b>
                      {r.department ? <div style={{ fontSize: 11, color: 'var(--text3)' }}>{r.department}</div> : null}
                    </div>
                  </td>
                  <td><span className="badge badge-green">{r.present}</span></td>
                  <td>{r.late || '—'}</td>
                  <td>{r.halfDay || '—'}</td>
                  <td>{r.leave || '—'}</td>
                  <td>{r.absent ? <span className="badge badge-red">{r.absent}</span> : '—'}</td>
                  <td>{r.hours ? `${r.hours}h` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
