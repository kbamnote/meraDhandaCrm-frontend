/**
 * HR — Team Attendance. Owner / admin / HR view of every teammate's attendance
 * for a chosen day (present AND absent), with punch-in/out selfies, late tracking
 * (morning timing: 10:30 AM), CSV downloading, and printing.
 *
 * "Date range" mode shows each teammate's totals over any custom period
 * (hrApi.attendanceSummary), and clicking a name lists their days in it.
 * Read-only (the punch itself happens on the app).
 */
import { useEffect, useState, useCallback } from 'react';
import { hrApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useT } from '../i18n/LanguageContext';
import { showToast } from '../components/common/toast';

const S = {
  title: { en: '🕒 Team Attendance', hi: '🕒 टीम उपस्थिति', hinglish: '🕒 Team Attendance', gu: '🕒 ટીમ હાજરી', mr: '🕒 टीम उपस्थिती', mwr: '🕒 टीम हाजरी' },
  present: { en: 'present', hi: 'उपस्थित', hinglish: 'present', gu: 'હાજર', mr: 'उपस्थित', mwr: 'हाजर' },
  of: { en: 'of', hi: 'में से', hinglish: 'of', gu: 'માંથી', mr: 'पैकी', mwr: 'में सूं' },
  thName: { en: 'Teammate', hi: 'टीममेट', hinglish: 'Teammate', gu: 'ટીમમેટ', mr: 'टीममेट', mwr: 'टीममेट' },
  thStatus: { en: 'Status', hi: 'स्थिति', hinglish: 'Status', gu: 'સ્થિતિ', mr: 'स्थिती', mwr: 'स्थिति' },
  thIn: { en: 'In Time', hi: 'इन टाइम', hinglish: 'In Time', gu: 'ઇન સમય', mr: 'इन वेळ', mwr: 'इन टेम' },
  thOut: { en: 'Out Time', hi: 'आउट टाइम', hinglish: 'Out Time', gu: 'આઉટ સમય', mr: 'आउट वेळ', mwr: 'आउट टेम' },
  thHours: { en: 'Hours', hi: 'घंटे', hinglish: 'Hours', gu: 'કલાક', mr: 'तास', mwr: 'घंटा' },
  thInSelfie: { en: 'In selfie', hi: 'इन सेल्फी', hinglish: 'In selfie', gu: 'ઇન સેલ્ફી', mr: 'इन सेल्फी', mwr: 'इन सेल्फी' },
  thOutSelfie: { en: 'Out selfie', hi: 'आउट सेल्फी', hinglish: 'Out selfie', gu: 'આઉટ સેલ્ફી', mr: 'आउट सेल्फी', mwr: 'आउट सेल्फी' },
  today: { en: 'Today', hi: 'आज', hinglish: 'Today', gu: 'આજે', mr: 'आज', mwr: 'आज' },
  noTeam: { en: 'No teammates found.', hi: 'कोई टीममेट नहीं।', hinglish: 'Koi teammate nahi.', gu: 'કોઈ ટીમમેટ નથી.', mr: 'टीममेट नाहीत.', mwr: 'कोई टीममेट कोनी।' },
  failed: { en: 'Failed to load', hi: 'लोड नहीं हुआ', hinglish: 'Load nahi hua', gu: 'લોડ નિષ્ફળ', mr: 'लोड झाले नाही', mwr: 'लोड कोनी हुयो' },
  day: { en: 'Day', hi: 'दिन', hinglish: 'Day', gu: 'દિવસ', mr: 'दिवस', mwr: 'दिन' },
  range: { en: 'Date range', hi: 'तारीख सीमा', hinglish: 'Date range', gu: 'તારીખ શ્રેણી', mr: 'तारीખ શ્રેણી', mwr: 'तारीख सीमा' },
  from: { en: 'From', hi: 'से', hinglish: 'From', gu: 'થી', mr: 'पासून', mwr: 'सूं' },
  to: { en: 'To', hi: 'तक', hinglish: 'To', gu: 'સુધી', mr: 'पर्यंत', mwr: 'तांई' },
  last7: { en: 'Last 7 days', hi: 'पिछले 7 दिन', hinglish: 'Last 7 days', gu: 'છેલ્લા 7 દિવસ', mr: 'मागील 7 दिवस', mwr: 'पाछला 7 दिन' },
  thisMonth: { en: 'This month', hi: 'इस महीने', hinglish: 'This month', gu: 'આ મહિને', mr: 'हा महिना', mwr: 'इण महीने' },
  lastMonth: { en: 'Last month', hi: 'पिछला महीना', hinglish: 'Last month', gu: 'ગયા મહિને', mr: 'मागील महिना', mwr: 'पाछलो महीनो' },
  workingDays: { en: 'working days', hi: 'कार्य दिवस', hinglish: 'working days', gu: 'કામકાજના દિવસ', mr: 'कामाचे दिवस', mwr: 'काम रा दिन' },
  thPresent: { en: 'Present', hi: 'उपस्थित', hinglish: 'Present', gu: 'હાજર', mr: 'उपस्थित', mwr: 'हाजर' },
  thLate: { en: 'Late', hi: 'देर से', hinglish: 'Late', gu: 'મોડા', mr: 'उशीरा', mwr: 'मोड़ो' },
  thHalf: { en: 'Half day', hi: 'आधा दिन', hinglish: 'Half day', gu: 'અડધો દિવસ', mr: 'अर्धा दिवस', mwr: 'आधो दिन' },
  thLeave: { en: 'Leave', hi: 'छुट्टी', hinglish: 'Leave', gu: 'રજા', mr: 'રજા', mwr: 'छुट्टी' },
  thAbsent: { en: 'Absent', hi: 'अनुपस्थित', hinglish: 'Absent', gu: 'ગેરહાજર', mr: 'अनुपस्थित', mwr: 'गैरहाजर' },
  badRange: { en: 'From date must be on or before To date', hi: 'शुरू की तारीख अंत की तारीख से पहले होनी चाहिए', hinglish: 'From date, To date se pehle honi chahiye', gu: 'શરૂઆતની તારીખ અંતની તારીખ પહેલાં હોવી જોઈએ', mr: 'सुरुवातीची तारीख शेवटच्या तारखेपूर्वी असावी', mwr: 'सरू री तारीख आखिरी तारीख सूं पैला होवणी चाईजे' },
  downloadCsv: { en: '📥 Download CSV', hi: '📥 डाउनलोड CSV', hinglish: '📥 Download CSV', gu: '📥 ડાઉનલોડ CSV', mr: '📥 डाउनलोड CSV', mwr: '📥 डाउनलोड CSV' },
  print: { en: '🖨️ Print', hi: '🖨️ प्रिंट', hinglish: '🖨️ Print', gu: '🖨️ પ્રિન્ટ', mr: '🖨️ प्रिंट', mwr: '🖨️ प्रिंट' },
  timingNote: { en: 'Morning shift: 10:30 AM', hi: 'सुबह की शिफ्ट: 10:30 बजे', hinglish: 'Morning shift: 10:30 AM', gu: 'સવારની શિફ્ટ: 10:30 વાગ્યે', mr: 'सकाळची शिफ्ट: 10:30 वाजता', mwr: 'सवार री शिफ्ट: 10:30 बजे' },
};

