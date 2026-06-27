/**
 * My Attendance — self-service. Punch in/out for today (with optional GPS) and
 * see your own attendance history. Punch goes through meApi.punch.
 */
import { useEffect, useMemo, useState } from 'react';
import { meApi } from '../services/api';
import { showToast } from '../components/common/toast';
import { useT } from '../i18n/LanguageContext';

const S = {
  myAttendance: { en: 'My Attendance', hi: 'मेरी उपस्थिति', hinglish: 'My Attendance', gu: 'મારી હાજરી', mr: 'माझी उपस्थिती', mwr: 'म्हारी हाजरी' },
  total: { en: 'total', hi: 'कुल', hinglish: 'total', gu: 'કુલ', mr: 'एकूण', mwr: 'कुल' },
  days: { en: 'days', hi: 'दिन', hinglish: 'days', gu: 'દિવસ', mr: 'दिवस', mwr: 'दिन' },
  present: { en: 'present', hi: 'उपस्थित', hinglish: 'present', gu: 'હાજર', mr: 'उपस्थित', mwr: 'हाजर' },
  failedLoad: { en: 'Failed to load attendance', hi: 'उपस्थिति लोड नहीं हुई', hinglish: 'Attendance load nahi hui', gu: 'હાજરી લોડ નિષ્ફળ', mr: 'उपस्थिती लोड झाली नाही', mwr: 'हाजरी लोड कोनी हुई' },
  noRecords: { en: 'No attendance records yet.', hi: 'अभी तक कोई रिकॉर्ड नहीं।', hinglish: 'Abhi tak koi record nahi.', gu: 'હજુ કોઈ રેકોર્ડ નથી.', mr: 'अद्याप रेकॉर्ड नाही.', mwr: 'अजे कोई रिकॉर्ड कोनी।' },
  today: { en: 'Today', hi: 'आज', hinglish: 'Today', gu: 'આજે', mr: 'आज', mwr: 'आज' },
  punchIn: { en: '🟢 Punch In', hi: '🟢 पंच इन', hinglish: '🟢 Punch In', gu: '🟢 પંચ ઇન', mr: '🟢 पंच इन', mwr: '🟢 पंच इन' },
  punchOut: { en: '🔴 Punch Out', hi: '🔴 पंच आउट', hinglish: '🔴 Punch Out', gu: '🔴 પંચ આઉટ', mr: '🔴 पंच आउट', mwr: '🔴 पंच आउट' },
  punchedIn: { en: 'Punched in', hi: 'पंच इन हो गया', hinglish: 'Punch in ho gaya', gu: 'પંચ ઇન થયું', mr: 'पंच इन झाले', mwr: 'पंच इन हो ग्यो' },
  punchedOut: { en: 'Punched out', hi: 'पंच आउट हो गया', hinglish: 'Punch out ho gaya', gu: 'પંચ આઉટ થયું', mr: 'पंच आउट झाले', mwr: 'पंच आउट हो ग्यो' },
  in: { en: 'In', hi: 'इन', hinglish: 'In', gu: 'ઇન', mr: 'इन', mwr: 'इन' },
  out: { en: 'Out', hi: 'आउट', hinglish: 'Out', gu: 'આઉટ', mr: 'आउट', mwr: 'आउट' },
  date: { en: 'Date', hi: 'तारीख', hinglish: 'Date', gu: 'તારીખ', mr: 'तारीख', mwr: 'तारीख' },
  hours: { en: 'Hrs', hi: 'घंटे', hinglish: 'Hrs', gu: 'કલાક', mr: 'तास', mwr: 'घंटा' },
  status: { en: 'Status', hi: 'स्थिति', hinglish: 'Status', gu: 'સ્થિતિ', mr: 'स्थिती', mwr: 'स्थिति' },
  failed: { en: 'Failed', hi: 'नहीं हुआ', hinglish: 'Fail hua', gu: 'નિષ્ફળ', mr: 'अयशस्वी', mwr: 'कोनी हुयो' },
};

const STATUS_BADGE = { present: 'badge-green', absent: 'badge-red', leave: 'badge-amber', 'half-day': 'badge-amber', late: 'badge-amber' };
const fmt = (ms) => (ms ? new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—');
const getLoc = () => new Promise((resolve) => {
  if (!navigator.geolocation) return resolve(null);
  navigator.geolocation.getCurrentPosition(
    (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
    () => resolve(null), { timeout: 4000 });
});

export default function MyAttendancePage() {
  const t = useT(S);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try { const data = await meApi.attendance(); setRecords(Array.isArray(data) ? data : []); }
    catch (err) { showToast(err.response?.data?.error || t('failedLoad'), 'error'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const today = new Date().toISOString().slice(0, 10);
  const todayRec = useMemo(() => records.find((r) => r.date === today), [records, today]);
  const presentCount = useMemo(() => records.filter((r) => String(r.status || '').toLowerCase() === 'present').length, [records]);

  const punch = async (type) => {
    setBusy(true);
    try {
      const loc = await getLoc();
      await meApi.punch({ type, ...(loc || {}) });
      showToast(type === 'in' ? t('punchedIn') : t('punchedOut'), 'success');
      await load();
    } catch (e) { showToast(e.response?.data?.error || t('failed'), 'error'); }
    finally { setBusy(false); }
  };

  if (loading) return <div className="center-screen"><div className="spinner" /></div>;

  return (
    <div data-legacy-id="page-my-attendance">
      <div className="mb-4">
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>🕒 {t('myAttendance')}</h2>
        <div style={{ fontSize: 13, color: 'var(--text2)' }}>{records.length} {t('total')} {t('days')} · {presentCount} {t('present')}</div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase' }}>{t('today')} · {today}</div>
        <div style={{ fontSize: 13, color: 'var(--text2)', margin: '6px 0 10px' }}>
          {t('in')}: <b>{fmt(todayRec?.checkIn)}</b> · {t('out')}: <b>{fmt(todayRec?.checkOut)}</b>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-success btn-sm" onClick={() => punch('in')} disabled={busy || !!todayRec?.checkIn}>{t('punchIn')}</button>
          <button className="btn btn-danger btn-sm" onClick={() => punch('out')} disabled={busy || !todayRec?.checkIn || !!todayRec?.checkOut}>{t('punchOut')}</button>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        {!records.length ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>{t('noRecords')}</div>
        ) : (
          <table className="crm-table">
            <thead><tr><th>{t('date')}</th><th>{t('in')}</th><th>{t('out')}</th><th>{t('hours')}</th><th>{t('status')}</th></tr></thead>
            <tbody>
              {records.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '')).map((r, i) => {
                const status = String(r.status || '').toLowerCase();
                return (
                  <tr key={r.id || `${r.date || ''}-${i}`}>
                    <td>{r.date || '—'}</td>
                    <td>{r.loginTime || fmt(r.checkIn)}</td>
                    <td>{r.logoutTime || fmt(r.checkOut)}</td>
                    <td>{r.hours || '—'}</td>
                    <td>{r.status ? <span className={`badge ${STATUS_BADGE[status] || 'badge-blue'}`}>{r.status}</span> : '—'}</td>
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
