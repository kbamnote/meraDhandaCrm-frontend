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

// The range defaults to this month so far, which is the most common thing
// an admin wants to look at mid-cycle.
const firstOfMonth = () => new Date().toISOString().slice(0, 8) + '01';
const inr = (n) => '₹' + (Math.round((Number(n) || 0) * 100) / 100).toLocaleString('en-IN');

const S = {
  title:    { en: '💵 Payroll', hi: '💵 पेरोल', hinglish: '💵 Payroll', gu: '💵 પેરોલ', mr: '💵 पेरोल', mwr: '💵 पेरोल' },
  month:    { en: 'Month', hi: 'महीना', hinglish: 'Month', gu: 'મહિનો', mr: 'महिना', mwr: 'महीनो' },
  compute:  { en: 'Compute', hi: 'गणना करें', hinglish: 'Compute', gu: 'ગણતરી', mr: 'गणना', mwr: 'गणना' },
  generate: { en: 'Generate slips', hi: 'स्लिप जनरेट करें', hinglish: 'Slips generate karein', gu: 'સ્લિપ જનરેટ કરો', mr: 'स्लिप तयार करा', mwr: 'स्लिप जनरेट करो' },
  saveCycle: { en: 'Save', hi: 'सेव', hinglish: 'Save', gu: 'સેવ', mr: 'सेव्ह', mwr: 'सेव' },
  cycle:     { en: 'Pay cycle', hi: 'सैलरी साइकिल', hinglish: 'Pay cycle', gu: 'પગાર ચક્ર', mr: 'पगार चक्र', mwr: 'सैलरी साइकिल' },
  covers:    { en: 'covers', hi: 'अवधि', hinglish: 'covers', gu: 'સમયગાળો', mr: 'कालावधी', mwr: 'अवधि' },
  startsOn:  { en: 'Starts on day', hi: 'शुरू दिन', hinglish: 'Starts on day', gu: 'શરૂ દિવસ', mr: 'सुरू दिवस', mwr: 'सरू दिन' },
  cycleHint: { en: '1 = calendar month. 16 means the 16th of one month to the 15th of the next.', hi: '1 = पूरा महीना। 16 का मतलब 16 तारीख से अगली 15 तारीख तक।', hinglish: '1 = poora mahina. 16 matlab 16 se agli 15 tak.', gu: '1 = આખો મહિનો. 16 એટલે 16થી આગલી 15 સુધી.', mr: '1 = पूर्ण महिना. 16 म्हणजे 16 ते पुढील 15.', mwr: '1 = पूरो महीनो। 16 रो मतलब 16 सूं अगली 15 ताईं।' },
  cycleSaved:{ en: 'Pay cycle updated', hi: 'सैलरी साइकिल अपडेट हुई', hinglish: 'Pay cycle update ho gayi', gu: 'પગાર ચક્ર અપડેટ', mr: 'पगार चक्र अपडेट', mwr: 'सैलरी साइकिल अपडेट हुई' },
  byMonth:  { en: 'Month', hi: 'महीने से', hinglish: 'Month', gu: 'મહિનો', mr: 'महिना', mwr: 'महीनो' },
  byRange:  { en: 'Custom dates', hi: 'कस्टम तारीख', hinglish: 'Custom dates', gu: 'કસ્ટમ તારીખ', mr: 'कस्टम तारीख', mwr: 'कस्टम तारीख' },
  from:     { en: 'From', hi: 'से', hinglish: 'From', gu: 'થી', mr: 'पासून', mwr: 'सूं' },
  to:       { en: 'To', hi: 'तक', hinglish: 'To', gu: 'સુધી', mr: 'पर्यंत', mwr: 'तांई' },
  workDays: { en: 'Working days', hi: 'कार्य दिवस', hinglish: 'Working days', gu: 'કામકાજના દિવસ', mr: 'कामाचे दिवस', mwr: 'काम रा दिन' },
  auto:     { en: 'Sundays excluded — change if a holiday falls in the range', hi: 'रविवार छोड़कर — रेंज में छुट्टी हो तो बदलें', hinglish: 'Sunday chhodkar — range me holiday ho to badlein', gu: 'રવિવાર સિવાય — રજા હોય તો બદલો', mr: 'रविवार वगळून — सुट्टी असल्यास बदला', mwr: 'इतवार छोड़र — छुट्टी हुवे तो बदलो' },
  rangeNote:{ en: 'A custom range is a preview only. Slips and advance deductions run on a whole month.', hi: 'कस्टम रेंज सिर्फ प्रीव्यू है। स्लिप और एडवांस कटौती पूरे महीने पर होती है।', hinglish: 'Custom range sirf preview hai. Slips aur advance deduction poore mahine par hote hain.', gu: 'કસ્ટમ રેન્જ ફક્ત પ્રિવ્યૂ છે. સ્લિપ અને એડવાન્સ કપાત આખા મહિના પર થાય છે.', mr: 'कस्टम रेंज फक्त प्रिव्ह्यू आहे. स्लिप आणि अ‍ॅडव्हान्स कपात पूर्ण महिन्यावर होते.', mwr: 'कस्टम रेंज बस प्रीव्यू है। स्लिप अर एडवांस कटौती पूरा महीना पर हुवे।' },
  advance:  { en: 'Advance', hi: 'एडवांस', hinglish: 'Advance', gu: 'એડવાન્સ', mr: 'अ‍ॅडव्हान्स', mwr: 'एडवांस' },
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
              </tr></thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.userId}>
                    <td>{r.name}</td>
                    {/* On a range the base IS pro-rated, so show what is actually
                        being paid for rather than the untouched monthly salary. */}
                    <td>{inr(data.custom ? r.gross : r.base)}</td>
                    <td>{r.present}/{data.workingDays}</td>
                    <td style={{ color: 'var(--red)' }}>− {inr(r.deduction)}</td>
                    {!data.custom && <td style={{ color: 'var(--red)' }}>{r.advanceDeduction ? '− ' + inr(r.advanceDeduction) : '—'}</td>}
                    <td style={{ fontWeight: 700 }}>{inr(r.net)}</td>
                  </tr>
                ))}
                <tr style={{ fontWeight: 700, borderTop: '2px solid var(--border)' }}>
                  <td colSpan={data.custom ? 4 : 5}>Total</td><td>{inr(total)}</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
