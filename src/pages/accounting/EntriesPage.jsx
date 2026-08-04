/**
 * Journal / Vouchers — /accounting/entries. Lists the double-entry journal and
 * lets authorised users record manual vouchers (Journal, Payment, Receipt,
 * Contra) straight into the ledger. Manual vouchers carry ref.collection
 * 'manualEntries' and can be deleted here; entries auto-derived from invoices /
 * payments / expenses / purchase orders / stock are shown read-only — they can
 * only change by editing the source document.
 */
import { useEffect, useMemo, useState } from 'react';
import { ledgerApi } from '../../services/api';
import { useT } from '../../i18n/LanguageContext';
import { showToast } from '../../components/common/toast';
import { inr } from '../../components/common/DashboardCharts';
import BranchSelect from '../../components/common/BranchSelect';

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const S = {
  title:    { en: 'Journal / Vouchers', hi: 'जर्नल / वाउचर', hinglish: 'Journal / Vouchers' },
  newVoucher: { en: '+ New Voucher', hi: '+ नया वाउचर', hinglish: '+ Naya Voucher' },
  from:     { en: 'From', hi: 'से', hinglish: 'From' },
  to:       { en: 'To', hi: 'तक', hinglish: 'To' },
  account:  { en: 'Account', hi: 'खाता', hinglish: 'Account' },
  type:     { en: 'Type', hi: 'प्रकार', hinglish: 'Type' },
  allTypes: { en: 'All types', hi: 'सभी', hinglish: 'All' },
  allAccts: { en: 'All accounts', hi: 'सभी खाते', hinglish: 'All accounts' },
  date:     { en: 'Date', hi: 'दिनांक', hinglish: 'Date' },
  memo:     { en: 'Memo / Note', hi: 'नोट', hinglish: 'Memo' },
  debit:    { en: 'Debit', hi: 'डेबिट', hinglish: 'Debit' },
  credit:   { en: 'Credit', hi: 'क्रेडिट', hinglish: 'Credit' },
  manual:   { en: 'Manual', hi: 'मैनुअल', hinglish: 'Manual' },
  auto:     { en: 'Auto', hi: 'ऑटो', hinglish: 'Auto' },
  delete:   { en: 'Delete', hi: 'हटाएँ', hinglish: 'Delete' },
  confirmDel: { en: 'Delete this voucher? This removes its ledger effect.', hi: 'यह वाउचर हटाएँ?', hinglish: 'Yeh voucher delete karein?' },
  noLines:  { en: 'Add at least two lines to balance the voucher.', hinglish: 'Kam se kam do lines dalo.' },
  close:    { en: 'Close', hi: 'बंद करें', hinglish: 'Close' },
  save:     { en: 'Save voucher', hi: 'सहेजें', hinglish: 'Save' },
  addLine:  { en: '+ Add line', hi: '+ लाइन जोड़ें', hinglish: '+ Add line' },
  none:     { en: 'No journal entries match.', hi: 'कोई एंट्री नहीं।', hinglish: 'No entries.' },
  remove:   { en: 'Remove', hi: 'हटाएँ', hinglish: 'Remove' },
  failed:   { en: 'Failed', hi: 'नहीं हुआ', hinglish: 'Fail hua' },
  deleted:  { en: 'Voucher deleted', hi: 'वाउचर हटा दिया', hinglish: 'Voucher delete ho gaya' },
  saved:    { en: 'Voucher posted', hi: 'वाउचर पोस्ट', hinglish: 'Voucher posted' },
  selectAcct: { en: 'Select account…', hinglish: 'Account chuno…' },
  dr:       { en: 'Dr', hinglish: 'Dr' },
  cr:       { en: 'Cr', hinglish: 'Cr' },
  balance:  { en: 'Balance', hi: 'बैलेंस', hinglish: 'Balance' },
  balanced: { en: 'Balanced', hi: 'संतुलित', hinglish: 'Balanced' },
  unbalanced: { en: 'Not balanced', hi: 'असंतुलित', hinglish: 'Unbalanced' },
  opening:  { en: 'Opening', hinglish: 'Opening' },
  stock:    { en: 'Stock', hinglish: 'Stock' },
  purchase: { en: 'Purchase', hinglish: 'Purchase' },
  invoice:  { en: 'Invoice', hinglish: 'Invoice' },
  payment:  { en: 'Payment', hinglish: 'Payment' },
  receipt:  { en: 'Receipt', hinglish: 'Receipt' },
  journal:  { en: 'Journal', hinglish: 'Journal' },
  contra:   { en: 'Contra', hinglish: 'Contra' },
  expense:  { en: 'Expense', hinglish: 'Expense' },
};

