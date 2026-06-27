/**
 * HR — Payroll. Compute each staff member's salary for a month from attendance
 * (base − absent-day deductions) and optionally generate the slips (persisted to
 * payroll so staff see them under My Salary). hrApi, admin/hr only.
 */
import { useEffect, useState } from 'react';
import { hrApi } from '../services/api';
import { useT } from '../i18n/LanguageContext';
import { showToast } from '../components/common/toast';

const inr = (n) => '₹' + (Math.round((Number(n) || 0) * 100) / 100).toLocaleString('en-IN');

const S = {
  title:    { en: '💵 Payroll', hi: '💵 पेरोल', hinglish: '💵 Payroll', gu: '💵 પેરોલ', mr: '💵 पेरोल', mwr: '💵 पेरोल' },
  month:    { en: 'Month', hi: 'महीना', hinglish: 'Month', gu: 'મહિનો', mr: 'महिना', mwr: 'महीनो' },
  compute:  { en: 'Compute', hi: 'गणना करें', hinglish: 'Compute', gu: 'ગણતરી', mr: 'गणना', mwr: 'गणना' },
  generate: { en: 'Generate slips', hi: 'स्लिप जनरेट करें', hinglish: 'Slips generate karein', gu: 'સ્લિપ જનરેટ કરો', mr: 'स्लिप तयार करा', mwr: 'स्लिप जनरेट करो' },
  staff:    { en: 'Staff', hi: 'स्टाफ', hinglish: 'Staff', gu: 'સ્ટાફ', mr: 'कर्मचारी', mwr: 'स्टाफ' },
  base:     { en: 'Base', hi: 'बेसिक', hinglish: 'Base', gu: 'બેઝ', mr: 'मूळ', mwr: 'बेसिक' },
  present:  { en: 'Present', hi: 'उपस्थित', hinglish: 'Present', gu: 'હાજર', mr: 'उपस्थित', mwr: 'हाजर' },
  deduction:{ en: 'Deduction', hi: 'कटौती', hinglish: 'Deduction', gu: 'કપાત', mr: 'कपात', mwr: 'कटौती' },
  net:      { en: 'Net pay', hi: 'नेट पे', hinglish: 'Net pay', gu: 'નેટ પે', mr: 'निव्वळ', mwr: 'नेट पे' },
  none:     { en: 'No staff / salaries set. Add a "salary" field to staff users.', hi: 'कोई स्टाफ/सैलरी सेट नहीं।', hinglish: 'Koi staff/salary set nahi.', gu: 'કોઈ સ્ટાફ/પગાર સેટ નથી.', mr: 'स्टाफ/पगार सेट नाही.', mwr: 'कोई स्टाफ/सैलरी सेट कोनी।' },
  generated:{ en: 'Slips generated', hi: 'स्लिप जनरेट हो गईं', hinglish: 'Slips generate ho gayin', gu: 'સ્લિપ જનરેટ થઈ', mr: 'स्लिप तयार झाल्या', mwr: 'स्लिप जनरेट हो गी' },
  failed:   { en: 'Failed', hi: 'नहीं हुआ', hinglish: 'Fail hua', gu: 'નિષ્ફળ', mr: 'अयशस्वी', mwr: 'कोनी हुयो' },
};

export default function HrPayrollPage() {
  const t = useT(S);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);

  const compute = async () => {
    setBusy(true);
    try { setData(await hrApi.payrollCompute(month)); }
    catch (e) { showToast(e.response?.data?.error || t('failed'), 'error'); }
    finally { setBusy(false); }
  };
  useEffect(() => { compute(); }, []); // eslint-disable-line

  const generate = async () => {
    setBusy(true);
    try { const r = await hrApi.payrollGenerate(month); showToast(`${t('generated')} (${r.count})`, 'success'); }
    catch (e) { showToast(e.response?.data?.error || t('failed'), 'error'); }
    finally { setBusy(false); }
  };

  const total = (data?.rows || []).reduce((s, r) => s + (r.net || 0), 0);

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 14 }}>{t('title')}</h2>
      <div className="flex gap-2 mb-4" style={{ alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div className="form-group" style={{ margin: 0 }}><label>{t('month')}</label><input className="input" type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></div>
        <button className="btn btn-primary btn-sm" onClick={compute} disabled={busy}>{t('compute')}</button>
        <button className="btn btn-success btn-sm" onClick={generate} disabled={busy || !data?.rows?.length}>{t('generate')}</button>
      </div>

      {data && (
        <div className="card" style={{ padding: 0, overflow: 'auto' }}>
          {!data.rows.length ? (
            <div style={{ textAlign: 'center', padding: 30, color: 'var(--text3)' }}>{t('none')}</div>
          ) : (
            <table className="crm-table">
              <thead><tr><th>{t('staff')}</th><th>{t('base')}</th><th>{t('present')}</th><th>{t('deduction')}</th><th>{t('net')}</th></tr></thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.userId}>
                    <td>{r.name}</td><td>{inr(r.base)}</td>
                    <td>{r.present}/{data.workingDays}</td>
                    <td style={{ color: 'var(--red)' }}>− {inr(r.deduction)}</td>
                    <td style={{ fontWeight: 700 }}>{inr(r.net)}</td>
                  </tr>
                ))}
                <tr style={{ fontWeight: 700, borderTop: '2px solid var(--border)' }}>
                  <td colSpan={4}>Total</td><td>{inr(total)}</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
