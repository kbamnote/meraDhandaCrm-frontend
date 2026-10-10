/**
 * Give a teammate a raise, from the screen where their other details live.
 *
 * Two ways to say it, because both are how raises are actually described:
 * "two thousand more" and "everyone gets 10%". Whichever you pick, the new
 * salary is shown before you commit — the number that matters is the one
 * they will be paid, not the one you typed.
 *
 * The effective month is what keeps payroll honest: a raise agreed today but
 * starting next month must not reprice this month's slips. It defaults to the
 * current month, so the ordinary case needs no thought.
 *
 * Past revisions are listed underneath, because "how much was he hiked last
 * time" is the question that gets asked right before this one is answered.
 */
import { useEffect, useState } from 'react';
import { hrApi } from '../../services/api';
import { useT } from '../../i18n/LanguageContext';
import { showToast } from './toast';

const inr = (n) => '₹' + (Math.round((Number(n) || 0) * 100) / 100).toLocaleString('en-IN');
const thisMonth = () => new Date().toISOString().slice(0, 7);

const S = {
  title:     { en: 'Salary hike', hi: 'सैलरी बढ़ोतरी', hinglish: 'Salary hike', gu: 'પગાર વધારો', mr: 'पगारवाढ', mwr: 'सैलरी बढ़ोतरी' },
  current:   { en: 'Current salary', hi: 'मौजूदा सैलरी', hinglish: 'Current salary', gu: 'હાલનો પગાર', mr: 'सध्याचा पगार', mwr: 'अबै री सैलरी' },
  byAmount:  { en: 'By amount', hi: 'राशि से', hinglish: 'By amount', gu: 'રકમથી', mr: 'रकमेने', mwr: 'रकम सूं' },
  byPercent: { en: 'By percent', hi: 'प्रतिशत से', hinglish: 'By percent', gu: 'ટકાથી', mr: 'टक्क्याने', mwr: 'परसेंट सूं' },
  amount:    { en: 'Hike amount', hi: 'बढ़ोतरी राशि', hinglish: 'Hike amount', gu: 'વધારાની રકમ', mr: 'वाढीची रक्कम', mwr: 'बढ़ोतरी री रकम' },
  percent:   { en: 'Hike %', hi: 'बढ़ोतरी %', hinglish: 'Hike %', gu: 'વધારો %', mr: 'वाढ %', mwr: 'बढ़ोतरी %' },
  effective: { en: 'Effective from', hi: 'इस महीने से लागू', hinglish: 'Effective from', gu: 'થી અમલમાં', mr: 'पासून लागू', mwr: 'सूं लागू' },
  note:      { en: 'Reason (optional)', hi: 'कारण (वैकल्पिक)', hinglish: 'Reason (optional)', gu: 'કારણ (વૈકલ્પિક)', mr: 'कारण (ऐच्छिक)', mwr: 'कारण (मरजी सूं)' },
  newSalary: { en: 'New salary', hi: 'नई सैलरी', hinglish: 'New salary', gu: 'નવો પગાર', mr: 'नवा पगार', mwr: 'नई सैलरी' },
  perDay:    { en: 'per day', hi: 'प्रति दिन', hinglish: 'per day', gu: 'પ્રતિ દિવસ', mr: 'प्रतिदिन', mwr: 'हर दिन' },
  apply:     { en: 'Apply hike', hi: 'बढ़ोतरी लागू करें', hinglish: 'Apply hike', gu: 'વધારો લાગુ કરો', mr: 'वाढ लागू करा', mwr: 'बढ़ोतरी लागू करो' },
  saving:    { en: 'Saving…', hi: 'सेव हो रहा है…', hinglish: 'Saving…', gu: 'સેવ થઈ રહ્યું…', mr: 'सेव्ह होत आहे…', mwr: 'सेव हो रयो है…' },
  cancel:    { en: 'Cancel', hi: 'रद्द', hinglish: 'Cancel', gu: 'રદ', mr: 'रद्द', mwr: 'रद्द' },
  history:   { en: 'Past revisions', hi: 'पिछली बढ़ोतरी', hinglish: 'Past revisions', gu: 'અગાઉના ફેરફાર', mr: 'मागील बदल', mwr: 'पैली री बढ़ोतरी' },
  noHistory: { en: 'No changes recorded yet.', hi: 'अभी कोई बदलाव दर्ज नहीं।', hinglish: 'Abhi koi change record nahi.', gu: 'હજી કોઈ ફેરફાર નોંધાયો નથી.', mr: 'अजून बदल नोंदवलेला नाही.', mwr: 'अबै तांई कोई बदलाव कोनी।' },
  noSalary:  { en: 'Set a salary first in HR → Payroll.', hi: 'पहले HR → पेरोल में सैलरी सेट करें।', hinglish: 'Pehle HR → Payroll me salary set karein.', gu: 'પહેલા HR → પેરોલમાં પગાર સેટ કરો.', mr: 'आधी HR → पेरोलमध्ये पगार सेट करा.', mwr: 'पैला HR → पेरोल में सैलरी सेट करो।' },
  done:      { en: 'Salary updated', hi: 'सैलरी अपडेट हुई', hinglish: 'Salary update ho gayi', gu: 'પગાર અપડેટ થયો', mr: 'पगार अपडेट झाला', mwr: 'सैलरी अपडेट हुई' },
  failed:    { en: 'Could not apply the hike', hi: 'बढ़ोतरी लागू नहीं हुई', hinglish: 'Hike apply nahi hui', gu: 'વધારો લાગુ ન થયો', mr: 'वाढ लागू झाली नाही', mwr: 'बढ़ोतरी लागू कोनी हुई' },
  payrollNote: { en: 'Payroll for that month onwards uses the new figure. Earlier months keep what they were.', hi: 'उस महीने से पेरोल नई राशि लेगा। पुराने महीने वैसे ही रहेंगे।', hinglish: 'Us mahine se payroll nayi rashi lega. Purane mahine waise hi rahenge.', gu: 'તે મહિનાથી પેરોલ નવી રકમ લેશે. અગાઉના મહિના એમ જ રહેશે.', mr: 'त्या महिन्यापासून पेरोल नवी रक्कम घेईल. आधीचे महिने तसेच राहतील.', mwr: 'उण महीना सूं पेरोल नई रकम लेसी। पुराना महीना वैड़ा ई रैसी।' },
};