const VOUCHER_TYPES = ['journal', 'payment', 'receipt', 'contra'];

// Default line template per voucher type — a sensible starting point the user
// can edit freely. payment = money going out, receipt = money coming in,
// contra = transfer between our own cash/bank.
const DEFAULT_LINES = {
  journal: [{ account: '', dr: '', cr: '' }, { account: '', dr: '', cr: '' }],
  payment: [{ account: '', dr: '', cr: '' }, { account: 'cash', dr: '', cr: '' }],
  receipt: [{ account: 'cash', dr: '', cr: '' }, { account: '', dr: '', cr: '' }],
  contra:  [{ account: 'bank', dr: '', cr: '' }, { account: 'cash', dr: '', cr: '' }],
};

const GROUP_LABEL = {
  asset: 'Assets', liability: 'Liabilities', equity: 'Equity', income: 'Income', expense: 'Expense',
};

const REF_LABEL = (c) => c === 'manualEntries' ? 'Manual' :
  c === 'invoices' ? 'Invoice' :
  c === 'payments' ? 'Payment' :
  c === 'expenses' ? 'Expense' :
  c === 'purchaseOrders' ? 'Purchase' :
  c === 'openingBalance' ? 'Opening' :
  c === 'stockMovements' ? 'Stock' : c;

const today = () => new Date().toISOString().slice(0, 10);

