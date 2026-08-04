/**
 * Cash & Bank — cash book, bank book, quick transfers, cash-flow chart.
 * Reads ledger accounts + journal entries filtered to cash/bank. No new
 * backend routes needed — everything is served by existing ledger endpoints.
 */
import { useEffect, useMemo, useState } from 'react';
import { ledgerApi } from '../../services/api';
import { useT } from '../../i18n/LanguageContext';
import { showToast } from '../../components/common/toast';
import { Kpi, KpiGrid, ColumnChart, Section, inr } from '../../components/common/DashboardCharts';

const round2 = (n) => Math.round(((Number(n) || 0) * 100) + 1e-8) / 100;
const today = () => new Date().toISOString().slice(0, 10);

const S = {
  title:   { en: 'Cash & Bank', hi: 'नकदी और बैंक', hinglish: 'Cash & Bank' },
  cash:    { en: 'Cash in Hand', hi: 'नकदी', hinglish: 'Cash in Hand' },
  bank:    { en: 'Bank Balance', hi: 'बैंक', hinglish: 'Bank Balance' },
  total:   { en: 'Total', hi: 'कुल', hinglish: 'Total' },
  net:     { en: 'This Month Net', hi: 'इस महीने नेट', hinglish: 'Is Mahine Net' },
  cashBook:{ en: 'Cash Book', hi: 'नकद पुस्तक', hinglish: 'Cash Book' },
  bankBook:{ en: 'Bank Book', hi: 'बैंक पुस्तक', hinglish: 'Bank Book' },
  cashFlow:{ en: 'Cash Flow', hi: 'कैश फ्लो', hinglish: 'Cash Flow' },
  transfer:{ en: 'Quick Transfer', hi: 'त्वरित ट्रांसफर', hinglish: 'Quick Transfer' },
  deposit: { en: 'Deposit to Bank (Cash → Bank)', hi: 'बैंक में जमा', hinglish: 'Bank Mein Deposit' },
  withdraw:{ en: 'Withdraw to Cash (Bank → Cash)', hi: 'नकदी में निकासी', hinglish: 'Cash Mein Withdraw' },
  amount:  { en: 'Amount', hi: 'राशि', hinglish: 'Amount' },
  date:    { en: 'Date', hi: 'तारीख', hinglish: 'Date' },
  memo:    { en: 'Memo (optional)', hi: 'मेमो (वैकल्पिक)', hinglish: 'Memo (optional)' },
  save:    { en: 'Record Transfer', hi: 'ट्रांसफर दर्ज करें', hinglish: 'Transfer Record Karo' },
  cancel:  { en: 'Cancel', hi: 'रद्द', hinglish: 'Cancel' },
  dateH:   { en: 'Date', hi: 'तारीख', hinglish: 'Date' },
  typeH:   { en: 'Type', hi: 'प्रकार', hinglish: 'Type' },
  descH:   { en: 'Description', hi: 'विवरण', hinglish: 'Description' },
  drH:     { en: 'Debit (₹)', hi: 'डेबिट (₹)', hinglish: 'Debit' },
  crH:     { en: 'Credit (₹)', hi: 'क्रेडिट (₹)', hinglish: 'Credit' },
  balH:    { en: 'Balance (₹)', hi: 'बैलेंस (₹)', hinglish: 'Balance' },
  noEntries:{ en: 'No transactions yet', hi: 'अभी कोई लेनदेन नहीं', hinglish: 'No transactions yet' },
  monthlyIn:{ en: 'Monthly In/Out', hi: 'मासिक आमद/खर्च', hinglish: 'Monthly In/Out' },
  journal  :{ en: 'Journal entries', hi: 'जर्नल', hinglish: 'Journal entries' },
};

// Describe a journal entry for the cash/bank book.
const describe = (e) => {
  const m = e.meta || {};
  if (m.invoiceNo && m.clientName) return `${m.invoiceNo} — ${m.clientName}`;
  if (m.clientName) return `${m.clientName}`;
  if (m.vendorName) return `${m.vendorName}`;
  if (m.memo) return m.memo;
  if (m.description) return m.description;
  if (m.productName) return m.productName;
  return (e.type || '').replace(/-/g, ' ');
};