// ── Date helpers (local calendar dates as 'YYYY-MM-DD') ────────────────────
const pad2 = (n) => String(n).padStart(2, '0');
const isoDay = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const parseDay = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };

// Morning timing cutoff: 10:30 AM IST (10 * 60 + 30 = 630 minutes from midnight IST)
export function isLateCheckIn(ms, cutoffMinutes = 630) {
  if (!ms) return false;
  const istDate = new Date(Number(ms) + 19800000); // UTC to IST (+5:30)
  const h = istDate.getUTCHours();
  const m = istDate.getUTCMinutes();
  return (h * 60 + m) > cutoffMinutes;
}

export function getLateMinutes(ms, cutoffMinutes = 630) {
  if (!ms) return 0;
  const istDate = new Date(Number(ms) + 19800000);
  const h = istDate.getUTCHours();
  const m = istDate.getUTCMinutes();
  const diff = (h * 60 + m) - cutoffMinutes;
  return diff > 0 ? diff : 0;
}

// Quick picks for the range mode.
export function rangePreset(kind, today) {
  const t = parseDay(today);
  if (kind === 'last7') { const f = new Date(t); f.setDate(f.getDate() - 6); return { from: isoDay(f), to: today }; }
  if (kind === 'thisMonth') return { from: isoDay(new Date(t.getFullYear(), t.getMonth(), 1)), to: today };
  if (kind === 'lastMonth') {
    return { from: isoDay(new Date(t.getFullYear(), t.getMonth() - 1, 1)), to: isoDay(new Date(t.getFullYear(), t.getMonth(), 0)) };
  }
  return null;
}