export default function EntriesPage() {
  const t = useT(S);
  const [entries, setEntries] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [acct, setAcct] = useState('');
  const [type, setType] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [pageSize, setPageSize] = useState(50);

  // Changing a filter resets to page 1 in the same event handler so React
  // batches both updates into a single render → one fetch, no stale-page race.
  const changeFrom = (v) => { setFrom(v); setPage(1); };
  const changeTo = (v) => { setTo(v); setPage(1); };
  const changeAcct = (v) => { setAcct(v); setPage(1); };

  const load = () => {
    ledgerApi.entries({
      from: from || undefined, to: to || undefined, account: acct || undefined,
      page, limit: pageSize,
    }).then((r) => {
      setEntries(r.entries || []);
      setTotal(r.total || 0);
      setHasMore(!!r.hasMore);
    }).catch(() => { setEntries([]); setTotal(0); setHasMore(false); });
    ledgerApi.accounts().then(setAccounts).catch(() => setAccounts([]));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [from, to, acct, page, pageSize]);

  const acctName = useMemo(() => {
    const m = {}; accounts.forEach((a) => { m[a.key] = a.name; });
    return m;
  }, [accounts]);

  const visible = useMemo(() => {
    if (!type) return entries;
    return entries.filter((e) => e.type === type);
  }, [entries, type]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4" style={{ flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>{t('title')}</h2>
        <button className="btn btn-primary btn-sm" onClick={() => setShowNew(true)}>{t('newVoucher')}</button>
      </div>

      <div className="flex gap-2 mb-4" style={{ alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div className="form-group" style={{ margin: 0 }}><label>{t('from')}</label><input className="input" type="date" value={from} onChange={(e) => changeFrom(e.target.value)} /></div>
        <div className="form-group" style={{ margin: 0 }}><label>{t('to')}</label><input className="input" type="date" value={to} onChange={(e) => changeTo(e.target.value)} /></div>
        <div className="form-group" style={{ margin: 0 }}>
          <label>{t('account')}</label>
          <select className="input" value={acct} onChange={(e) => changeAcct(e.target.value)}>
            <option value="">{t('allAccts')}</option>
            {accounts.map((a) => <option key={a.key} value={a.key}>{a.name}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label>{t('type')}</label>
          <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">{t('allTypes')}</option>
            {VOUCHER_TYPES.map((k) => <option key={k} value={k}>{t(k)}</option>)}
            <option value="purchase">{t('purchase')}</option>
            <option value="invoice">{t('invoice')}</option>
            <option value="expense">{t('expense')}</option>
            <option value="opening-balance">{t('opening')}</option>
          </select>
        </div>
      </div>

      {(total > 0 || hasMore) && (
        <div className="flex items-center justify-between" style={{ marginBottom: 12, gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>
            {total} {total === 1 ? 'entry' : 'entries'} · Page {Math.max(1, page)} / {Math.max(1, Math.ceil(total / pageSize))}
          </span>
          <div className="flex" style={{ gap: 6, alignItems: 'center' }}>
            <button className="btn btn-xs btn-ghost" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>← Prev</button>
            <select className="input" style={{ width: 84 }} value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <button className="btn btn-xs btn-ghost" disabled={!hasMore} onClick={() => setPage((p) => p + 1)}>Next →</button>
          </div>
        </div>
      )}

      {visible.length === 0 && <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>{t('none')}</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {visible.map((e) => {
          const manual = e.ref && e.ref.collection === 'manualEntries';
          const totalDr = round2((e.lines || []).reduce((s, l) => s + (l.dr || 0), 0));
          const totalCr = round2((e.lines || []).reduce((s, l) => s + (l.cr || 0), 0));
          return (
            <div key={e.id} className="card" style={{ padding: '12px 14px' }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
                <div className="flex" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, fontFamily: 'monospace', color: 'var(--text2)' }}>{e.date}</span>
                  <span className="badge badge-blue" style={{ textTransform: 'uppercase' }}>{t(e.type) || e.type}</span>
                  <span className="badge" style={{ background: manual ? 'var(--green, #1F9D55)' : 'var(--surface2)', color: manual ? '#fff' : 'var(--text3)', textTransform: 'uppercase' }}>
                    {manual ? t('manual') : t('auto')}
                  </span>
                  {e.meta && e.meta.memo && <span style={{ fontSize: 12, color: 'var(--text2)' }}>{e.meta.memo}</span>}
                </div>
                <div className="flex" style={{ gap: 10, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--text3)' }}>Dr {inr(totalDr)} = Cr {inr(totalCr)}</span>
                  {manual && (
                    <button className="btn btn-xs btn-ghost" style={{ color: 'var(--red)' }} onClick={async () => {
                      if (!window.confirm(t('confirmDel'))) return;
                      try { await ledgerApi.deleteEntry(e.id); showToast('✅ ' + t('deleted'), 'success'); load(); }
                      catch (err) { showToast(err.response?.data?.error || t('failed'), 'error'); }
                    }}>{t('delete')}</button>
                  )}
                </div>
              </div>
              <div style={{ overflow: 'auto' }}>
                <table className="table table-sm" style={{ margin: 0, minWidth: 420 }}>
                  <thead>
                    <tr>
                      <th>{t('account')}</th>
                      <th style={{ textAlign: 'right' }}>{t('debit')}</th>
                      <th style={{ textAlign: 'right' }}>{t('credit')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(e.lines || []).map((l, i) => (
                      <tr key={i}>
                        <td>
                          <span style={{ fontWeight: 500 }}>{acctName[l.account] || l.account}</span>
                          <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'monospace', marginLeft: 6 }}>{l.account}</span>
                        </td>
                        <td style={{ textAlign: 'right' }}>{l.dr ? inr(l.dr) : ''}</td>
                        <td style={{ textAlign: 'right', color: 'var(--green)' }}>{l.cr ? inr(l.cr) : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>

      {showNew && <VoucherModal t={t} accounts={accounts} onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); load(); }} />}
    </div>
  );
}

function VoucherModal({ t, accounts, onClose, onSaved }) {
  const [type, setType] = useState('journal');
  const [date, setDate] = useState(today());
  const [memo, setMemo] = useState('');
  const [branchId, setBranchId] = useState('');
  const [rows, setRows] = useState(() => DEFAULT_LINES.journal.map((l) => ({ ...l })));
  const [saving, setSaving] = useState(false);

  const pickType = (k) => { setType(k); setRows(DEFAULT_LINES[k].map((l) => ({ ...l }))); };

  const setRow = (i, patch) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const parse = (v) => { const n = round2(Number(v) || 0); return n === 0 ? '' : String(n); };

  const lines = rows.map((r) => ({ account: r.account, dr: round2(Number(r.dr) || 0), cr: round2(Number(r.cr) || 0) }));
  const totalDr = round2(lines.reduce((s, l) => s + l.dr, 0));
  const totalCr = round2(lines.reduce((s, l) => s + l.cr, 0));
  const nonZero = lines.filter((l) => l.dr > 0 || l.cr > 0);
  const balanced = nonZero.length >= 2 && totalDr === totalCr;
  const dirty = rows.some((r) => r.account || Number(r.dr) || Number(r.cr));

  const save = async () => {
    if (!balanced) { showToast(t('noLines'), 'error'); return; }
    setSaving(true);
    try {
      await ledgerApi.entry({
        date, type,
        branchId: branchId || undefined,
        memo: memo.trim() || undefined,
        lines: nonZero.map((l) => ({ account: l.account, dr: l.dr, cr: l.cr })),
      });
      showToast('✅ ' + t('saved'), 'success');
      onSaved();
    } catch (e) {
      showToast(e.response?.data?.error || t('failed'), 'error');
      setSaving(false);
    }
  };

  // Optgroups: assets / liabilities / equity / income / expense.
  const groups = ['asset', 'liability', 'equity', 'income', 'expense']
    .map((g) => ({ g, items: accounts.filter((a) => a.group === g).sort((a, b) => a.name.localeCompare(b.name)) }))
    .filter((x) => x.items.length);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div className="card" style={{ maxWidth: 640, width: '100%', maxHeight: '88vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
          <h3 style={{ fontSize: 17, fontWeight: 700 }}>{t('newVoucher')}</h3>
          <button className="btn btn-sm btn-ghost" onClick={onClose}>{t('close')}</button>
        </div>

        <div className="flex" style={{ gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
          {VOUCHER_TYPES.map((k) => (
            <button key={k} type="button" className="btn btn-xs" onClick={() => pickType(k)}
              style={{ background: type === k ? 'var(--blue, #C05621)' : 'var(--surface2)', color: type === k ? '#fff' : 'var(--text2)', border: 'none', borderRadius: 14 }}>
              {t(k)}
            </button>
          ))}
        </div>

        <div className="flex gap-2" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
          <div className="form-group" style={{ margin: 0 }}><label>{t('date')}</label><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="form-group" style={{ margin: 0 }}><label>Branch</label><BranchSelect value={branchId} onChange={setBranchId} style={{ width: 150 }} /></div>
          <div className="form-group" style={{ margin: 0, flex: 1, minWidth: 200 }}><label>{t('memo')}</label><input className="input" value={memo} placeholder={t('memo')} onChange={(e) => setMemo(e.target.value)} /></div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px 32px', gap: 8, padding: '8px 10px', fontSize: 11, textTransform: 'uppercase', color: 'var(--text3)', fontWeight: 700, borderBottom: '1px solid var(--border)' }}>
          <div>{t('account')}</div><div style={{ textAlign: 'right' }}>{t('dr')}</div><div style={{ textAlign: 'right' }}>{t('cr')}</div><div />
        </div>
        {rows.map((r, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px 32px', gap: 8, padding: '6px 10px', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
            <select className="input" value={r.account} onChange={(e) => setRow(i, { account: e.target.value })}>
              <option value="">{t('selectAcct')}</option>
              {groups.map(({ g, items }) => (
                <optgroup key={g} label={GROUP_LABEL[g]}>
                  {items.map((a) => <option key={a.key} value={a.key}>{a.name}</option>)}
                </optgroup>
              ))}
            </select>
            <input className="input" type="number" placeholder="0" value={r.dr} onChange={(e) => setRow(i, { dr: parse(e.target.value) })} />
            <input className="input" type="number" placeholder="0" value={r.cr} onChange={(e) => setRow(i, { cr: parse(e.target.value) })} />
            <button type="button" className="btn btn-xs btn-ghost" style={{ color: 'var(--red)' }} disabled={rows.length <= 2} onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>{t('remove')}</button>
          </div>
        ))}
        <div style={{ padding: '8px 10px' }}>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => setRows((rs) => [...rs, { account: '', dr: '', cr: '' }])}>{t('addLine')}</button>
        </div>

        <div className="flex items-center justify-between" style={{ padding: '10px 12px', borderTop: '1px solid var(--border)', marginTop: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: balanced ? 'var(--green)' : 'var(--red)' }}>
            {t('balance')}: {inr(totalDr)} {balanced ? '✓ ' + t('balanced') : '≠ ' + t('unbalanced')}
          </span>
          <div className="flex" style={{ gap: 6 }}>
            <button className="btn btn-sm btn-ghost" onClick={onClose}>{t('close')}</button>
            <button className="btn btn-sm btn-primary" disabled={!dirty || !balanced || saving} onClick={save}>{saving ? '…' : t('save')}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