const TABS = ['cashBook', 'bankBook', 'cashFlow'];
const ACCT = ['cash', 'bank'];

export default function CashBankPage() {
  const t = useT(S);
  const [accounts, setAccounts] = useState([]);
  const [cashFlow, setCashFlow] = useState({ series: [] });
  const [entries, setEntries] = useState([]); // raw entries for the active tab
  const [tab, setTab] = useState('cashBook'); // cashBook | bankBook | cashFlow
  const [tick, setTick] = useState(0); // bump to refresh
  const [err, setErr] = useState(null);

  // Transfer modal state
  const [showXfer, setShowXfer] = useState(false);
  const [xferDir, setXferDir] = useState('deposit'); // deposit=Cash→Bank, withdraw=Bank→Cash
  const [xferAmt, setXferAmt] = useState('');
  const [xferDate, setXferDate] = useState(today);
  const [xferMemo, setXferMemo] = useState('');
  const [saving, setSaving] = useState(false);

  // Which account the active tab shows
  const acctKey = tab === 'bankBook' ? 'bank' : 'cash';

  // ── data loading ──
  useEffect(() => {
    let alive = true;
    Promise.all([
      ledgerApi.accounts(),
      ledgerApi.cashFlow({ months: 12 }),
    ]).then(([accts, cf]) => {
      if (!alive) return;
      setAccounts(accts);
      setCashFlow(cf);
      setErr(null);
    }).catch(() => { if (alive) setErr('Failed to load accounts'); });
    return () => { alive = false; };
  }, [tick]);

  // Load journal entries when a book tab is active
  useEffect(() => {
    if (tab === 'cashFlow') { setEntries([]); return; }
    let alive = true;
    ledgerApi.entries({ account: acctKey })
      .then((r) => { if (alive) setEntries(r.entries || []); setErr(null); })
      .catch(() => { if (alive) setEntries([]); /* 403 = no entries access, silently degrade */ });
    return () => { alive = false; };
  }, [tab, acctKey, tick]);

  // ── derived data ──
  const acct = (key) => accounts.find((a) => a.key === key);
  const cashBal = acct('cash')?.balance || 0;
  const bankBal = acct('bank')?.balance || 0;
  const totalBal = round2(cashBal + bankBal);

  // This-month net from cash-flow series
  const thisMonth = new Date().toISOString().slice(0, 7);
  const monthNet = useMemo(() => {
    const m = cashFlow.series.find((s) => s.month === thisMonth);
    return m ? m.net : 0;
  }, [cashFlow.series, thisMonth]);

  // Running balance (ascending date order)
  const rows = useMemo(() => {
    const asc = [...entries].sort((a, b) => (a.date || '').localeCompare(b.date) || (a.createdAt || 0) - (b.createdAt || 0));
    let bal = 0;
    return asc.map((e) => {
      const line = e.lines.find((l) => l.account === acctKey);
      const dr = line?.dr || 0;
      const cr = line?.cr || 0;
      bal = round2(bal + dr - cr);
      return { ...e, dr, cr, balance: bal };
    });
  }, [entries, acctKey]);

  // Newest first for display (balance still shows the value at that point in time)
  const displayed = useMemo(() => [...rows].reverse(), [rows]);

  // Cash-flow chart data
  const cfData = useMemo(() => {
    const inData = cashFlow.series.map((r) => ({ label: r.month.slice(5), value: r.in }));
    const outData = cashFlow.series.map((r) => ({ label: r.month.slice(5), value: r.out }));
    return { inData, outData };
  }, [cashFlow.series]);

  // ── transfer ──
  const doTransfer = async () => {
    const amt = round2(Number(xferAmt));
    if (amt <= 0) return showToast('Enter a valid amount', 'error');
    setSaving(true);
    try {
      const from = xferDir === 'deposit' ? 'cash' : 'bank';
      const to = xferDir === 'deposit' ? 'bank' : 'cash';
      await ledgerApi.entry({
        type: 'contra',
        date: xferDate,
        memo: xferMemo || (xferDir === 'deposit' ? 'Cash deposited to bank' : 'Cash withdrawn from bank'),
        lines: [
          { account: to, dr: amt },
          { account: from, cr: amt },
        ],
      });
      showToast('Transfer recorded', 'success');
      setShowXfer(false);
      setXferAmt('');
      setXferMemo('');
      setTick((n) => n + 1);
    } catch (e2) {
      showToast(e2.response?.data?.error || 'Transfer failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>{t('title')}</h2>
        <button className="btn btn-primary btn-sm" onClick={() => { setXferDir('deposit'); setShowXfer(true); }}>
          💸 {t('transfer')}
        </button>
      </div>

      {/* KPIs */}
      <KpiGrid>
        <Kpi label={t('cash')} value={inr(cashBal)} icon="💵" color="var(--green)" />
        <Kpi label={t('bank')} value={inr(bankBal)} icon="🏦" color="var(--blue)" />
        <Kpi label={t('total')} value={inr(totalBal)} icon="💰" color="var(--text)" />
        <Kpi label={t('net')} value={inr(monthNet)} icon="📊" color={monthNet >= 0 ? 'var(--green)' : 'var(--red)'} />
      </KpiGrid>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--border)', marginBottom: 16 }}>
        {TABS.map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            style={{
              padding: '8px 16px', cursor: 'pointer', border: 'none', background: 'none',
              fontWeight: tab === k ? 600 : 400, fontSize: 13,
              color: tab === k ? 'var(--blue)' : 'var(--text2)',
              borderBottom: tab === k ? '2px solid var(--blue)' : '2px solid transparent',
              marginBottom: -2, transition: 'color .15s',
            }}
          >
            {k === 'cashFlow' ? `📈 ${t(k)}` : k === 'cashBook' ? `💵 ${t(k)}` : `🏦 ${t(k)}`}
          </button>
        ))}
      </div>

      {err && <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 8 }}>{err}</div>}

      {/* Cash Book / Bank Book */}
      {(tab === 'cashBook' || tab === 'bankBook') && (
        <div>
          {displayed.length === 0 ? (
            <div style={{ color: 'var(--text3)', fontSize: 13, padding: '24px 0', textAlign: 'center' }}>{t('noEntries')}</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)' }}>
                    <th style={thStyle}>{t('dateH')}</th>
                    <th style={thStyle}>{t('typeH')}</th>
                    <th style={{ ...thStyle, textAlign: 'left' }}>{t('descH')}</th>
                    <th style={thStyle}>{t('drH')}</th>
                    <th style={thStyle}>{t('crH')}</th>
                    <th style={thStyle}>{t('balH')}</th>
                  </tr>
                </thead>
                <tbody>
                  {displayed.map((r) => (
                    <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={tdStyle}>{r.date}</td>
                      <td style={tdStyle}>
                        <span style={{
                          display: 'inline-block', padding: '1px 6px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                          background: r.type === 'contra' ? 'var(--amber)' :
                            ['payment', 'receipt'].includes(r.type) ? 'var(--blue)' :
                            r.type === 'expense' ? 'var(--red)' : 'var(--green)',
                          color: '#fff',
                        }}>
                          {r.type}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'left', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {describe(r)}
                      </td>
                      <td style={{ ...tdStyle, color: r.dr > 0 ? 'var(--green)' : 'var(--text3)', fontWeight: r.dr > 0 ? 600 : 400, textAlign: 'right' }}>
                        {r.dr > 0 ? inr(r.dr) : '—'}
                      </td>
                      <td style={{ ...tdStyle, color: r.cr > 0 ? 'var(--red)' : 'var(--text3)', fontWeight: r.cr > 0 ? 600 : 400, textAlign: 'right' }}>
                        {r.cr > 0 ? inr(r.cr) : '—'}
                      </td>
                      <td style={{ ...tdStyle, fontWeight: 600, textAlign: 'right' }}>
                        {inr(r.balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Cash Flow tab */}
      {tab === 'cashFlow' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
          <Section title={t('monthlyIn')}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, alignItems: 'end' }}>
              <ColumnChart data={cfData.inData} color="var(--green)" money height={160} />
              <ColumnChart data={cfData.outData} color="var(--red)" money height={160} />
            </div>
          </Section>

          <Section title={t('cashFlow')}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)' }}>
                    <th style={thStyle}>Month</th>
                    <th style={thStyle}>In (₹)</th>
                    <th style={thStyle}>Out (₹)</th>
                    <th style={thStyle}>Net (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {[...cashFlow.series].reverse().map((r) => (
                    <tr key={r.month} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={tdStyle}>{r.month}</td>
                      <td style={{ ...tdStyle, color: 'var(--green)', textAlign: 'right' }}>{r.in > 0 ? inr(r.in) : '—'}</td>
                      <td style={{ ...tdStyle, color: 'var(--red)', textAlign: 'right' }}>{r.out > 0 ? inr(r.out) : '—'}</td>
                      <td style={{ ...tdStyle, color: r.net >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600, textAlign: 'right' }}>{inr(r.net)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </div>
      )}

      {/* ── Transfer Modal ── */}
      {showXfer && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>💸 {t('transfer')}</h3>

            {/* Direction */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {[
                { key: 'deposit', label: t('deposit'), icon: '💵→🏦' },
                { key: 'withdraw', label: t('withdraw'), icon: '🏦→💵' },
              ].map((d) => (
                <button
                  key={d.key}
                  onClick={() => setXferDir(d.key)}
                  style={{
                    flex: 1, padding: '8px 12px', borderRadius: 6, border: '2px solid',
                    borderColor: xferDir === d.key ? 'var(--blue)' : 'var(--border)',
                    background: xferDir === d.key ? 'var(--blue)' : 'var(--surface)',
                    color: xferDir === d.key ? '#fff' : 'var(--text)',
                    cursor: 'pointer', fontSize: 13, fontWeight: 600,
                  }}
                >
                  {d.icon} {d.label}
                </button>
              ))}
            </div>

            {/* Amount */}
            <label style={labelStyle}>{t('amount')}</label>
            <input
              type="number" min="0" step="0.01"
              placeholder="0.00"
              value={xferAmt}
              onChange={(e) => setXferAmt(e.target.value)}
              style={inputStyle}
              autoFocus
            />

            {/* Date */}
            <label style={labelStyle}>{t('date')}</label>
            <input
              type="date"
              value={xferDate}
              onChange={(e) => setXferDate(e.target.value)}
              style={inputStyle}
            />

            {/* Memo */}
            <label style={labelStyle}>{t('memo')}</label>
            <input
              type="text"
              placeholder={t('memo')}
              value={xferMemo}
              onChange={(e) => setXferMemo(e.target.value)}
              style={inputStyle}
              maxLength={200}
            />

            {/* Buttons */}
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setShowXfer(false)} disabled={saving}>{t('cancel')}</button>
              <button className="btn btn-primary" onClick={doTransfer} disabled={saving || !xferAmt}>
                {saving ? '...' : t('save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── styles ──
const thStyle = { textAlign: 'right', padding: '6px 8px', color: 'var(--text3)', fontWeight: 500, fontSize: 12 };
const tdStyle = { padding: '6px 8px', textAlign: 'right', color: 'var(--text)' };
const labelStyle = { display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text2)', marginBottom: 4, marginTop: 10 };
const inputStyle = {
  width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)',
  background: 'var(--surface)', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box',
};
const overlayStyle = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex',
  alignItems: 'center', justifyContent: 'center', zIndex: 9999,
};
const modalStyle = {
  background: 'var(--surface)', borderRadius: 10, padding: 20,
  width: '90%', maxWidth: 400, boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
};
