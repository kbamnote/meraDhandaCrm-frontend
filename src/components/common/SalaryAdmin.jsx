/**
 * The admin half of pay: what each person earns, and the advances they have
 * asked for against it.
 *
 * Salaries live on one screen rather than inside each teammate's profile —
 * hunting them one by one is how two people end up on the wrong figure, and the
 * per-day rate (salary ÷ 26) is shown beside each one because that is what a
 * day's absence actually costs.
 *
 * An application is approved or refused here. Approving fixes the instalment at
 * that moment, so a later pay rise cannot quietly change what somebody is
 * repaying.
 */
import { useCallback, useEffect, useState } from 'react';
import { hrApi } from '../../services/api';
import { showToast } from './toast';
import { useT } from '../../i18n/LanguageContext';

const S = {
  salaries:  { en: 'Staff salaries', hi: 'स्टाफ सैलरी', hinglish: 'Staff salaries', gu: 'સ્ટાફ પગાર', mr: 'स्टाफ पगार', mwr: 'स्टाफ सैलरी' },
  perDay:    { en: 'per day', hi: 'प्रति दिन', hinglish: 'per day', gu: 'પ્રતિ દિવસ', mr: 'प्रतिदिन', mwr: 'हर दिन' },
  save:      { en: 'Save', hi: 'सेव', hinglish: 'Save', gu: 'સેવ', mr: 'सेव्ह', mwr: 'सेव' },
  saved:     { en: 'Salary updated', hi: 'सैलरी अपडेट हुई', hinglish: 'Salary update ho gayi', gu: 'પગાર અપડેટ થયો', mr: 'पगार अपडेट झाला', mwr: 'सैलरी अपडेट हुई' },
  lastHike:  { en: 'last hike', hi: 'पिछली बढ़ोतरी', hinglish: 'last hike', gu: 'છેલ્લો વધારો', mr: 'मागील वाढ', mwr: 'पैली बढ़ोतरी' },
  owes:      { en: 'advance owing', hi: 'एडवांस बाकी', hinglish: 'advance baki', gu: 'એડવાન્સ બાકી', mr: 'अ‍ॅडव्हान्स बाकी', mwr: 'एडवांस बाकी' },
  record:    { en: 'Record an advance already given', hi: 'पहले दिया गया एडवांस दर्ज करें', hinglish: 'Pehle diya gaya advance record karein', gu: 'અગાઉ આપેલ એડવાન્સ નોંધો', mr: 'आधी दिलेला अ‍ॅडव्हान्स नोंदवा', mwr: 'पैली दियो एडवांस दरज करो' },
  recordHint:{ en: 'For cash handed over outside the app. It is recorded as already approved and comes out of their pay.', hi: 'ऐप के बाहर दिए गए कैश के लिए। यह सीधे मंज़ूर दर्ज होगा और सैलरी से कटेगा।', hinglish: 'App ke bahar diye gaye cash ke liye. Seedha approved record hoga aur salary se katega.', gu: 'એપ બહાર આપેલ રોકડ માટે. સીધું મંજૂર નોંધાશે અને પગારમાંથી કપાશે.', mr: 'अ‍ॅपबाहेर दिलेल्या रोखीसाठी. थेट मंजूर नोंदवले जाईल आणि पगारातून कापले जाईल.', mwr: 'ऐप रै बारै दियै कैश खातर। सीधो मंजूर दरज हुसी अर सैलरी सूं कटसी।' },
  staff:     { en: 'Staff member', hi: 'स्टाफ', hinglish: 'Staff member', gu: 'સ્ટાફ', mr: 'कर्मचारी', mwr: 'स्टाफ' },
  amount:    { en: 'Amount given', hi: 'दी गई राशि', hinglish: 'Amount given', gu: 'આપેલ રકમ', mr: 'दिलेली रक्कम', mwr: 'दी गी रकम' },
  repayHow:  { en: 'How will it be repaid?', hi: 'वापसी कैसे होगी?', hinglish: 'Wapsi kaise hogi?', gu: 'પરત કેવી રીતે?', mr: 'परतफेड कशी?', mwr: 'वापसी किया होसी?' },
  nextSal:   { en: 'Next salary', hi: 'अगली सैलरी', hinglish: 'Next salary', gu: 'આગલો પગાર', mr: 'पुढचा पगार', mwr: 'अगली सैलरी' },
  emi:       { en: 'Instalments', hi: 'किस्तों में', hinglish: 'Instalments', gu: 'હપ્તા', mr: 'हप्ते', mwr: 'किस्तां' },
  other:     { en: 'Other arrangement', hi: 'अन्य व्यवस्था', hinglish: 'Other arrangement', gu: 'અન્ય વ્યવસ્થા', mr: 'इतर व्यवस्था', mwr: 'दूजी व्यवस्था' },
  months:    { en: 'Instalments', hi: 'कितनी किस्तें', hinglish: 'Kitni instalments', gu: 'કેટલા હપ્તા', mr: 'किती हप्ते', mwr: 'कितनी किस्तां' },
  terms:     { en: 'Describe the arrangement', hi: 'व्यवस्था लिखें', hinglish: 'Arrangement likhein', gu: 'વ્યવસ્થા લખો', mr: 'व्यवस्था लिहा', mwr: 'व्यवस्था लिखो' },
  why:       { en: 'Reason (optional)', hi: 'कारण (वैकल्पिक)', hinglish: 'Reason (optional)', gu: 'કારણ (વૈકલ્પિક)', mr: 'कारण (ऐच्छिक)', mwr: 'कारण (मरजी सूं)' },
  saveRec:   { en: 'Record advance', hi: 'एडवांस दर्ज करें', hinglish: 'Advance record karein', gu: 'એડવાન્સ નોંધો', mr: 'अ‍ॅडव्हान्स नोंदवा', mwr: 'एडवांस दरज करो' },
  recorded:  { en: 'Advance recorded', hi: 'एडवांस दर्ज हो गया', hinglish: 'Advance record ho gaya', gu: 'એડવાન્સ નોંધાયો', mr: 'अ‍ॅडव्हान्स नोंदवला', mwr: 'एडवांस दरज हो ग्यो' },
  eachInst:  { en: 'each', hi: 'प्रति किस्त', hinglish: 'each', gu: 'દરેક', mr: 'प्रत्येकी', mwr: 'हर एक' },
  byAdmin:   { en: 'recorded by admin', hi: 'एडमिन ने दर्ज किया', hinglish: 'admin ne record kiya', gu: 'એડમિને નોંધ્યું', mr: 'अ‍ॅडमिनने नोंदवले', mwr: 'एडमिन दरज कियो' },
  cancel:    { en: 'Cancel', hi: 'रद्द', hinglish: 'Cancel', gu: 'રદ', mr: 'रद्द', mwr: 'रद्द' },
  requests:  { en: 'Advance requests', hi: 'एडवांस अनुरोध', hinglish: 'Advance requests', gu: 'એડવાન્સ વિનંતીઓ', mr: 'अ‍ॅडव्हान्स विनंत्या', mwr: 'एडवांस अरजियां' },
  noReq:     { en: 'No advance requests.', hi: 'कोई एडवांस अनुरोध नहीं।', hinglish: 'Koi advance request nahi.', gu: 'કોઈ એડવાન્સ વિનંતી નથી.', mr: 'अ‍ॅडव्हान्स विनंती नाही.', mwr: 'कोई एडवांस अरजी कोनी।' },
  approve:   { en: 'Approve', hi: 'मंज़ूर', hinglish: 'Approve', gu: 'મંજૂર', mr: 'मंजूर', mwr: 'मंजूर' },
  reject:    { en: 'Reject', hi: 'अस्वीकार', hinglish: 'Reject', gu: 'નામંજૂર', mr: 'नाकारा', mwr: 'नामंजूर' },
  repaid:    { en: 'Record repayment', hi: 'वापसी दर्ज करें', hinglish: 'Repayment record karein', gu: 'ચુકવણી નોંધો', mr: 'परतफेड नोंदवा', mwr: 'वापसी दरज करो' },
  owing:     { en: 'still owing', hi: 'बाकी', hinglish: 'baki', gu: 'બાકી', mr: 'बाकी', mwr: 'बाकी' },
  all:       { en: 'All', hi: 'सभी', hinglish: 'All', gu: 'બધા', mr: 'सर्व', mwr: 'सगळा' },
  pending:   { en: 'Awaiting decision', hi: 'फैसला बाकी', hinglish: 'Faisla baki', gu: 'નિર્ણય બાકી', mr: 'निर्णय बाकी', mwr: 'फैसलो बाकी' },
  running:   { en: 'Running', hi: 'चल रहे', hinglish: 'Running', gu: 'ચાલુ', mr: 'सुरू', mwr: 'चालू' },
  failed:    { en: 'Something went wrong', hi: 'कुछ गलत हो गया', hinglish: 'Kuch galat ho gaya', gu: 'કંઈક ખોટું થયું', mr: 'काहीतरी चुकले', mwr: 'कीं गलत हो ग्यो' },
};