// Every day from `from` to `to` (capped at `today`), newest first, marking Sundays.
export function listDays(from, to, today) {
  const end = to < today ? to : today;
  const out = [];
  for (let d = parseDay(from); isoDay(d) <= end; d.setDate(d.getDate() + 1)) {
    out.push({ date: isoDay(d), isSunday: d.getDay() === 0 });
  }
  return out.reverse();
}

const STATUS_BADGE = { present: 'badge-green', absent: 'badge-red', leave: 'badge-amber', 'half-day': 'badge-amber', late: 'badge-amber' };
const fmt = (ms) => {
  if (!ms) return '—';
  return new Date(ms).toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

// CSV Export helper with UTF-8 BOM so Excel opens it correctly
function downloadCsv(filename, headers, rows) {
  const escapeCell = (val) => {
    if (val == null) return '""';
    const s = String(val).replace(/"/g, '""');
    return `"${s}"`;
  };
  const csvContent = [
    headers.map(escapeCell).join(','),
    ...rows.map((row) => row.map(escapeCell).join(',')),
  ].join('\r\n');

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

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

// `range` ({ from, to }) opens the view on that custom period; without it the view is month-by-month.
function UserAttendanceModal({ user, range, onClose, companyName }) {
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
      .catch(() => showToast('Failed to load user attendance', 'error'))
      .finally(() => setLoading(false));
  }, [user.userId, month, range]);

  const byDate = new Map(records.map((r) => [r.date, r]));
  const allDays = listDays(from, to, todayDay).map((d) => ({ ...d, record: byDate.get(d.date) }));
  const workingDays = allDays.filter((d) => !d.isSunday).length;

  const lateDays = records.filter((r) => r.isLate || (r.checkIn && isLateCheckIn(r.checkIn))).length;
  const presentDays = records.filter((r) => r.status && r.status !== 'absent').length;
  const onTimeDays = Math.max(0, presentDays - lateDays);
  const absentDays = Math.max(0, workingDays - presentDays);

  const handleDownloadCsv = () => {
    if (!allDays.length) {
      showToast('No records to download', 'info');
      return;
    }
    const headers = ['Date', 'Day', 'Status', 'In Time', 'Late Status', 'Out Time', 'Hours Worked'];
    const dataRows = allDays.map(({ date, isSunday, record }) => {
      const dayName = new Date(date + 'T12:00:00Z').toLocaleDateString('en-IN', { weekday: 'short' });
      if (record) {
        const late = record.isLate || (record.checkIn && isLateCheckIn(record.checkIn));
        const lateMins = record.lateMinutes || (record.checkIn ? getLateMinutes(record.checkIn) : 0);
        const lateStr = late ? `Late by ${lateMins} mins` : (record.checkIn ? 'On time' : '—');
        const effStatus = (record.status === 'present' && late) ? 'late' : (record.status || 'present');
        return [
          date,
          dayName,
          effStatus,
          fmt(record.checkIn),
          lateStr,
          fmt(record.checkOut),
          record.hours ? `${record.hours}h` : '0h',
        ];
      }
      return [
        date,
        dayName,
        isSunday ? 'Sunday Off' : 'Absent',
        '—',
        '—',
        '—',
        '0h',
      ];
    });
    const safeName = (user.username || 'user').replace(/[^a-zA-Z0-9_-]/g, '_');
    downloadCsv(`Attendance_${safeName}_${from}_to_${to}.csv`, headers, dataRows);
    showToast(`${user.username}'s Attendance CSV downloaded`, 'success');
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className="card" style={{ width: '100%', maxWidth: 760, maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
        
        {/* Printable header only visible when printed */}
        <div className="print-only" style={{ marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>{companyName || 'MeraDhanda CRM'}</h2>
          <h4 style={{ margin: '3px 0 0', fontSize: 14, color: '#333' }}>
            Attendance Record: <b>{user.username}</b> {user.department ? `(${user.department})` : ''}
          </h4>
          <div style={{ fontSize: 11, color: '#555' }}>
            Period: <b>{from} → {to}</b> | Morning office timing: <b>10:30 AM</b>
          </div>
          <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>
            Present: <b>{presentDays}</b> ({onTimeDays} on-time, {lateDays} late) | Absent: <b>{absentDays}</b> | Working Days: <b>{workingDays}</b>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>{user.username}&apos;s Attendance</h3>
            <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 2 }}>
              ⏰ Morning timing: <b>10:30 AM</b> (Punches after 10:30 AM marked as Late)
            </div>
          </div>
          <div className="flex items-center gap-2 no-print">
            <button type="button" className="btn btn-ghost btn-xs" onClick={handleDownloadCsv} title="Download CSV">
              📥 Download CSV
            </button>
            <button type="button" className="btn btn-ghost btn-xs" onClick={() => window.print()} title="Print">
              🖨️ Print
            </button>
            <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 24, cursor: 'pointer', color: 'var(--text3)', marginLeft: 6 }}>&times;</button>
          </div>
        </div>

        <div className="no-print" style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
          {range ? (
            <div style={{ fontSize: 13, color: 'var(--text2)' }} data-testid="modal-range">📅 {range.from} → {range.to}</div>
          ) : (
            <input type="month" className="input" value={month} max={todayStr} onChange={(e) => setMonth(e.target.value)} />
          )}
        </div>

        <div style={{ display: 'flex', gap: 16, marginBottom: 14, background: 'var(--surface2)', padding: 12, borderRadius: 8, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text2)' }}>Present</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--green)' }}>{presentDays}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text2)' }}>Late (after 10:30 AM)</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#d97706' }}>{lateDays}</div>
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
               <thead>
                 <tr>
                   <th>Date</th>
                   <th>Status</th>
                   <th>In Time</th>
                   <th>Out Time</th>
                   <th className="selfie-col">In Selfie</th>
                   <th className="selfie-col">Out Selfie</th>
                 </tr>
               </thead>
               <tbody>
                 {allDays.map(({ date, isSunday, record }) => {
                   if (record) {
                     const late = record.isLate || (record.checkIn && isLateCheckIn(record.checkIn));
                     const lateMins = record.lateMinutes || (record.checkIn ? getLateMinutes(record.checkIn) : 0);
                     const effectiveStatus = (record.status === 'present' && late) ? 'late' : (record.status || 'present');
                     return (
                       <tr key={date}>
                         <td><b>{date}</b></td>
                         <td>
                           <span className={`badge ${STATUS_BADGE[String(effectiveStatus).toLowerCase()] || 'badge-blue'}`}>
                             {effectiveStatus}
                           </span>
                         </td>
                         <td>
                           <div>
                             <b>{fmt(record.checkIn)}</b>
                             {late ? (
                               <div style={{ fontSize: 11, color: '#d97706', fontWeight: 600 }}>⚠️ {lateMins}m late</div>
                             ) : record.checkIn ? (
                               <div style={{ fontSize: 11, color: '#16a34a' }}>✓ On time</div>
                             ) : null}
                           </div>
                         </td>
                         <td>{fmt(record.checkOut)}</td>
                         <td className="selfie-col"><Thumb uri={record.inSelfie} onOpen={() => window.open(record.inSelfie, '_blank')} /></td>
                         <td className="selfie-col"><Thumb uri={record.outSelfie} onOpen={() => window.open(record.outSelfie, '_blank')} /></td>
                       </tr>
                     );
                   }
                   if (isSunday) {
                     return (
                       <tr key={date} style={{ background: 'var(--surface2)', opacity: 0.7 }}>
                         <td>{date}</td>
                         <td><span className="badge badge-gray">Sunday Off</span></td>
                         <td>—</td><td>—</td>
                         <td className="selfie-col">—</td><td className="selfie-col">—</td>
                       </tr>
                     );
                   }
                   return (
                     <tr key={date} style={{ background: '#fef2f2' }}>
                       <td>{date}</td>
                       <td><span className="badge badge-red">absent</span></td>
                       <td>—</td><td>—</td>
                       <td className="selfie-col">—</td><td className="selfie-col">—</td>
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
  const { tenant } = useAuth();
  const companyName = tenant?.name || 'MeraDhanda CRM';
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  // 'day' = one day with selfies; 'range' = totals over a period.
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
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (mode === 'day') load(date); }, [date, load, mode]);

  const presentCount = rows.filter((r) => r.status !== 'absent').length;
  const lateCount = rows.filter((r) => r.isLate || (r.checkIn && isLateCheckIn(r.checkIn))).length;
  const onTimeCount = Math.max(0, presentCount - lateCount);

  // Day view CSV export
  const handleDownloadDayCsv = () => {
    if (!rows.length) {
      showToast('No records to download', 'info');
      return;
    }
    const headers = ['Teammate', 'Department', 'Date', 'Status', 'In Time', 'Late Status', 'Out Time', 'Hours Worked'];
    const dataRows = rows.map((r) => {
      const late = r.isLate || (r.checkIn && isLateCheckIn(r.checkIn));
      const lateMins = r.lateMinutes || (r.checkIn ? getLateMinutes(r.checkIn) : 0);
      const lateStr = late ? `Late by ${lateMins} mins` : (r.checkIn ? 'On time' : '—');
      const effStatus = (r.status === 'present' && late) ? 'late' : r.status;
      return [
        r.username || '—',
        r.department || '—',
        date,
        effStatus || '—',
        fmt(r.checkIn),
        lateStr,
        fmt(r.checkOut),
        r.hours ? `${r.hours}h` : '0h',
      ];
    });
    downloadCsv(`Attendance_${date}.csv`, headers, dataRows);
    showToast('Attendance CSV downloaded', 'success');
  };

  return (
    <div data-legacy-id="page-hr-attendance">
      <style>{`
        @media print {
          @page { margin: 10mm; size: auto; }
          nav, aside, .sidebar, header, .app-header, .no-print, button, .btn, input, select {
            display: none !important;
          }
          body, html {
            background: #fff !important;
            color: #000 !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .print-only { display: block !important; }
          .card {
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            background: #fff !important;
            max-height: none !important;
            overflow: visible !important;
          }
          .crm-table {
            width: 100% !important;
            border-collapse: collapse !important;
            font-size: 10pt !important;
          }
          .crm-table th, .crm-table td {
            border: 1px solid #ccc !important;
            padding: 5px 8px !important;
            color: #000 !important;
          }
          .crm-table th { background-color: #f3f4f6 !important; font-weight: 700 !important; }
          .badge {
            border: 1px solid #777 !important;
            background: transparent !important;
            color: #000 !important;
            padding: 1px 4px !important;
            font-size: 8pt !important;
          }
          .selfie-col { display: none !important; }
        }
        @media screen {
          .print-only { display: none !important; }
        }
      `}</style>

      {/* Printable Header for Day Mode */}
      <div className="print-only" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #222', paddingBottom: 8 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20 }}>{companyName}</h2>
            <h4 style={{ margin: '3px 0 0', fontSize: 15, color: '#333' }}>Daily Team Attendance Report — {date}</h4>
            <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>
              Morning office timing: <b>10:30 AM</b> | Punches after 10:30 AM marked as Late
            </div>
          </div>
          <div style={{ textAlign: 'right', fontSize: 11, color: '#555' }}>
            <div>Printed: {new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</div>
            <div>Total Staff: {rows.length} | Present: {presentCount} ({onTimeCount} on time, {lateCount} late) | Absent: {rows.length - presentCount}</div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4 no-print" style={{ flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div className="flex items-center gap-2">
            <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>{t('title')}</h2>
            <span style={{ fontSize: 12, background: 'rgba(245,158,11,.15)', color: '#d97706', padding: '2px 8px', borderRadius: 12, fontWeight: 600 }}>
              ⏰ {t('timingNote')}
            </span>
          </div>
          {mode === 'day' && (
            <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 4 }}>
              <b>{presentCount}</b> {t('present')} ({onTimeCount} on-time, <b style={{ color: '#d97706' }}>{lateCount} late</b>) {t('of')} {rows.length}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2" style={{ flexWrap: 'wrap' }}>
          <div className="flex" style={{ gap: 4 }} role="tablist">
            <button type="button" className={`btn btn-sm ${mode === 'day' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setMode('day')}>{t('day')}</button>
            <button type="button" className={`btn btn-sm ${mode === 'range' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setMode('range')}>{t('range')}</button>
          </div>
          {mode === 'day' && (
            <>
              <input
                type="date"
                className="input"
                style={{ maxWidth: 170 }}
                value={date}
                max={today}
                onChange={(e) => setDate(e.target.value || today)}
              />
              <button type="button" className="btn btn-ghost btn-sm" onClick={handleDownloadDayCsv} title="Download Day Attendance CSV">
                {t('downloadCsv')}
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => window.print()} title="Print Day Attendance">
                {t('print')}
              </button>
            </>
          )}
        </div>
      </div>

      {mode === 'range' ? (
        <RangeView
          t={t}
          range={range}
          setRange={setRange}
          today={today}
          onOpen={setSelectedUser}
          companyName={companyName}
        />
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
                <th className="selfie-col">{t('thInSelfie')}</th>
                <th className="selfie-col">{t('thOutSelfie')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const late = r.isLate || (r.checkIn && isLateCheckIn(r.checkIn));
                const lateMins = r.lateMinutes || (r.checkIn ? getLateMinutes(r.checkIn) : 0);
                const effectiveStatus = (r.status === 'present' && late) ? 'late' : r.status;
                return (
                  <tr key={r.userId}>
                    <td>
                      <div onClick={() => setSelectedUser(r)} style={{ cursor: 'pointer', display: 'inline-block' }}>
                        <b style={{ color: 'var(--primary)', textDecoration: 'underline' }}>{r.username}</b>
                        {r.department ? <div style={{ fontSize: 11, color: 'var(--text3)' }}>{r.department}</div> : null}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${STATUS_BADGE[String(effectiveStatus || '').toLowerCase()] || 'badge-blue'}`}>
                        {effectiveStatus}
                      </span>
                    </td>
                    <td>
                      <div>
                        <b>{fmt(r.checkIn)}</b>
                        {late ? (
                          <div style={{ fontSize: 11, color: '#d97706', fontWeight: 600 }}>⚠️ {lateMins}m late</div>
                        ) : r.checkIn ? (
                          <div style={{ fontSize: 11, color: '#16a34a' }}>✓ On time</div>
                        ) : null}
                        {r.inDistance != null ? <span style={{ color: 'var(--text3)', fontSize: 11 }}> · {r.inDistance}m</span> : null}
                      </div>
                    </td>
                    <td>
                      {fmt(r.checkOut)}
                      {r.outDistance != null ? <span style={{ color: 'var(--text3)', fontSize: 11 }}> · {r.outDistance}m</span> : null}
                    </td>
                    <td>{r.hours ? `${r.hours}h` : '—'}</td>
                    <td className="selfie-col"><Thumb uri={r.inSelfie} onOpen={setZoom} /></td>
                    <td className="selfie-col"><Thumb uri={r.outSelfie} onOpen={setZoom} /></td>
                  </tr>
                );
              })}
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
          companyName={companyName}
        />
      )}
    </div>
  );
}

// Totals per teammate over a custom period.
function RangeView({ t, range, setRange, today, onOpen, companyName }) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.from, range.to, valid]);

  const rows = Array.isArray(data?.rows) ? data.rows : [];
  const setEnd = (k, v) => setRange((r) => ({ ...r, [k]: v || r[k] }));

  // Range view CSV export
  const handleDownloadRangeCsv = () => {
    if (!rows.length) {
      showToast('No records to download', 'info');
      return;
    }
    const headers = ['Teammate', 'Department', 'From', 'To', 'Present (On-time)', 'Late Days (After 10:30 AM)', 'Total Attended', 'Half Day', 'Leave', 'Absent', 'Total Hours'];
    const dataRows = rows.map((r) => [
      r.username || '—',
      r.department || '—',
      range.from,
      range.to,
      r.present != null ? r.present : 0,
      r.late != null ? r.late : 0,
      r.attended != null ? r.attended : ((r.present || 0) + (r.late || 0) + (r.halfDay || 0)),
      r.halfDay != null ? r.halfDay : 0,
      r.leave != null ? r.leave : 0,
      r.absent != null ? r.absent : 0,
      r.hours ? `${r.hours}h` : '0h',
    ]);
    downloadCsv(`Attendance_Summary_${range.from}_to_${range.to}.csv`, headers, dataRows);
    showToast('Attendance Summary CSV downloaded', 'success');
  };

  return (
    <>
      {/* Printable Header for Range Mode */}
      <div className="print-only" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #222', paddingBottom: 8 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20 }}>{companyName}</h2>
            <h4 style={{ margin: '3px 0 0', fontSize: 15, color: '#333' }}>
              Team Attendance Summary — {range.from} to {range.to}
            </h4>
            <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>
              Morning office timing: <b>10:30 AM</b> | Punches after 10:30 AM counted in Late column
            </div>
          </div>
          <div style={{ textAlign: 'right', fontSize: 11, color: '#555' }}>
            <div>Printed: {new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</div>
            <div>Working Days: <b>{data?.workingDays || '—'}</b> | Total Staff: <b>{rows.length}</b></div>
          </div>
        </div>
      </div>

      <div className="card no-print" style={{ marginBottom: 12, display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
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
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 13, color: 'var(--text2)' }} data-testid="working-days">
              {data.workingDays} {t('workingDays')}
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={handleDownloadRangeCsv} title="Download CSV summary">
              {t('downloadCsv')}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => window.print()} title="Print attendance summary">
              {t('print')}
            </button>
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
                  <td><span className="badge badge-green" title={`On-time present: ${r.present} / Total attended: ${r.attended || r.present}`}>{r.present}</span></td>
                  <td>
                    {r.late ? (
                      <span
                        className="badge badge-amber"
                        style={{ cursor: 'pointer', fontWeight: 700 }}
                        onClick={() => onOpen(r)}
                        title="Click to view days staff was late"
                      >
                        {r.late} late
                      </span>
                    ) : '—'}
                  </td>
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
