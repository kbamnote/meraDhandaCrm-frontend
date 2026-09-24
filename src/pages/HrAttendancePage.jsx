/**
 * HR — Team Attendance. Owner / admin / HR view of every teammate's attendance
 * for a chosen day (present AND absent), with the punch-in/out selfies captured
 * on the mobile app. Click a selfie to enlarge. Data via hrApi.attendance(date).
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
};

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

function UserAttendanceModal({ user, onClose }) {
  const todayStr = new Date().toISOString().slice(0, 7);
  const [month, setMonth] = useState(todayStr);
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState([]);

  useEffect(() => {
    setLoading(true);
    hrApi.userAttendance(user.userId, month)
      .then((res) => setRecords(Array.isArray(res) ? res : []))
      .catch((e) => showToast('Failed to load user attendance', 'error'))
      .finally(() => setLoading(false));
  }, [user.userId, month]);

  const [y, m] = month.split('-');
  const end = new Date(y, m, 0);
  const today = new Date();
  const maxDate = (today.getFullYear() == y && today.getMonth() == m - 1) ? today : end;
  
  let workingDays = 0;
  const allDays = [];
  
  for (let d = 1; d <= maxDate.getDate(); d++) {
    const dateStr = `${y}-${m}-${String(d).padStart(2, '0')}`;
    const isSunday = new Date(y, m - 1, d).getDay() === 0;
    if (!isSunday) workingDays++;
    
    const record = records.find(r => r.date === dateStr);
    allDays.push({
      date: dateStr,
      isSunday,
      record
    });
  }
  
  allDays.reverse(); // Show newest first

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
          <input type="month" className="input" value={month} max={todayStr} onChange={(e) => setMonth(e.target.value)} />
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

  useEffect(() => { load(date); }, [date, load]);

  const presentCount = rows.filter((r) => r.status !== 'absent').length;

  return (
    <div data-legacy-id="page-hr-attendance">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600 }}>{t('title')}</h2>
          <div style={{ fontSize: 13, color: 'var(--text2)' }}>
            {presentCount} {t('present')} {t('of')} {rows.length}
          </div>
        </div>
        <input
          type="date"
          className="input"
          style={{ maxWidth: 180 }}
          value={date}
          max={today}
          onChange={(e) => setDate(e.target.value || today)}
        />
      </div>

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

      {zoom && (
        <div
          onClick={() => setZoom(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, cursor: 'zoom-out' }}
        >
          <img src={zoom} alt="selfie" style={{ maxWidth: '90%', maxHeight: '90%', borderRadius: 12 }} />
        </div>
      )}

      {selectedUser && <UserAttendanceModal user={selectedUser} onClose={() => setSelectedUser(null)} />}
    </div>
  );
}
