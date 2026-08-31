/**
 * Year-End Close — /accounting/year-end (Phase 5-4).
 *
 * At 31 March the income and expense heads have to be emptied into Retained
 * Earnings so the new year starts from zero and the balance sheet carries the
 * accumulated profit. Assets, liabilities and equity roll forward untouched.
 *
 * Always previews before it posts: you see every head that will be zeroed and
 * the profit that will move, then confirm. Closing is idempotent — the entry is
 * keyed to the year, so re-closing recomputes rather than double-counting. If a
 * late back-dated entry lands after a close, reopen and close again.
 */
import { useEffect, useMemo, useState } from 'react';
import { ledgerApi, describeError } from '../../services/api';
import { useT } from '../../i18n/LanguageContext';
import { showToast } from '../../components/common/toast';
import { inr } from '../../components/common/DashboardCharts';

// FY label for a date: April starts a new one.
function fyOf(d = new Date()) {
  const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return `${y}-${String((y + 1) % 100).padStart(2, '0')}`;
}
function recentFYs(count = 6) {
  const now = new Date();
  const startY = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return Array.from({ length: count }, (_, i) => {
    const y = startY - i;
    return `${y}-${String((y + 1) % 100).padStart(2, '0')}`;
  });
}

const S = {
  title:    { en: 'Year-End Close', hi: 'वर्ष-अंत क्लोजिंग', hinglish: 'Year-End Close' },
  fy:       { en: 'Financial Year', hi: 'वित्त वर्ष', hinglish: 'Financial Year' },
  period:   { en: 'Period', hi: 'अवधि', hinglish: 'Period' },
  income:   { en: 'Total Income', hi: 'कुल आय', hinglish: 'Total Income' },
  expense:  { en: 'Total Expense', hi: 'कुल खर्च', hinglish: 'Total Expense' },
  netProfit:{ en: 'Net Profit', hi: 'शुद्ध लाभ', hinglish: 'Net Profit' },
  netLoss:  { en: 'Net Loss', hi: 'शुद्ध हानि', hinglish: 'Net Loss' },
  willZero: { en: 'Heads that will be zeroed', hi: 'जो खाते शून्य होंगे', hinglish: 'Jo accounts zero honge' },
  account:  { en: 'Account', hi: 'खाता', hinglish: 'Account' },
  group:    { en: 'Group', hi: 'समूह', hinglish: 'Group' },
  balance:  { en: 'Balance', hi: 'बैलेंस', hinglish: 'Balance' },
  close:    { en: 'Close this year', hi: 'यह वर्ष बंद करें', hinglish: 'Yeh year close karein' },
  reclose:  { en: 'Re-close (recompute)', hi: 'फिर से बंद करें', hinglish: 'Phir se close karein' },
  reopen:   { en: 'Reopen', hi: 'फिर से खोलें', hinglish: 'Reopen' },
  closed:   { en: 'Closed', hi: 'बंद', hinglish: 'Closed' },
  open:     { en: 'Open', hi: 'खुला', hinglish: 'Open' },
  nothing:  { en: 'No income or expense activity in this year — nothing to close.', hi: 'इस वर्ष कोई गतिविधि नहीं।', hinglish: 'Is year koi activity nahi.' },
  loading:  { en: 'Loading…', hi: '…', hinglish: 'Loading…' },
  failed:   { en: 'Failed', hi: 'नहीं हुआ', hinglish: 'Fail hua' },
  closedYears: { en: 'Closed years', hi: 'बंद वर्ष', hinglish: 'Closed years' },
  noneClosed:  { en: 'No year has been closed yet.', hi: 'अभी कोई वर्ष बंद नहीं।', hinglish: 'Abhi koi year close nahi hua.' },
  whatHappens: {
    en: 'Income and expense heads are emptied into Retained Earnings. Assets, liabilities and equity are not touched. Safe to run again — the entry is keyed to the year, so re-closing recomputes instead of double-counting.',
    hi: 'आय और व्यय खाते Retained Earnings में चले जाते हैं। संपत्ति, देनदारी और पूंजी अछूती रहती हैं।',
    hinglish: 'Income aur expense heads Retained Earnings mein chale jaate hain. Assets, liabilities, equity untouched rehte hain.',
  },
  confirmClose: { en: 'Close this financial year? The closing entry can be reversed with Reopen.', hi: 'यह वित्त वर्ष बंद करें?', hinglish: 'Yeh financial year close karein?' },
  confirmReopen:{ en: 'Reopen this year? The closing entry will be removed from the ledger.', hi: 'यह वर्ष फिर से खोलें?', hinglish: 'Yeh year reopen karein?' },
  reopened: { en: 'Reopened', hi: 'फिर से खुला', hinglish: 'Reopened' },
};