const inr = (v) => '₹' + Number(v || 0).toLocaleString('en-IN');
const MODE = { next_salary: 'From next salary', emi: 'Instalments', other: 'Other arrangement' };
const STATUS = {
  pending: { label: 'Awaiting', color: '#D97706' },
  approved: { label: 'Running', color: '#10B981' },
  rejected: { label: 'Rejected', color: '#EF4444' },
  closed: { label: 'Repaid', color: '#6B7280' },
  cancelled: { label: 'Withdrawn', color: '#9CA3AF' },
};

export default function SalaryAdmin() {
  const t = useT(S);
  const [staff, setStaff] = useState([]);
  const [advances, setAdvances] = useState([]);
  const [filter, setFilter] = useState('pending');
  const [draft, setDraft] = useState({});       // userId -> typed salary
  const [busy, setBusy] = useState(null);
  // Folded away: most days nobody is recording a cash advance, and an open
  // form on a screen about everyone's pay is an invitation to mistype.
  const [recOpen, setRecOpen] = useState(false);
  const BLANK_REC = { userId: '', amount: '', repayMode: 'next_salary', emiMonths: '3', otherTerms: '', reason: '' };
  const [rec, setRec] = useState(BLANK_REC);
  const setRecField = (k, v) => setRec((f) => ({ ...f, [k]: v }));

  const recordAdvance = async (e) => {
    e.preventDefault();
    setBusy('record');
    try {
      const body = {
        userId: rec.userId,
        amount: Number(rec.amount),
        repayMode: rec.repayMode,
        reason: rec.reason.trim() || undefined,
      };
      if (rec.repayMode === 'emi') body.emiMonths = Number(rec.emiMonths);
      if (rec.repayMode === 'other') body.otherTerms = rec.otherTerms.trim();
      await hrApi.recordAdvance(body);
      showToast(t('recorded'), 'success');
      setRec(BLANK_REC);
      setRecOpen(false);
      await load(filter);
    } catch (err) {
      showToast(err.response?.data?.error || t('failed'), 'error');
    } finally { setBusy(null); }
  };

  const recAmount = Number(rec.amount) || 0;
  const recMonths = Math.max(2, Math.round(Number(rec.emiMonths) || 0));
  const recValid = rec.userId && recAmount > 0
    && (rec.repayMode !== 'emi' || (recMonths >= 2 && recMonths <= 12))
    && (rec.repayMode !== 'other' || rec.otherTerms.trim().length > 0);

  const load = useCallback(async (status) => {
    try {
      const [sal, adv] = await Promise.all([
        hrApi.salaries(),
        hrApi.advances(status && status !== 'all' ? { status } : {}),
      ]);
      setStaff(Array.isArray(sal) ? sal : []);
      setAdvances(Array.isArray(adv) ? adv : []);
    } catch (e) { /* the payroll table above still works */ }
  }, []);

  useEffect(() => { load(filter); }, [filter, load]);

  const saveSalary = async (row) => {
    const value = Number(draft[row.userId]);
    if (!(value >= 0)) return;
    setBusy(row.userId);
    try {
      await hrApi.setSalary(row.userId, value);
      showToast(t('saved'), 'success');
      setDraft((d) => ({ ...d, [row.userId]: undefined }));
      load(filter);
    } catch (e) {
      showToast(e?.response?.data?.error || t('failed'), 'error');
    } finally { setBusy(null); }
  };

  const decide = async (a, approve) => {
    setBusy(a.id);
    try {
      await hrApi.decideAdvance(a.id, { approve });
      load(filter);
    } catch (e) {
      showToast(e?.response?.data?.error || t('failed'), 'error');
    } finally { setBusy(null); }
  };

  const recordRepayment = async (a) => {
    const raw = window.prompt(`${t('repaid')} — ${a.userName} (${inr(a.outstanding)} ${t('owing')})`, String(a.outstanding || ''));
    if (raw === null) return;
    const amount = Number(raw);
    if (!(amount > 0)) return;
    try {
      await hrApi.repayAdvance(a.id, { amount });
      load(filter);
    } catch (e) { showToast(e?.response?.data?.error || t('failed'), 'error'); }
  };

  return (
    <>
      <div className="card" style={{ marginBottom: 14 }} data-testid="salary-admin">
        <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>👥 {t('salaries')}</h3>
        <div style={{ maxHeight: 320, overflowY: 'auto' }}>
          {staff.map((r) => (
            <div key={r.userId} data-testid="salary-row"
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 160px', minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{r.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                  {r.role || ''}
                  {r.salary ? ` · ${inr(r.perDay)} ${t('perDay')}` : ''}
                  {r.outstandingAdvance ? ` · ${inr(r.outstandingAdvance)} ${t('owes')}` : ''}
                  {/* What the last raise was worth, so "how much was he
                      hiked" is answered without opening anything. */}
                  {r.lastHike ? (
                    <span style={{ color: r.lastHike.hike >= 0 ? 'var(--green)' : 'var(--red)' }}>
                      {` · ${t('lastHike')} ${r.lastHike.hike >= 0 ? '+' : '−'}${inr(Math.abs(r.lastHike.hike))}`}
                      {r.lastHike.percent != null ? ` (${r.lastHike.percent}%)` : ''}
                      {` · ${r.lastHike.effectiveMonth}`}
                    </span>
                  ) : null}
                </div>
              </div>
              <input className="input" type="number" min="0" style={{ width: 130 }}
                data-testid="salary-input"
                value={draft[r.userId] !== undefined ? draft[r.userId] : (r.salary || '')}
                onChange={(e) => setDraft((d) => ({ ...d, [r.userId]: e.target.value }))} />
              <button className="btn btn-sm btn-ghost" data-testid="salary-save"
                disabled={busy === r.userId || draft[r.userId] === undefined}
                onClick={() => saveSalary(r)}>
                {t('save')}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }} data-testid="advance-record">
        <div className="flex items-center justify-between" style={{ gap: 10, flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0, fontSize: 15 }}>📥 {t('record')}</h3>
          <button type="button" className="btn btn-sm btn-ghost" data-testid="advance-record-toggle"
            onClick={() => setRecOpen((v) => !v)}>{recOpen ? t('cancel') : '+'}</button>
        </div>
        {recOpen ? (
          <form onSubmit={recordAdvance} style={{ marginTop: 10 }}>
            <div style={{ fontSize: 11.5, color: 'var(--text3)', marginBottom: 8 }}>{t('recordHint')}</div>
            <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
              <div className="form-group" style={{ flex: 2, minWidth: 180, margin: 0 }}>
                <label>{t('staff')}</label>
                <select className="input" value={rec.userId} data-testid="advance-record-user"
                  onChange={(e) => setRecField('userId', e.target.value)}>
                  <option value="">—</option>
                  {staff.map((r) => (
                    <option key={r.userId} value={r.userId}>
                      {r.name}{r.outstandingAdvance ? ` (${inr(r.outstandingAdvance)} ${t('owes')})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ flex: 1, minWidth: 110, margin: 0 }}>
                <label>{t('amount')}</label>
                <input className="input" type="number" min="1" step="0.01" value={rec.amount}
                  data-testid="advance-record-amount"
                  onChange={(e) => setRecField('amount', e.target.value)} />
              </div>
            </div>

            <div className="form-group" style={{ marginTop: 10, marginBottom: 0 }}>
              <label>{t('repayHow')}</label>
              <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
                {[['next_salary', t('nextSal')], ['emi', t('emi')], ['other', t('other')]].map(([k, label]) => (
                  <button key={k} type="button" data-testid={`advance-record-mode-${k}`}
                    className={'btn btn-sm ' + (rec.repayMode === k ? 'btn-primary' : 'btn-ghost')}
                    onClick={() => setRecField('repayMode', k)}>{label}</button>
                ))}
              </div>
            </div>

            {rec.repayMode === 'emi' ? (
              <div className="form-group" style={{ marginTop: 10, marginBottom: 0 }}>
                <label>{t('months')}</label>
                <input className="input" type="number" min="2" max="12" style={{ width: 110 }}
                  value={rec.emiMonths} data-testid="advance-record-months"
                  onChange={(e) => setRecField('emiMonths', e.target.value)} />
                {recAmount > 0 && recMonths >= 2 ? (
                  <div style={{ fontSize: 11.5, color: 'var(--text2)', marginTop: 4 }}>
                    {recMonths} × {inr(Math.round((recAmount / recMonths) * 100) / 100)} {t('eachInst')}
                  </div>
                ) : null}
              </div>
            ) : null}

            {rec.repayMode === 'other' ? (
              <div className="form-group" style={{ marginTop: 10, marginBottom: 0 }}>
                <label>{t('terms')}</label>
                <input className="input" value={rec.otherTerms} data-testid="advance-record-terms"
                  onChange={(e) => setRecField('otherTerms', e.target.value)} />
              </div>
            ) : null}

            <div className="form-group" style={{ marginTop: 10, marginBottom: 0 }}>
              <label>{t('why')}</label>
              <input className="input" value={rec.reason} maxLength={500}
                onChange={(e) => setRecField('reason', e.target.value)} />
            </div>

            <button type="submit" className="btn btn-primary btn-sm" style={{ marginTop: 12 }}
              data-testid="advance-record-save" disabled={busy === 'record' || !recValid}>
              {t('saveRec')}
            </button>
          </form>
        ) : null}
      </div>

      <div className="card" style={{ marginBottom: 14 }} data-testid="advance-admin">
        <div className="flex items-center justify-between" style={{ gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
          <h3 style={{ margin: 0, fontSize: 15 }}>💰 {t('requests')}</h3>
          <select className="input" style={{ width: 170 }} value={filter} data-testid="advance-filter"
            onChange={(e) => setFilter(e.target.value)}>
            <option value="pending">{t('pending')}</option>
            <option value="approved">{t('running')}</option>
            <option value="all">{t('all')}</option>
          </select>
        </div>

        {!advances.length ? (
          <p style={{ fontSize: 12.5, color: 'var(--text3)' }} data-testid="advance-empty">{t('noReq')}</p>
        ) : advances.map((a) => {
          const st = STATUS[a.status] || STATUS.pending;
          return (
            <div key={a.id} data-testid="advance-admin-row"
              style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <div className="flex items-center" style={{ gap: 8, flexWrap: 'wrap' }}>
                <b style={{ fontSize: 13 }}>{a.userName}</b>
                <b style={{ fontSize: 13 }}>{inr(a.amount)}</b>
                {a.recordedByAdmin ? (
                  <span className="badge badge-amber" style={{ fontSize: 10 }}>{t('byAdmin')}</span>
                ) : null}
                <span style={{ fontSize: 11.5, color: 'var(--text3)' }}>
                  {MODE[a.repayMode] || a.repayMode}
                  {a.emiMonths ? ` · ${a.emiMonths} × ${inr(a.emiAmount)}` : ''}
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, color: st.color }}>{st.label}</span>
                {a.status === 'approved' && a.outstanding > 0 && (
                  <span style={{ fontSize: 11.5 }}>{inr(a.outstanding)} {t('owing')}</span>
                )}
              </div>
              {/* What they said, and what they committed to — an approval made
                  without reading either is not really a decision. */}
              {(a.reason || a.otherTerms) && (
                <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
                  {a.reason || ''}{a.reason && a.otherTerms ? ' · ' : ''}{a.otherTerms || ''}
                </div>
              )}
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                {a.pctAtApply ? `${a.pctAtApply}% cap on ${inr(a.salaryAtApply)}` : ''}
              </div>
              <div className="flex" style={{ gap: 8, marginTop: 6 }}>
                {a.status === 'pending' && (
                  <>
                    <button className="btn btn-sm btn-success" data-testid="advance-approve"
                      disabled={busy === a.id} onClick={() => decide(a, true)}>{t('approve')}</button>
                    <button className="btn btn-sm btn-ghost" style={{ color: 'var(--red)' }}
                      data-testid="advance-reject"
                      disabled={busy === a.id} onClick={() => decide(a, false)}>{t('reject')}</button>
                  </>
                )}
                {a.status === 'approved' && a.outstanding > 0 && (
                  <button className="btn btn-sm btn-ghost" data-testid="advance-repay"
                    onClick={() => recordRepayment(a)}>{t('repaid')}</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
