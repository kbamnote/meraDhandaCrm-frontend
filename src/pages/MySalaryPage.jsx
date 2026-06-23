/**
 * My Salary — personal self-service page.
 * Lists the caller's own salary slips via meApi.payroll().
 */
import { useEffect, useMemo, useState } from 'react';
import { meApi } from '../services/api';
import { showToast } from '../components/common/toast';
import { useT } from '../i18n/LanguageContext';

const S = {
  mySalary: { en: 'My Salary', hi: 'मेरी सैलरी', hinglish: 'My Salary', gu: 'મારો પગાર', mr: 'माझा पगार', mwr: 'म्हारी सैलरी' },
  slip: { en: 'slip', hi: 'स्लिप', hinglish: 'slip', gu: 'સ્લિપ', mr: 'स्लिप', mwr: 'स्लिप' },
  slips: { en: 'slips', hi: 'स्लिप', hinglish: 'slips', gu: 'સ્લિપ', mr: 'स्लिप', mwr: 'स्लिप' },
  totalNetPaid: { en: 'total net paid', hi: 'कुल नेट भुगतान', hinglish: 'total net paid', gu: 'કુલ નેટ ચૂકવેલ', mr: 'एकूण निव्वळ दिले', mwr: 'कुल नेट भुगतान' },
  failedLoad: { en: 'Failed to load salary slips', hi: 'सैलरी स्लिप लोड नहीं हुईं', hinglish: 'Salary slips load nahi huin', gu: 'પગાર સ્લિપ લોડ કરવામાં નિષ્ફળ', mr: 'पगार स्लिप लोड करता आल्या नाहीत', mwr: 'सैलरी स्लिप लोड कोनी हुई' },
  noSlips: { en: 'No salary slips yet.', hi: 'अभी तक कोई सैलरी स्लिप नहीं।', hinglish: 'Abhi tak koi salary slip nahi.', gu: 'હજુ સુધી કોઈ પગાર સ્લિપ નથી.', mr: 'अद्याप कोणत्याही पगार स्लिप नाहीत.', mwr: 'अजे तांई कोई सैलरी स्लिप कोनी।' },
  month: { en: 'Month', hi: 'महीना', hinglish: 'Month', gu: 'મહિનો', mr: 'महिना', mwr: 'महीनो' },
  year: { en: 'Year', hi: 'साल', hinglish: 'Year', gu: 'વર્ષ', mr: 'वर्ष', mwr: 'साल' },
  basic: { en: 'Basic', hi: 'बेसिक', hinglish: 'Basic', gu: 'બેઝિક', mr: 'मूळ', mwr: 'बेसिक' },
  allowances: { en: 'Allowances', hi: 'भत्ते', hinglish: 'Allowances', gu: 'ભથ્થાં', mr: 'भत्ते', mwr: 'भत्ता' },
  deductions: { en: 'Deductions', hi: 'कटौती', hinglish: 'Deductions', gu: 'કપાત', mr: 'कपात', mwr: 'कटौती' },
  net: { en: 'Net', hi: 'नेट', hinglish: 'Net', gu: 'નેટ', mr: 'निव्वळ', mwr: 'नेट' },
};

function inr(v) {
  const n = Number(v || 0);
  return '₹' + (Number.isFinite(n) ? n.toLocaleString('en-IN') : '0');
}

export default function MySalaryPage() {
  const t = useT(S);
  const [slips, setSlips] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await meApi.payroll();
        if (active) setSlips(Array.isArray(data) ? data : []);
      } catch (err) {
        showToast(err.response?.data?.error || t('failedLoad'), 'error');
        if (active) setSlips([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const totalNet = useMemo(
    () => slips.reduce((sum, s) => sum + Number(s.net || 0), 0),
    [slips]
  );

  if (loading) {
    return (
      <div data-legacy-id="page-my-salary" className="center-screen">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div data-legacy-id="page-my-salary">
      <div className="mb-4">
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>💰 {t('mySalary')}</h2>
        <div style={{ fontSize: 13, color: 'var(--text2)' }}>
          {slips.length} {slips.length === 1 ? t('slip') : t('slips')}
          {slips.length ? <> · {t('totalNetPaid')} {inr(totalNet)}</> : null}
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        {!slips.length ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>
            {t('noSlips')}
          </div>
        ) : (
          <table className="crm-table">
            <thead>
              <tr>
                <th>{t('month')}</th>
                <th>{t('year')}</th>
                <th style={{ textAlign: 'right' }}>{t('basic')}</th>
                <th style={{ textAlign: 'right' }}>{t('allowances')}</th>
                <th style={{ textAlign: 'right' }}>{t('deductions')}</th>
                <th style={{ textAlign: 'right' }}>{t('net')}</th>
              </tr>
            </thead>
            <tbody>
              {slips.map((s, i) => (
                <tr key={s.id || `${s.year || ''}-${s.month || ''}-${i}`}>
                  <td>{s.month || '—'}</td>
                  <td>{s.year || '—'}</td>
                  <td style={{ textAlign: 'right' }}>{inr(s.basic)}</td>
                  <td style={{ textAlign: 'right' }}>{inr(s.allowances)}</td>
                  <td style={{ textAlign: 'right' }}>{inr(s.deductions)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{inr(s.net)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
