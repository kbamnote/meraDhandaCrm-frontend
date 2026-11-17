/**
 * HR — Payroll. Compute each staff member's salary from attendance
 * (base − absent-day deductions) and optionally generate the slips (persisted to
 * payroll so staff see them under My Salary). hrApi, admin/hr only.
 *
 * Two ways to look at it. A MONTH is the pay cycle and the only thing that
 * can be turned into slips. A CUSTOM RANGE is for the questions that fall
 * between pay cycles — a fortnight, a notice period, somebody who joined
 * on the 12th — so it is a read-only view: the day rate stays salary ÷ 26 and
 * the pay is pro-rated to the range's own working days.
 */
import { useEffect, useState } from 'react';
import { hrApi } from '../services/api';
import { useT } from '../i18n/LanguageContext';
import { showToast } from '../components/common/toast';
import SalaryAdmin from '../components/common/SalaryAdmin';
import StaffSalarySlipModal from '../components/common/StaffSalarySlipModal';
import { useAuth } from '../context/AuthContext';

// The range defaults to this month so far, which is the most common thing
// an admin wants to look at mid-cycle.
const firstOfMonth = () => new Date().toISOString().slice(0, 8) + '01';
const inr = (n) => '₹' + (Math.round((Number(n) || 0) * 100) / 100).toLocaleString('en-IN');