export default function YearEndPage() {
  const t = useT(S);
  const [fy, setFy] = useState(fyOf());
  const [preview, setPreview] = useState(null);
  const [closedList, setClosedList] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const options = useMemo(() => recentFYs(6), []);

  const loadClosed = () => ledgerApi.yearEndClosed().then(setClosedList).catch(() => setClosedList([]));

  // `t` is unstable per render (useT) and must never be a dependency.
  useEffect(() => {
    let cancelled = false;
    setPreview(null); setErr('');
    ledgerApi.yearEndPreview(fy)
      .then((r) => { if (!cancelled) setPreview(r); })
      .catch((e) => { if (!cancelled) { setPreview(null); setErr(describeError(e, t('failed'))); } });
    return () => { cancelled = true; };
  }, [fy]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadClosed(); }, []);

  const refresh = () => {
    ledgerApi.yearEndPreview(fy).then(setPreview).catch(() => {});
    loadClosed();
  };

  const doClose = async () => {
    if (!window.confirm(t('confirmClose'))) return;
    setBusy(true);
    try {
      const r = await ledgerApi.yearEndClose(fy);
      showToast(`✅ FY ${fy} — ${inr(Math.abs(r.netProfit))} ${r.netProfit >= 0 ? 'profit' : 'loss'} moved to Retained Earnings`, 'success');
      refresh();
    } catch (e) { showToast(describeError(e, t('failed')), 'error'); }
    finally { setBusy(false); }
  };

  const doReopen = async () => {
    if (!window.confirm(t('confirmReopen'))) return;
    setBusy(true);
    try {
      await ledgerApi.yearEndReopen(fy);
      showToast('✅ ' + t('reopened'), 'success');
      refresh();
    } catch (e) { showToast(describeError(e, t('failed')), 'error'); }
    finally { setBusy(false); }
  };

  const profit = preview?.netProfit ?? 0;
  const isProfit = profit >= 0;
  const COLS = 'minmax(160px, 1fr) 110px 130px';

  return (
    <div>
      <div className="flex items-center justify-between mb-4" style={{ flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>🗓️ {t('title')}</h2>
        <select className="input" style={{ width: 160 }} value={fy} onChange={(e) => setFy(e.target.value)}>
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>

      <div className="card" style={{ padding: '10px 14px', marginBottom: 12, fontSize: 12.5, color: 'var(--text2)' }}>
        ℹ️ {t('whatHappens')}
      </div>

      {err && <div className="card" style={{ padding: 16, color: 'var(--red)', marginBottom: 12 }}>{err}</div>}
      {!preview && !err && <div className="card" style={{ padding: 30, textAlign: 'center', color: 'var(--text3)' }}>{t('loading')}</div>}

      {preview && (
        <>
          <div className="card" style={{ padding: 16, marginBottom: 12 }}>
            <div className="flex items-center justify-between" style={{ flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', fontWeight: 700 }}>{t('period')}</div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{preview.from} → {preview.to}</div>
              </div>
              <span className="badge" style={{
                background: preview.closed ? 'rgba(16,185,129,.14)' : 'var(--surface2)',
                color: preview.closed ? 'var(--green, #059669)' : 'var(--text2)',
                textTransform: 'uppercase', fontWeight: 700,
              }}>{preview.closed ? t('closed') : t('open')}</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16, marginTop: 14 }}>
              <Tile label={t('income')} value={inr(preview.income)} />
              <Tile label={t('expense')} value={inr(preview.expense)} />
              <Tile
                label={isProfit ? t('netProfit') : t('netLoss')}
                value={inr(Math.abs(profit))}
                color={isProfit ? 'var(--green, #059669)' : 'var(--red, #DC2626)'}
              />
            </div>

            <div className="flex" style={{ gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
              {!!preview.closing.length && (
                <button className="btn btn-primary btn-sm" onClick={doClose} disabled={busy}>
                  {busy ? '…' : (preview.closed ? t('reclose') : t('close'))}
                </button>
              )}
              {preview.closed && (
                <button className="btn btn-sm" onClick={doReopen} disabled={busy}
                  style={{ border: '1px solid var(--border)', color: 'var(--red, #DC2626)' }}>{t('reopen')}</button>
              )}
            </div>
            {!preview.closing.length && (
              <div style={{ marginTop: 12, color: 'var(--text3)', fontSize: 13 }}>{t('nothing')}</div>
            )}
          </div>

          {!!preview.closing.length && (
            <div className="card" style={{ padding: 0, overflowX: 'auto', marginBottom: 12 }}>
              <div style={{ padding: '10px 14px', fontWeight: 700, fontSize: 13, borderBottom: '1px solid var(--border)' }}>
                {t('willZero')} ({preview.closing.length})
              </div>
              <div style={{ minWidth: 420 }}>
                <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: 8, padding: '8px 14px', fontSize: 11, textTransform: 'uppercase', color: 'var(--text3)', fontWeight: 700, borderBottom: '1px solid var(--border)' }}>
                  <div>{t('account')}</div><div>{t('group')}</div><div style={{ textAlign: 'right' }}>{t('balance')}</div>
                </div>
                {preview.closing.map((r) => (
                  <div key={r.account} style={{ display: 'grid', gridTemplateColumns: COLS, gap: 8, padding: '9px 14px', borderBottom: '1px solid var(--border)', fontSize: 12.5 }}>
                    <div style={{ fontWeight: 600 }}>{r.name}</div>
                    <div style={{ color: 'var(--text3)', textTransform: 'capitalize' }}>{r.group}</div>
                    <div style={{ textAlign: 'right', fontWeight: 600 }}>{inr(r.balance)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '10px 14px', fontWeight: 700, fontSize: 13, borderBottom: '1px solid var(--border)' }}>{t('closedYears')}</div>
        {!closedList.length && <div style={{ padding: 20, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>{t('noneClosed')}</div>}
        {closedList.map((r) => (
          <div key={r.fy} className="flex items-center justify-between" style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
            <span style={{ fontWeight: 600 }}>FY {r.fy}</span>
            <span style={{ color: 'var(--text3)', fontSize: 12 }}>{r.date}</span>
            <span style={{ fontWeight: 700, color: r.netProfit >= 0 ? 'var(--green, #059669)' : 'var(--red, #DC2626)' }}>
              {inr(Math.abs(r.netProfit))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Tile({ label, value, color }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: .3 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: color || 'var(--text)' }}>{value}</div>
    </div>
  );
}
