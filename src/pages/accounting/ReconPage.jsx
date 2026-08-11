/**
 * Bank Reconciliation (Phase 4A-3) — match bank statement lines to bank ledger
 * entries within a tolerance window.
 *
 * Reads GET /accounting/recon (bank book + statement lines + candidate matches +
 * summary). Writes: POST /recon/statements (single/bulk import), POST /recon/match
 * (manual), POST /recon/unmatch, POST /recon/auto-match, DELETE /recon/statements/:id.
 *
 * Match state lives on the statement line (matchedEntryId), NOT on journalEntries,
 * so it survives the ledger's delete-and-repost on edits.
 */
import { useEffect, useMemo, useState } from 'react';
import { accountingApi } from '../../services/api';
import { useT } from '../../i18n/LanguageContext';
import { showToast } from '../../components/common/toast';
import { Kpi, KpiGrid, Section, inr } from '../../components/common/DashboardCharts';
import BranchSelect from '../../components/common/BranchSelect';

const round2 = (n) => Math.round(((Number(n) || 0) * 100) + 1e-8) / 100;
const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => `${today().slice(0, 7)}-01`;

const S = {
  title:     { en: '🏦 Bank Reconciliation', hi: '🏦 बैंक मिलान', hinglish: '🏦 Bank Reconciliation' },
  refresh:   { en: 'Refresh', hi: 'रिफ्रेश', hinglish: 'Refresh' },
  from:      { en: 'From', hi: 'से', hinglish: 'From' },
  to:        { en: 'To', hi: 'तक', hinglish: 'To' },
  branch:    { en: 'Branch', hi: 'शाखा', hinglish: 'Branch' },
  allBranches: { en: 'All branches', hi: 'सभी शाखाएं', hinglish: 'All branches' },
  tolerance: { en: 'Tolerance (days)', hi: 'अंतर (दिन)', hinglish: 'Tolerance (days)' },
  apply:     { en: 'Apply', hi: 'लागू करें', hinglish: 'Apply' },
  bankBal:   { en: 'Bank Balance (Book)', hi: 'बैंक बैलेंस (बही)', hinglish: 'Bank Balance (Book)' },
  stmtCount: { en: 'Statement Lines', hi: 'स्टेटमेंट लाइनें', hinglish: 'Statement Lines' },
  matched:   { en: 'Matched', hi: 'मिलान हुआ', hinglish: 'Matched' },
  difference:{ en: 'Difference', hi: 'अंतर', hinglish: 'Difference' },
  reconciled:{ en: 'Reconciled ✓', hi: 'मिलान पूरा ✓', hinglish: 'Reconciled ✓' },
  reconciledSub:{ en: 'Books and bank agree to the paisa.', hi: 'बही और बैंक पूरी तरह मेल खाते हैं।', hinglish: 'Books and bank agree.' },
  diffSub:   { en: 'Unmatched statement − unmatched book', hi: 'बिना मिलान स्टेटमेंट − बिना मिलान बही', hinglish: 'Unmatched statement - unmatched book' },
  addLines:  { en: 'Add Statement Lines', hi: 'स्टेटमेंट लाइनें जोड़ें', hinglish: 'Statement Lines Add Karo' },
  date:      { en: 'Date', hi: 'तारीख', hinglish: 'Date' },
  amount:    { en: 'Amount', hi: 'राशि', hinglish: 'Amount' },
  narration: { en: 'Narration', hi: 'विवरण', hinglish: 'Narration' },
  refNo:     { en: 'Ref No', hi: 'रेफ नं', hinglish: 'Ref No' },
  addLine:   { en: 'Add Line', hi: 'लाइन जोड़ें', hinglish: 'Line Add Karo' },
  bulkHint:  { en: 'Bulk paste — one per line: date,amount,narration (positive = money IN, negative = OUT)', hi: 'बल्क पेस्ट — हर लाइन: तारीख,राशि,विवरण', hinglish: 'Bulk paste - ek line per: date,amount,narration' },
  importLines:{ en: 'Import Lines', hi: 'लाइनें जोड़ें', hinglish: 'Lines Import Karo' },
  autoMatch: { en: '⚡ Auto-Match', hi: '⚡ ऑटो मिलान', hinglish: '⚡ Auto-Match' },
  stDate:    { en: 'Date', hi: 'तारीख', hinglish: 'Date' },
  stNarr:    { en: 'Narration', hi: 'विवरण', hinglish: 'Narration' },
  stAmt:     { en: 'Amount', hi: 'राशि', hinglish: 'Amount' },
  stStatus:  { en: 'Status', hi: 'स्थिति', hinglish: 'Status' },
  stAction:  { en: 'Match', hi: 'मिलान', hinglish: 'Match' },
  matchedBadge: { en: 'Matched', hi: 'मिलान', hinglish: 'Matched' },
  unmatchedBadge: { en: 'Unmatched', hi: 'बिना मिलान', hinglish: 'Unmatched' },
  matchDrop: { en: 'Match…', hi: 'मिलान…', hinglish: 'Match…' },
  unmatch:   { en: 'Unmatch', hi: 'मिलान हटाएं', hinglish: 'Unmatch' },
  delete:    { en: 'Delete', hi: 'हटाएं', hinglish: 'Delete' },
  noStmts:   { en: 'No statement lines in this period.', hi: 'इस अवधि में कोई स्टेटमेंट लाइन नहीं।', hinglish: 'No statement lines in this period.' },
  noCand:    { en: '—', hi: '—', hinglish: '—' },
  unmatchedBook: { en: 'Unmatched Book Entries', hi: 'बिना मिलान बही प्रविष्टियाँ', hinglish: 'Unmatched Book Entries' },
  bookDate:  { en: 'Date', hi: 'तारीख', hinglish: 'Date' },
  bookType:  { en: 'Type', hi: 'प्रकार', hinglish: 'Type' },
  bookRef:   { en: 'Ref', hi: 'रेफ', hinglish: 'Ref' },
  bookAmt:   { en: 'Amount', hi: 'राशि', hinglish: 'Amount' },
  noBook:    { en: 'All bank entries are matched. 🎉', hi: 'सभी बैंक प्रविष्टियाँ मिल चुकी हैं। 🎉', hinglish: 'All bank entries matched. 🎉' },
  confirmDel:{ en: 'Delete this statement line?', hi: 'यह स्टेटमेंट लाइन हटाएं?', hinglish: 'Delete this statement line?' },
  autoDone:  { en: 'Auto-matched', hi: 'ऑटो मिलान', hinglish: 'Auto-matched' },
  imported:  { en: 'Imported', hi: 'जोड़ी गईं', hinglish: 'Imported' },
  lines:     { en: 'line(s)', hi: 'लाइनें', hinglish: 'line(s)' },
};