const WORKING_DAYS = 26;

export default function SalaryHikeModal({ user, onClose, onSaved }) {
  const t = useT(S);
  const [mode, setMode] = useState('amount');     // 'amount' | 'percent'
  const [amount, setAmount] = useState('');
  const [percent, setPercent] = useState('');
  const [effectiveMonth, setEffectiveMonth] = useState(thisMonth());
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState([]);
  const [current, setCurrent] = useState(Number(user.salary || 0));

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [rows, salaries] = await Promise.all([
          hrApi.salaryRevisions(user.id),
          // The row on the Permissions page may not carry a salary — that list
          // is about roles. Ask the payroll list for the figure that counts.
          hrApi.salaries(),
        ]);
        if (!alive) return;
        setHistory(Array.isArray(rows) ? rows : []);
        const mine = (salaries || []).find((r) => String(r.userId) === String(user.id));
        if (mine) setCurrent(Number(mine.salary || 0));
      } catch (e) { /* the form still works; history is a nicety */ }
    })();
    return () => { alive = false; };
  }, [user.id]);

  // Previewed on the client so you can see the result before committing; the
  // server does the same arithmetic again and its answer is the one stored.
  const hike = mode === 'percent'
    ? Math.round(((current * Number(percent || 0)) / 100) * 100) / 100
    : Math.round(Number(amount || 0) * 100) / 100;
  const next = Math.round((current + hike) * 100) / 100;
  const valid = current > 0 && hike !== 0 && next >= 0 && /^\d{4}-\d{2}$/.test(effectiveMonth);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const body = { effectiveMonth, note: note.trim() || undefined };
      if (mode === 'percent') body.percent = Number(percent);
      else body.amount = Number(amount);
      const saved = await hrApi.hikeSalary(user.id, body);
      showToast(`${t('done')} — ${inr(saved.to)}`, 'success');
      if (onSaved) onSaved(saved);
      onClose();
    } catch (err) {
      showToast(err.response?.data?.error || t('failed'), 'error');
    } finally { setBusy(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 210, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <form className="card" onSubmit={submit} style={{ maxWidth: 460, width: '100%', maxHeight: '90vh', overflow: 'auto' }}>
        <h3 style={{ marginBottom: 4 }}>📈 {t('title')}</h3>
        <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 14 }}>
          {user.name || user.email}
          {user.employeeId ? ` · ${user.employeeId}` : ''}
        </div>

        <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
          <span style={{ fontSize: 13, color: 'var(--text2)' }}>{t('current')}</span>
          <b>{inr(current)}</b>
        </div>

        {current <= 0 ? (
          <div style={{ fontSize: 13, color: 'var(--amber)', marginBottom: 12 }}>{t('noSalary')}</div>
        ) : null}

        <div className="flex gap-2 mb-2">
          {[['amount', t('byAmount')], ['percent', t('byPercent')]].map(([k, label]) => (
            <button key={k} type="button" onClick={() => setMode(k)}
              className={'btn btn-sm ' + (mode === k ? 'btn-primary' : 'btn-ghost')}>{label}</button>
          ))}
        </div>

        <div className="flex gap-2">
          <div className="form-group" style={{ flex: 1 }}>
            <label>{mode === 'percent' ? t('percent') : t('amount')}</label>
            {mode === 'percent' ? (
              <input className="input" type="number" step="0.01" value={percent} autoFocus
                onChange={(e) => setPercent(e.target.value)} placeholder="10" />
            ) : (
              <input className="input" type="number" step="0.01" value={amount} autoFocus
                onChange={(e) => setAmount(e.target.value)} placeholder="2000" />
            )}
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label>{t('effective')}</label>
            <input className="input" type="month" value={effectiveMonth}
              onChange={(e) => setEffectiveMonth(e.target.value)} />
          </div>
        </div>

        <div className="form-group">
          <label>{t('note')}</label>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
        </div>

        {/* The number that actually matters, shown before you commit to it. */}
        {valid ? (
          <div className="card" style={{ background: 'var(--bg2)', padding: 10, marginBottom: 10 }}>
            <div className="flex items-center justify-between">
              <span style={{ fontSize: 13, color: 'var(--text2)' }}>{t('newSalary')}</span>
              <b style={{ fontSize: 16 }}>{inr(next)}</b>
            </div>
            <div style={{ fontSize: 12, color: hike >= 0 ? 'var(--green)' : 'var(--red)' }}>
              {hike >= 0 ? '+' : '−'}{inr(Math.abs(hike))}
              {current ? ` (${hike >= 0 ? '+' : '−'}${Math.abs(Math.round((hike / current) * 1000) / 10)}%)` : ''}
              {' · '}{inr(next / WORKING_DAYS)} {t('perDay')}
            </div>
          </div>
        ) : null}

        <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 10 }}>{t('payrollNote')}</div>

        <div className="flex gap-2">
          <button type="submit" className="btn btn-primary flex-1" disabled={busy || !valid}>
            {busy ? t('saving') : t('apply')}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>{t('cancel')}</button>
        </div>

        <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>{t('history')}</div>
          {!history.length ? (
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>{t('noHistory')}</div>
          ) : history.map((r) => (
            <div key={r.id} style={{ fontSize: 12, padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ color: r.hike >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                {r.hike >= 0 ? '+' : '−'}{inr(Math.abs(r.hike))}
              </span>
              {r.percent != null ? <span style={{ color: 'var(--text3)' }}> ({r.percent}%)</span> : null}
              <span style={{ color: 'var(--text2)' }}> · {inr(r.from)} → {inr(r.to)}</span>
              <div style={{ color: 'var(--text3)' }}>
                {r.effectiveMonth}{r.byName ? ` · ${r.byName}` : ''}{r.note ? ` · ${r.note}` : ''}
              </div>
            </div>
          ))}
        </div>
      </form>
    </div>
  );
}
