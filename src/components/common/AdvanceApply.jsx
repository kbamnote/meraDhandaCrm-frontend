/**
 * Apply for a salary advance, and watch what happened to the ones you asked for.
 *
 * The cap is the SERVER's answer (`/me/advance-limit`) — half a month's salary
 * normally, a fifth once an advance is already running, and what is still owed
 * comes off either figure. It is shown rather than silently enforced, because a
 * refusal after typing a number is worse than a sentence beforehand saying what
 * the number can be.
 *
 * Repayment has to be chosen up front: out of the next salary, in instalments,
 * or an arrangement written in words for the admin to honour. "Other" demands
 * the words — an advance with no agreed repayment is how one goes unpaid.
 */
import { useCallback, useEffect, useState } from 'react';
import { meApi } from '../../services/api';
import { showToast } from './toast';
import { useT } from '../../i18n/LanguageContext';

const S = {
  title:     { en: 'Salary advance', hi: 'सैलरी एडवांस', hinglish: 'Salary advance', gu: 'પગાર એડવાન્સ', mr: 'पगार अ‍ॅडव्हान्स', mwr: 'सैलरी एडवांस' },
  apply:     { en: 'Apply for advance', hi: 'एडवांस के लिए आवेदन', hinglish: 'Advance ke liye apply', gu: 'એડવાન્સ માટે અરજી', mr: 'अ‍ॅडव्हान्ससाठी अर्ज', mwr: 'एडवांस खातर अरजी' },
  amount:    { en: 'How much do you need?', hi: 'कितना चाहिए?', hinglish: 'Kitna chahiye?', gu: 'કેટલું જોઈએ?', mr: 'किती हवे?', mwr: 'कितरो चाइजै?' },
  canTake:   { en: 'You can take up to', hi: 'आप ले सकते हैं अधिकतम', hinglish: 'Aap le sakte hain max', gu: 'તમે વધુમાં વધુ લઈ શકો', mr: 'तुम्ही जास्तीत जास्त घेऊ शकता', mwr: 'थे ज्यादा सूं ज्यादा लै सको' },
  repay:     { en: 'How will it be repaid?', hi: 'वापसी कैसे होगी?', hinglish: 'Wapsi kaise hogi?', gu: 'પરત કેવી રીતે?', mr: 'परतफेड कशी?', mwr: 'वापसी कियां होसी?' },
  nextSal:   { en: 'From next salary', hi: 'अगली सैलरी से', hinglish: 'Agli salary se', gu: 'આગલા પગારમાંથી', mr: 'पुढच्या पगारातून', mwr: 'अगली सैलरी सूं' },
  emi:       { en: 'In instalments (EMI)', hi: 'किस्तों में (EMI)', hinglish: 'Kiston mein (EMI)', gu: 'હપ્તામાં (EMI)', mr: 'हप्त्यांमध्ये (EMI)', mwr: 'किस्तां में (EMI)' },
  other:     { en: 'Other arrangement', hi: 'कोई और तरीका', hinglish: 'Koi aur tareeka', gu: 'બીજી ગોઠવણ', mr: 'दुसरी व्यवस्था', mwr: 'कोई दूजो तरीको' },
  months:    { en: 'Number of instalments', hi: 'कितनी किस्तें', hinglish: 'Kitni kisten', gu: 'કેટલા હપ્તા', mr: 'किती हप्ते', mwr: 'कितरी किस्तां' },
  each:      { en: 'each month', hi: 'हर महीने', hinglish: 'har month', gu: 'દર મહિને', mr: 'दरमहा', mwr: 'हर महीने' },
  terms:     { en: 'How you will repay it', hi: 'आप वापसी कैसे करेंगे', hinglish: 'Aap wapsi kaise karenge', gu: 'તમે કેવી રીતે ચૂકવશો', mr: 'तुम्ही कसे परत कराल', mwr: 'थे कियां वापस करोला' },
  reason:    { en: 'Reason (optional)', hi: 'कारण (वैकल्पिक)', hinglish: 'Reason (optional)', gu: 'કારણ (વૈકલ્પિક)', mr: 'कारण (ऐच्छिक)', mwr: 'कारण (मरजी सूं)' },
  submit:    { en: 'Send request', hi: 'अनुरोध भेजें', hinglish: 'Request bhejein', gu: 'વિનંતી મોકલો', mr: 'विनंती पाठवा', mwr: 'अरजी भेजो' },
  cancel:    { en: 'Cancel', hi: 'रद्द', hinglish: 'Cancel', gu: 'રદ', mr: 'रद्द', mwr: 'रद्द' },
  sent:      { en: 'Request sent to your admin', hi: 'अनुरोध एडमिन को भेजा गया', hinglish: 'Request admin ko bhej diya', gu: 'વિનંતી એડમિનને મોકલી', mr: 'विनंती अ‍ॅडमिनला पाठवली', mwr: 'अरजी एडमिन ने भेज दी' },
  withdraw:  { en: 'Withdraw', hi: 'वापस लें', hinglish: 'Withdraw', gu: 'પાછું લો', mr: 'मागे घ्या', mwr: 'वापस लो' },
  withdrawn: { en: 'Request withdrawn', hi: 'अनुरोध वापस लिया', hinglish: 'Request wapas li', gu: 'વિનંતી પાછી લીધી', mr: 'विनंती मागे घेतली', mwr: 'अरजी वापस ली' },
  mine:      { en: 'My requests', hi: 'मेरे अनुरोध', hinglish: 'Mere requests', gu: 'મારી વિનંતીઓ', mr: 'माझ्या विनंत्या', mwr: 'म्हारी अरजियां' },
  none:      { en: 'You have not asked for an advance yet.', hi: 'आपने अभी तक एडवांस नहीं मांगा।', hinglish: 'Aapne abhi tak advance nahi manga.', gu: 'તમે હજી એડવાન્સ માગ્યું નથી.', mr: 'तुम्ही अद्याप अ‍ॅडव्हान्स मागितले नाही.', mwr: 'थे अजे एडवांस कोनी मांग्यो।' },
  owing:     { en: 'still to repay', hi: 'अभी चुकाना बाकी', hinglish: 'abhi chukana baki', gu: 'હજી ચૂકવવાનું', mr: 'अजून परत करायचे', mwr: 'अजे चुकावणो बाकी' },
  noSalary:  { en: 'Your salary has not been set yet — ask your admin.', hi: 'आपकी सैलरी अभी सेट नहीं है — एडमिन से कहें।', hinglish: 'Aapki salary abhi set nahi hai — admin se kahein.', gu: 'તમારો પગાર હજી સેટ નથી — એડમિનને કહો.', mr: 'तुमचा पगार अद्याप सेट नाही — अ‍ॅडमिनला सांगा.', mwr: 'थारी सैलरी अजे सेट कोनी — एडमिन ने कैवो।' },
  failed:    { en: 'Something went wrong', hi: 'कुछ गलत हो गया', hinglish: 'Kuch galat ho gaya', gu: 'કંઈક ખોટું થયું', mr: 'काहीतरी चुकले', mwr: 'कीं गलत हो ग्यो' },
};

