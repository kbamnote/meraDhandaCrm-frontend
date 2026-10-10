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
  owes:      { en: 'advance owing', hi: 'एडवांस बाकी', hinglish: 'advance baki', gu: 'એડવાન્સ બાકી', mr: 'अ‍ॅडव्हान्स बाकी', mwr: 'एडवांस बाकी' },
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
