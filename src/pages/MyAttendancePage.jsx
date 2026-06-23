/**
 * My Attendance — personal self-service page.
 * Lists the caller's own attendance records via meApi.attendance().
 */
import { useEffect, useMemo, useState } from 'react';
import { meApi } from '../services/api';
import { showToast } from '../components/common/toast';
import { useT } from '../i18n/LanguageContext';

const S = {
  myAttendance: { en: 'My Attendance', hi: 'मेरी उपस्थिति', hinglish: 'My Attendance', gu: 'મારી હાજરી', mr: 'माझी उपस्थिती', mwr: 'म्हारी हाजरी' },
  totalDay: { en: 'day', hi: 'दिन', hinglish: 'day', gu: 'દિવસ', mr: 'दिवस', mwr: 'दिन' },
  totalDays: { en: 'days', hi: 'दिन', hinglish: 'days', gu: 'દિવસ', mr: 'दिवस', mwr: 'दिन' },
  total: { en: 'total', hi: 'कुल', hinglish: 'total', gu: 'કુલ', mr: 'एकूण', mwr: 'कुल' },
  present: { en: 'present', hi: 'उपस्थित', hinglish: 'present', gu: 'હાજર', mr: 'उपस्थित', mwr: 'हाजर' },
  failedLoad: { en: 'Failed to load attendance', hi: 'उपस्थिति लोड नहीं हुई', hinglish: 'Attendance load nahi hui', gu: 'હાજરી લોડ કરવામાં નિષ્ફળ', mr: 'उपस्थिती लोड करता आली नाही', mwr: 'हाजरी लोड कोनी हुई' },
  noRecords: { en: 'No attendance records yet.', hi: 'अभी तक कोई उपस्थिति रिकॉर्ड नहीं।', hinglish: 'Abhi tak koi attendance record nahi.', gu: 'હજુ સુધી કોઈ હાજરી રેકોર્ડ નથી.', mr: 'अद्याप कोणतेही उपस्थिती रेकॉर्ड नाहीत.', mwr: 'अजे तांई कोई हाजरी रिकॉर्ड कोनी।' },
  date: { en: 'Date', hi: 'तारीख', hinglish: 'Date', gu: 'તારીખ', mr: 'तारीख', mwr: 'तारीख' },
  login: { en: 'Login', hi: 'लॉगिन', hinglish: 'Login', gu: 'લોગિન', mr: 'लॉगिन', mwr: 'लॉगिन' },
  logout: { en: 'Logout', hi: 'लॉगआउट', hinglish: 'Logout', gu: 'લોગઆઉટ', mr: 'लॉगआउट', mwr: 'लॉगआउट' },
  status: { en: 'Status', hi: 'स्थिति', hinglish: 'Status', gu: 'સ્થિતિ', mr: 'स्थिती', mwr: 'स्थिति' },
};

const STATUS_BADGE = {
  present: 'badge-green',
  absent: 'badge-red',
  leave: 'badge-amber',
  'half-day': 'badge-amber',
  late: 'badge-amber',
};

export default function MyAttendancePage() {
  const t = useT(S);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await meApi.attendance();
        if (active) setRecords(Array.isArray(data) ? data : []);
      } catch (err) {
        showToast(err.response?.data?.error || t('failedLoad'), 'error');
        if (active) setRecords([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const presentCount = useMemo(
    () => records.filter(r => String(r.status || '').toLowerCase() === 'present').length,
    [records]
  );

  if (loading) {
    return (
      <div data-legacy-id="page-my-attendance" className="center-screen">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div data-legacy-id="page-my-attendance">
      <div className="mb-4">
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>🕒 {t('myAttendance')}</h2>
        <div style={{ fontSize: 13, color: 'var(--text2)' }}>
          {records.length} {t('total')} {records.length === 1 ? t('totalDay') : t('totalDays')} · {presentCount} {t('present')}
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        {!records.length ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>
            {t('noRecords')}
          </div>
        ) : (
          <table className="crm-table">
            <thead>
              <tr>
                <th>{t('date')}</th>
                <th>{t('login')}</th>
                <th>{t('logout')}</th>
                <th>{t('status')}</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r, i) => {
                const status = String(r.status || '').toLowerCase();
                return (
                  <tr key={r.id || `${r.date || ''}-${i}`}>
                    <td>{r.date || '—'}</td>
                    <td>{r.loginTime || '—'}</td>
                    <td>{r.logoutTime || '—'}</td>
                    <td>
                      {r.status
                        ? <span className={`badge ${STATUS_BADGE[status] || 'badge-blue'}`}>{r.status}</span>
                        : '—'}
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