const inr = (v) => '₹' + Number(v || 0).toLocaleString('en-IN');
const STATUS = {
  pending:   { label: 'Awaiting approval', color: '#D97706' },
  approved:  { label: 'Approved',          color: '#10B981' },
  rejected:  { label: 'Not approved',      color: '#EF4444' },
  closed:    { label: 'Fully repaid',      color: '#6B7280' },
  cancelled: { label: 'Withdrawn',         color: '#9CA3AF' },
};
const MODE_LABEL = { next_salary: 'From next salary', emi: 'Instalments', other: 'Other arrangement' };

export default function AdvanceApply() {
  const t = useT(S);
  const [limit, setLimit] = useState(null);
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ amount: '', repayMode: 'next_salary', emiMonths: 3, reason: '', otherTerms: '' });

  const load = useCallback(async () => {
    try {
      const [l, list] = await Promise.all([meApi.advanceLimit(), meApi.advances()]);
      setLimit(l);
      setRows(Array.isArray(list) ? list : []);
    } catch (e) { /* the page still shows the slips */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    setBusy(true);
    try {
      await meApi.applyAdvance({
        amount: Number(form.amount),
        repayMode: form.repayMode,
        emiMonths: form.repayMode === 'emi' ? Number(form.emiMonths) : undefined,
        reason: form.reason,
        otherTerms: form.otherTerms,
      });
      showToast(t('sent'), 'success');
      setOpen(false);
      setForm({ amount: '', repayMode: 'next_salary', emiMonths: 3, reason: '', otherTerms: '' });
      load();
    } catch (e) {
      // The server's refusal already explains the cap in words — showing our
      // own version here would eventually disagree with it.
      showToast(e?.response?.data?.error || t('failed'), 'error');
    } finally { setBusy(false); }
  };

  const withdraw = async (a) => {
    try {
      await meApi.cancelAdvance(a.id);
      showToast(t('withdrawn'), 'success');
      load();
    } catch (e) { showToast(e?.response?.data?.error || t('failed'), 'error'); }
  };

  const canApply = !!(limit && limit.salary > 0 && limit.cap > 0);
  const perEmi = form.repayMode === 'emi' && Number(form.amount) > 0 && Number(form.emiMonths) > 1
    ? Math.round((Number(form.amount) / Number(form.emiMonths)) * 100) / 100
    : 0;

  return (
    <div className="card" style={{ marginBottom: 14 }} data-testid="advance-card">
      <div className="flex items-center justify-between" style={{ gap: 10, flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, fontSize: 15 }}>💰 {t('title')}</h3>
        {!open && canApply && (
          <button className="btn btn-sm btn-primary" data-testid="advance-apply" onClick={() => setOpen(true)}>
            {t('apply')}
          </button>
        )}
      </div>

      {limit && !limit.salary ? (
        <p style={{ fontSize: 12.5, color: 'var(--text3)', marginTop: 6 }} data-testid="advance-nosalary">
          {t('noSalary')}
        </p>
      ) : limit ? (
        <p style={{ fontSize: 12.5, color: 'var(--text2)', marginTop: 6 }} data-testid="advance-limit">
          {t('canTake')} <b>{inr(limit.cap)}</b> ({limit.pct}% of {inr(limit.salary)}
          {limit.outstanding ? `, ${inr(limit.outstanding)} ${t('owing')}` : ''})
        </p>
      ) : null}

      {open && (
        <div style={{ marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
          <div className="form-group">
            <label>{t('amount')}</label>
            <input className="input" type="number" min="1" max={limit?.cap || undefined}
              data-testid="advance-amount" value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
          </div>

          <div className="form-group">
            <label>{t('repay')}</label>
            <select className="input" data-testid="advance-mode" value={form.repayMode}
              onChange={(e) => setForm((f) => ({ ...f, repayMode: e.target.value }))}>
              <option value="next_salary">{t('nextSal')}</option>
              <option value="emi">{t('emi')}</option>
              <option value="other">{t('other')}</option>
            </select>
          </div>

          {form.repayMode === 'emi' && (
            <div className="form-group">
              <label>{t('months')}</label>
              <input className="input" type="number" min="2" max={limit?.maxEmiMonths || 12}
                data-testid="advance-months" value={form.emiMonths}
                onChange={(e) => setForm((f) => ({ ...f, emiMonths: e.target.value }))} />
              {perEmi > 0 && (
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }} data-testid="advance-emi">
                  {inr(perEmi)} {t('each')}
                </div>
              )}
            </div>
          )}

          {form.repayMode === 'other' && (
            <div className="form-group">
              <label>{t('terms')}</label>
              <input className="input" data-testid="advance-terms" value={form.otherTerms}
                onChange={(e) => setForm((f) => ({ ...f, otherTerms: e.target.value }))} />
            </div>
          )}

          <div className="form-group">
            <label>{t('reason')}</label>
            <input className="input" data-testid="advance-reason" value={form.reason}
              onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} />
          </div>

          <div className="flex" style={{ gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-sm btn-ghost" onClick={() => setOpen(false)} disabled={busy}>{t('cancel')}</button>
            <button className="btn btn-sm btn-primary" onClick={submit} disabled={busy} data-testid="advance-submit">
              {t('submit')}
            </button>
          </div>
        </div>
      )}

      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 11.5, color: 'var(--text3)', fontWeight: 700, marginBottom: 4 }}>{t('mine')}</div>
        {!rows.length ? (
          <p style={{ fontSize: 12.5, color: 'var(--text3)' }}>{t('none')}</p>
        ) : rows.map((a) => {
          const st = STATUS[a.status] || STATUS.pending;
          return (
            <div key={a.id} data-testid="advance-row"
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
              <b style={{ fontSize: 13 }}>{inr(a.amount)}</b>
              <span style={{ fontSize: 11.5, color: 'var(--text3)' }}>
                {MODE_LABEL[a.repayMode] || a.repayMode}
                {a.emiMonths ? ` · ${a.emiMonths} × ${inr(a.emiAmount)}` : ''}
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, color: st.color }}>{st.label}</span>
              {a.status === 'approved' && a.outstanding > 0 && (
                <span style={{ fontSize: 11.5, color: 'var(--text2)' }}>{inr(a.outstanding)} {t('owing')}</span>
              )}
              {a.status === 'pending' && (
                <button className="btn btn-xs btn-ghost" onClick={() => withdraw(a)} data-testid="advance-withdraw">
                  {t('withdraw')}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