const S = {
  title:    { en: '💵 Payroll', hi: '💵 पेरोल', hinglish: '💵 Payroll', gu: '💵 પેરોલ', mr: '💵 पेरोल', mwr: '💵 पेरोल' },
  month:    { en: 'Month', hi: 'महीना', hinglish: 'Month', gu: 'મહિનો', mr: 'મહિના', mwr: 'મહીનો' },
  compute:  { en: 'Compute', hi: 'गणना करें', hinglish: 'Compute', gu: 'ગણતરી', mr: 'गणना', mwr: 'गणना' },
  generate: { en: 'Generate slips', hi: 'स्लिप जनरेट करें', hinglish: 'Slips generate karein', gu: 'સ્લિપ જનરેટ કરો', mr: 'સ્લિપ તૈયાર करा', mwr: 'સ્લિપ जनरेट करो' },
  saveCycle: { en: 'Save', hi: 'सेव', hinglish: 'Save', gu: 'સેવ', mr: 'સેવ્હ', mwr: 'સેવ' },
  cycle:     { en: 'Pay cycle', hi: 'सैलरी साइकिल', hinglish: 'Pay cycle', gu: 'પગાર ચક્ર', mr: 'પગાર ચક્ર', mwr: 'સૈલરી સાઇકિલ' },
  covers:    { en: 'covers', hi: 'अवधि', hinglish: 'covers', gu: 'સમયગાળો', mr: 'કાલાવધી', mwr: 'અવધિ' },
  startsOn:  { en: 'Starts on day', hi: 'शुरू दिन', hinglish: 'Starts on day', gu: 'શરૂ દિવસ', mr: 'સુરુ દિવસ', mwr: 'સરૂ દિન' },
  cycleHint: { en: '1 = calendar month. 16 means the 16th of one month to the 15th of the next.', hi: '1 = पूरा महीना। 16 का मतलब 16 तारीख से अगली 15 तारीख तक।', hinglish: '1 = poora mahina. 16 matlab 16 se agli 15 tak.', gu: '1 = આખો મહિનો. 16 એટલે 16થી આગલી 15 સુધી.', mr: '1 = પૂર્ણ મહિના. 16 મ્હણજે 16 તે પુઢીલ 15.', mwr: '1 = પૂરો મહીનો। 16 રો મતલબ 16 સૂં અગલી 15 તાંઈ।' },
  cycleSaved:{ en: 'Pay cycle updated', hi: 'सैलरी साइकिल अपडेट हुई', hinglish: 'Pay cycle update ho gayi', gu: 'પગાર ચક્ર અપડેટ', mr: 'પગાર ચક્ર અપડેટ', mwr: 'સૈલરી સાઇકિલ અપડેટ હુઈ' },
  byMonth:  { en: 'Month', hi: 'महीने से', hinglish: 'Month', gu: 'મહિનો', mr: 'મહિના', mwr: 'મહીનો' },
  byRange:  { en: 'Custom dates', hi: 'कस्टम तारीख', hinglish: 'Custom dates', gu: 'કસ્ટમ તારીખ', mr: 'કસ્ટમ તારીખ', mwr: 'કસ્ટમ તારીખ' },
  from:     { en: 'From', hi: 'से', hinglish: 'From', gu: 'થી', mr: 'પાસૂન', mwr: 'સૂં' },
  to:       { en: 'To', hi: 'तक', hinglish: 'To', gu: 'સુધી', mr: 'પર્યંત', mwr: 'તાંઈ' },
  workDays: { en: 'Working days', hi: 'कार्य दिवस', hinglish: 'Working days', gu: 'કામકાજના દિવસ', mr: 'કામાચે દિવસ', mwr: 'કામ રા દિન' },
  auto:     { en: 'Sundays excluded — change if a holiday falls in the range', hi: 'रविवार छोड़कर — रेंज में छुट्टी हो तो बदलें', hinglish: 'Sunday chhodkar — range me holiday ho to badlein', gu: 'રવિવાર સિવાય — રજા હોય તો બદલો', mr: 'રવિવાર વગળૂન — સુટ્ટી અસલ્યાસ બદલા', mwr: 'ઇતવાર છોડર — છુટ્ટી હુવે તો બદલો' },
  rangeNote:{ en: 'A custom range is a preview only. Slips and advance deductions run on a whole month.', hi: 'कस्टम रेंज सिर्फ प्रीव्यू है। स्लिप और एडवांस कटौती पूरे महीने पर होती है।', hinglish: 'Custom range sirf preview hai. Slips aur advance deduction poore mahine par hote hain.', gu: 'કસ્ટમ રેન્જ ફક્ત પ્રિવ્યૂ છે. સ્લિપ અને એડવાન્સ કપાત આખા મહિના પર થાય છે.', mr: 'કસ્ટમ રેન્જ ફક્ત પ્રિવ્હ્યૂ આહે. સ્લિપ અને અ‍ૅડવ્હાંસ કપાત પૂર્ણ મહિન્યાવર હોતે.', mwr: 'કસ્ટમ રેન્જ બસ પ્રીવ્યૂ હૈ। સ્લિપ અર એડવાંસ કટોતી પૂરા મહીના પર હુવે।' },
  advance:  { en: 'Advance', hi: 'एडवांस', hinglish: 'Advance', gu: 'એડવાન્સ', mr: 'અ‍ૅડવ્હાંસ', mwr: 'એડવાંસ' },
  staff:    { en: 'Staff', hi: 'स्टाफ', hinglish: 'Staff', gu: 'સ્ટાફ', mr: 'કર્મચારી', mwr: 'સ્ટાફ' },
  base:     { en: 'Base', hi: 'बेसिक', hinglish: 'Base', gu: 'બેઝ', mr: 'મૂળ', mwr: 'બેસિક' },
  present:  { en: 'Present', hi: 'उपस्थित', hinglish: 'Present', gu: 'હાજર', mr: 'ઉપસ્થિત', mwr: 'હાજર' },
  deduction:{ en: 'Deduction', hi: 'कटौती', hinglish: 'Deduction', gu: 'કપાત', mr: 'કપાત', mwr: 'કટોતી' },
  net:      { en: 'Net pay', hi: 'नेट पे', hinglish: 'Net pay', gu: 'નેટ પે', mr: 'નિવ્વળ', mwr: 'નેટ પે' },
  none:     { en: 'No staff / salaries set. Add a "salary" field to staff users.', hi: 'कोई स्टाफ/सैलरी सेट नहीं।', hinglish: 'Koi staff/salary set nahi.', gu: 'કોઈ સ્ટાફ/પગાર સેટ નથી.', mr: 'સ્ટાફ/પગાર સેટ નાહી.', mwr: 'કોઈ સ્ટાફ/સૈલરી સેટ કોની।' },
  generated:{ en: 'Slips generated', hi: 'स्लिप जनरेट हो गईं', hinglish: 'Slips generate ho gayin', gu: 'સ્લિપ જનરેટ થઈ', mr: 'સ્લિપ તૈયાર ઝાલ્યા', mwr: 'સ્લિપ જનરેટ હો ગી' },
  failed:   { en: 'Failed', hi: 'नहीं हुआ', hinglish: 'Fail hua', gu: 'નિષ્ફળ', mr: 'અયશસ્વી', mwr: 'કોની હુયો' },
  action:   { en: 'Action', hi: 'कार्रवाई', hinglish: 'Action', gu: 'ક્રિયા', mr: 'કૃતિ', mwr: 'કાર્રવાઈ' },
  viewSlip: { en: 'View Slip', hi: 'स्लिप देखें', hinglish: 'Slip dekhein', gu: 'સ્લિપ જુઓ', mr: 'સ્લિપ પાહા', mwr: 'સ્લિપ દેખો' },
};