const fmtAmt = (n) => `${n > 0 ? '+' : ''}${inr(n)}`;

export default function ReconPage() {
  const t = useT(S);
  const [data, setData] = useState(null); // recon payload
  const [filters, setFilters] = useState({ from: monthStart(), to: today(), branchId: '', tolerance: 3 });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  // add-line form
  const [lDate, setLDate] = useState(today());
  const [lAmount, setLAmount] = useState('');
  const [lNarr, setLNarr] = useState('');
  const [lRef, setLRef] = useState('');
  const [paste, setPaste] = useState('');
  const [adding, setAdding] = useState(false);

  const load = () => {
    setBusy(true); setErr(null);
    accountingApi.recon(filters)
      .then((r) => setData(r))
      .catch((e) => { setErr(e.response?.data?.error || 'Failed to load'); setData(null); })
      .finally(() => setBusy(false));
  };

  useEffect(() => { load(); }, []); // eslint-disable-line

  // statementId → candidate book entries
  const candMap = useMemo(() => {
    const m = {};
    for (const c of (data?.candidates || [])) m[c.statementId] = c.matches || [];
    return m;
  }, [data]);

  const summary = data?.summary;
  const bankBal = data?.bankBalance ?? 0;
  const reconciled = !!summary && summary.statementCount > 0 && summary.difference === 0;
  const unmatchedBook = (data?.book || []).filter((b) => !b.matched);

  // ── actions ──
  const refresh = () => { load(); };

  const addSingle = async () => {
    if (!lDate || !Number(lAmount)) return showToast(t('noCand'), 'error');
    setAdding(true);
    try {
      await accountingApi.reconStatements([{ date: lDate, amount: round2(Number(lAmount)), narration: lNarr || null, refNo: lRef || null }]);
      showToast(t('imported') + ' 1 ' + t('lines'), 'success');
      setLAmount(''); setLNarr(''); setLRef('');
      load();
    } catch (e) { showToast(e.response?.data?.error || 'Failed to add', 'error'); }
    finally { setAdding(false); }
  };

  const importBulk = async () => {
    const lines = paste.split(/\n+/).map((s) => s.trim()).filter(Boolean);
    const rows = [];
    for (const ln of lines) {
      const [date, amount, narration = null, refNo = null] = ln.split(/[,\t|]+/).map((s) => s.trim());
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !Number(amount)) continue;
      rows.push({ date, amount: round2(Number(amount)), narration, refNo });
    }
    if (!rows.length) return showToast(t('noCand'), 'error');
    setAdding(true);
    try {
      const r = await accountingApi.reconStatements(rows);
      showToast(`${t('imported')} ${r.created.length} ${t('lines')}`, 'success');
      setPaste('');
      load();
    } catch (e) { showToast(e.response?.data?.error || 'Failed to import', 'error'); }
    finally { setAdding(false); }
  };

  const doAutoMatch = async () => {
    setBusy(true);
    try {
      const r = await accountingApi.reconAutoMatch(filters);
      showToast(`${t('autoDone')} ${r.matched}`, r.matched ? 'success' : 'error');
      load();
    } catch (e) { showToast(e.response?.data?.error || 'Auto-match failed', 'error'); setBusy(false); }
  };

  const doMatch = async (statementId, entryId) => {
    try { await accountingApi.reconMatch({ statementId, entryId }); load(); }
    catch (e) { showToast(e.response?.data?.error || 'Match failed', 'error'); }
  };

  const doUnmatch = async (statementId) => {
    try { await accountingApi.reconUnmatch({ statementId }); load(); }
    catch (e) { showToast(e.response?.data?.error || 'Unmatch failed', 'error'); }
  };

  const doDelete = async (s) => {
    if (!window.confirm(`${t('confirmDel')} (${s.date}, ${inr(s.amount)})`)) return;
    try { await accountingApi.reconDelete(s.id); load(); }
    catch (e) { showToast(e.response?.data?.error || 'Delete failed', 'error'); }
  };

  const setF = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>{t('title')}</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary btn-sm" onClick={doAutoMatch} disabled={busy}>{t('autoMatch')}</button>
          <button className="btn btn-ghost btn-sm" onClick={refresh} disabled={busy}>{busy ? '…' : t('refresh')}</button>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, alignItems: 'end' }}>
          <div>
            <label style={labelStyle}>{t('from')}</label>
            <input type="date" className="input" value={filters.from} onChange={setF('from')} />
          </div>
          <div>
            <label style={labelStyle}>{t('to')}</label>
            <input type="date" className="input" value={filters.to} onChange={setF('to')} />
          </div>
          <div>
            <label style={labelStyle}>{t('branch')}</label>
            <BranchSelect value={filters.branchId} onChange={(v) => setFilters((f) => ({ ...f, branchId: v }))} allowAll allLabel={t('allBranches')} />
          </div>
          <div>
            <label style={labelStyle}>{t('tolerance')}</label>
            <input type="number" min="0" max="30" className="input" value={filters.tolerance} onChange={setF('tolerance')} />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button className="btn" onClick={refresh} disabled={busy}>{t('apply')}</button>
          </div>
        </div>
      </div>

      {err && <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 8 }}>{err}</div>}

      {!data ? (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>…</div>
      ) : (
        <>
          {/* Reconciled banner */}
          {reconciled && (
            <div style={{
              background: 'var(--green)', color: '#fff', borderRadius: 8, padding: '10px 16px', marginBottom: 16,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
            }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>{t('reconciled')}</span>
              <span style={{ fontSize: 12, opacity: .95 }}>{t('reconciledSub')}</span>
            </div>
          )}

          {/* KPIs */}
          <KpiGrid>
            <Kpi label={t('bankBal')} value={inr(bankBal)} icon="🏦" color="var(--blue)" />
            <Kpi label={t('stmtCount')} value={String(summary.statementCount)} icon="🧾" color="var(--text)" />
            <Kpi label={t('matched')} value={`${summary.statementMatched}/${summary.statementCount}`} icon="✅" color="var(--green)" />
            <Kpi
              label={t('difference')} value={inr(summary.difference)} icon="⚖️"
              color={reconciled ? 'var(--green)' : summary.difference === 0 ? 'var(--text3)' : 'var(--amber)'}
              sub={t('diffSub')}
            />
          </KpiGrid>

          {/* Add lines */}
          <Section title={t('addLines')}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, alignItems: 'end' }}>
              <div>
                <label style={labelStyle}>{t('date')}</label>
                <input type="date" className="input" value={lDate} onChange={(e) => setLDate(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>{t('amount')}</label>
                <input type="number" step="any" className="input" value={lAmount} onChange={(e) => setLAmount(e.target.value)} placeholder="+5000 / -1200" />
              </div>
              <div>
                <label style={labelStyle}>{t('narration')}</label>
                <input type="text" className="input" value={lNarr} onChange={(e) => setLNarr(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>{t('refNo')}</label>
                <input type="text" className="input" value={lRef} onChange={(e) => setLRef(e.target.value)} />
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button className="btn btn-primary" onClick={addSingle} disabled={adding}>{adding ? '…' : t('addLine')}</button>
              </div>
            </div>

            <div style={{ marginTop: 10 }}>
              <label style={labelStyle}>{t('bulkHint')}</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <textarea
                  className="input" rows={3} value={paste} onChange={(e) => setPaste(e.target.value)}
                  placeholder="2026-08-01,5000,Client payment,UTR-001&#10;2026-08-02,-1200,Travel,"
                  style={{ flex: 1, minWidth: 280, resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }}
                />
                <button className="btn" onClick={importBulk} disabled={adding || !paste.trim()}>{adding ? '…' : t('importLines')}</button>
              </div>
            </div>
          </Section>

          {/* Statement table */}
          <Section title={`🧾 ${t('stmtCount')}`}>
            {data.statements.length === 0 ? (
              <div style={{ color: 'var(--text3)', fontSize: 13, textAlign: 'center', padding: 20 }}>{t('noStmts')}</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border)' }}>
                      <th style={thStyle}>{t('stDate')}</th>
                      <th style={{ ...thStyle, textAlign: 'left' }}>{t('stNarr')}</th>
                      <th style={thStyle}>{t('stAmt')}</th>
                      <th style={thStyle}>{t('stStatus')}</th>
                      <th style={{ ...thStyle, textAlign: 'left' }}>{t('stAction')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.statements.map((s) => {
                      const cands = candMap[s.id] || [];
                      return (
                        <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{s.date}</td>
                          <td style={{ ...tdStyle, textAlign: 'left', maxWidth: 240 }}>
                            {s.narration || '—'}
                            {s.refNo && <div style={{ fontSize: 11, color: 'var(--text3)' }}>{s.refNo}</div>}
                          </td>
                          <td style={{ ...tdStyle, fontWeight: 600, color: s.amount >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmtAmt(s.amount)}</td>
                          <td style={tdStyle}>
                            {s.matchedEntryId ? (
                              <span className="badge badge-green">{t('matchedBadge')}</span>
                            ) : (
                              <span className="badge badge-amber">{t('unmatchedBadge')}</span>
                            )}
                          </td>
                          <td style={{ ...tdStyle, textAlign: 'left' }}>
                            {!s.matchedEntryId && cands.length > 0 ? (
                              <select className="input btn-sm" style={{ width: 'auto', maxWidth: 220 }}
                                value="" onChange={(e) => e.target.value && doMatch(s.id, e.target.value)}>
                                <option value="">{t('matchDrop')}</option>
                                {cands.map((c) => (
                                  <option key={c.entryId} value={c.entryId}>
                                    {c.date} · {c.type} · {(c.ref || c.entryId).slice(0, 30)}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span style={{ color: 'var(--text3)', fontSize: 12 }}>{t('noCand')}</span>
                            )}
                            {s.matchedEntryId && (
                              <button className="btn btn-ghost btn-sm" style={{ marginLeft: 6 }} onClick={() => doUnmatch(s.id)}>{t('unmatch')}</button>
                            )}
                            <button className="btn btn-ghost btn-sm" style={{ marginLeft: 6, color: 'var(--red)' }} onClick={() => doDelete(s)}>🗑</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          {/* Unmatched book entries */}
          <Section title={`📒 ${t('unmatchedBook')}`}>
            {unmatchedBook.length === 0 ? (
              <div style={{ color: 'var(--green)', fontSize: 13, textAlign: 'center', padding: 20 }}>{t('noBook')}</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border)' }}>
                      <th style={thStyle}>{t('bookDate')}</th>
                      <th style={{ ...thStyle, textAlign: 'left' }}>{t('bookType')}</th>
                      <th style={{ ...thStyle, textAlign: 'left' }}>{t('bookRef')}</th>
                      <th style={thStyle}>{t('bookAmt')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unmatchedBook.map((b) => (
                      <tr key={b.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{b.date}</td>
                        <td style={{ ...tdStyle, textAlign: 'left' }}>
                          <span style={{ display: 'inline-block', padding: '1px 6px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: 'var(--blue)', color: '#fff' }}>{b.type}</span>
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'left', fontSize: 12, color: 'var(--text2)' }}>{b.ref || b.id}</td>
                        <td style={{ ...tdStyle, fontWeight: 600, color: b.movement >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmtAmt(b.movement)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </>
      )}
    </div>
  );
}

const labelStyle = { display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--text2)', marginBottom: 4 };
const thStyle = { textAlign: 'right', padding: '6px 8px', color: 'var(--text3)', fontWeight: 500, fontSize: 12 };
const tdStyle = { padding: '6px 8px', textAlign: 'right', color: 'var(--text)' };