export default function HrPayrollPage() {
  const t = useT(S);
  const { tenant } = useAuth();
  const [mode, setMode] = useState('month');   // 'month' | 'range'
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  // Blank means "work it out from the dates" — the server fills it in and
  // sends back what it used, which is what lands in the box.
  const [workDays, setWorkDays] = useState('');
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  // Blank until a compute comes back and tells us the shop's own cycle.
  const [cycleDay, setCycleDay] = useState('');
  const [selectedRow, setSelectedRow] = useState(null);

  const saveCycle = async () => {
    setBusy(true);
    try {
      await hrApi.setPayrollCycle(Number(cycleDay));
      showToast(t('cycleSaved'), 'success');
      await compute();
    } catch (e) {
      showToast(e.response?.data?.error || t('failed'), 'error');
    } finally { setBusy(false); }
  };
  const custom = mode === 'range';

  const compute = async () => {
    setBusy(true);
    try {
      const res = custom
        ? await hrApi.payrollCompute({ from, to, ...(workDays ? { workingDays: Number(workDays) } : {}) })
        : await hrApi.payrollCompute(month);
      setData(res);
      if (custom) setWorkDays(String(res.workingDays));
      if (!custom && res.cycleStartDay) setCycleDay(String(res.cycleStartDay));
    }
    catch (e) { showToast(e.response?.data?.error || t('failed'), 'error'); }
    finally { setBusy(false); }
  };
  useEffect(() => { compute(); }, []); // eslint-disable-line

  // Switching the basis invalidates the table that is on screen, so clear it
  // rather than leave month figures sitting under a range heading.
  const switchMode = (m) => { if (m === mode) return; setMode(m); setData(null); setWorkDays(''); };

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
      {/* Pay and advances sit above the month's run: you set what people earn
          and settle their requests BEFORE generating the payslips that carry
          both. */}
      <SalaryAdmin />

      <div className="flex gap-2 mb-2" style={{ flexWrap: 'wrap' }}>
        {[['month', t('byMonth')], ['range', t('byRange')]].map(([k, label]) => (
          <button key={k} type="button" onClick={() => switchMode(k)}
            className={'btn btn-sm ' + (mode === k ? 'btn-primary' : 'btn-ghost')}>{label}</button>
        ))}
      </div>

      <div className="flex gap-2 mb-2" style={{ alignItems: 'flex-end', flexWrap: 'wrap' }}>
        {custom ? (
          <>
            <div className="form-group" style={{ margin: 0 }}><label>{t('from')}</label>
              <input className="input" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></div>
            <div className="form-group" style={{ margin: 0 }}><label>{t('to')}</label>
              <input className="input" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></div>
            <div className="form-group" style={{ margin: 0 }}><label>{t('workDays')}</label>
              <input className="input" type="number" min="1" max="366" style={{ width: 110 }}
                value={workDays} onChange={(e) => setWorkDays(e.target.value)} /></div>
          </>
        ) : (
          <div className="form-group" style={{ margin: 0 }}><label>{t('month')}</label>
            <input className="input" type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></div>
        )}
        <button className="btn btn-primary btn-sm" onClick={compute} disabled={busy}>{t('compute')}</button>
        {/* Slips are month-keyed, and so is the guard that stops an advance
            instalment being taken twice — so only a month can be generated. */}
        {!custom && (
          <button className="btn btn-success btn-sm" onClick={generate} disabled={busy || !data?.rows?.length}>{t('generate')}</button>
        )}
      </div>

      {custom && (
        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 14 }}>
          {t('auto')}<br />{t('rangeNote')}
        </div>
      )}

      {/* A run labelled 'October' may not be the month of October. Say which
          dates it actually covers, next to the control that decides. */}
      {!custom && data && !data.custom && (
        <div className="flex items-center" style={{ gap: 10, flexWrap: 'wrap', marginBottom: 14, fontSize: 12 }}>
          <span style={{ color: 'var(--text2)' }}>
            <b>{t('cycle')}</b> — {t('covers')} <b data-testid="cycle-range">{data.from} → {data.to}</b>
          </span>
          <span style={{ color: 'var(--text3)' }}>|</span>
          <label style={{ color: 'var(--text2)' }}>{t('startsOn')}</label>
          <input className="input" type="number" min="1" max="28" style={{ width: 70 }}
            data-testid="cycle-start-day" value={cycleDay}
            onChange={(e) => setCycleDay(e.target.value)} />
          <button className="btn btn-ghost btn-xs" data-testid="cycle-save"
            disabled={busy || !cycleDay || Number(cycleDay) === (data.cycleStartDay || 1)}
            onClick={saveCycle}>{t('saveCycle')}</button>
          <span style={{ color: 'var(--text3)' }}>{t('cycleHint')}</span>
        </div>
      )}

      {data && (
        <div className="card" style={{ padding: 0, overflow: 'auto' }}>
          {!data.rows.length ? (
            <div style={{ textAlign: 'center', padding: 30, color: 'var(--text3)' }}>{t('none')}</div>
          ) : (
            <table className="crm-table">
              <thead><tr>
                <th>{t('staff')}</th><th>{t('base')}</th><th>{t('present')}</th>
                <th>{t('deduction')}</th>{!data.custom && <th>{t('advance')}</th>}<th>{t('net')}</th>
                <th style={{ textAlign: 'center' }}>{t('action')}</th>
              </tr></thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr
                    key={r.userId}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setSelectedRow(r)}
                    title={t('viewSlip')}
                  >
                    <td style={{ fontWeight: 600 }}>{r.name}</td>
                    {/* On a range the base IS pro-rated, so show what is actually
                        being paid for rather than the untouched monthly salary. */}
                    <td>{inr(data.custom ? r.gross : r.base)}</td>
                    <td>{r.present}/{data.workingDays}</td>
                    <td style={{ color: 'var(--red)' }}>− {inr(r.deduction)}</td>
                    {!data.custom && <td style={{ color: 'var(--red)' }}>{r.advanceDeduction ? '− ' + inr(r.advanceDeduction) : '—'}</td>}
                    <td style={{ fontWeight: 700 }}>{inr(r.net)}</td>
                    <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="btn btn-xs btn-outline"
                        style={{ fontSize: 11, padding: '3px 8px', borderColor: 'var(--primary)', color: 'var(--primary)', whiteSpace: 'nowrap' }}
                        data-testid={`view-slip-${r.userId}`}
                        onClick={() => setSelectedRow(r)}
                      >
                        📄 {t('viewSlip')}
                      </button>
                    </td>
                  </tr>
                ))}
                <tr style={{ fontWeight: 700, borderTop: '2px solid var(--border)' }}>
                  <td colSpan={data.custom ? 4 : 5}>Total</td><td>{inr(total)}</td><td></td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Individual Staff Salary Slip Modal */}
      {selectedRow && (
        <StaffSalarySlipModal
          open={!!selectedRow}
          onClose={() => setSelectedRow(null)}
          record={selectedRow}
          period={{
            month: data?.month || month,
            from: data?.from || from,
            to: data?.to || to,
            isCustom: custom,
          }}
          company={tenant?.name || 'Mr Print World'}
        />
      )}
    </div>
  );
}
