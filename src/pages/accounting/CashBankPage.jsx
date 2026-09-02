/**
 * Cash & Bank — the account list on the left, the selected account's passbook
 * on the right.
 *
 * Each named bank account is a real ledger account (`bank:<id>`), so every
 * balance here is derived from the same journal the Balance Sheet reads — there
 * is no second set of numbers to drift.
 *
 * Three kinds of row appear, and the difference is the point:
 *   Cash in hand          — the drawer. Always present.
 *   a named bank account  — user-created, editable, has a statement.
 *   Unlinked Transactions — read-only. Bank money recorded before accounts
 *                           existed, whose account was never captured. Shown
 *                           rather than hidden, because that money did move;
 *                           attributing it now would be inventing bank records.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { accountingApi, describeError } from '../../services/api';
import { useT } from '../../i18n/LanguageContext';
import { showToast } from '../../components/common/toast';
import { inr } from '../../components/common/DashboardCharts';
import { invalidateFundingAccounts } from '../../components/common/BankAccountSelect';

const round2 = (n) => Math.round(((Number(n) || 0) * 100) + 1e-8) / 100;
const todayStr = () => new Date().toISOString().slice(0, 10);

const S = {
  title: { en: 'Cash and Bank', hi: 'नकदी और बैंक', hinglish: 'Cash and Bank' },
};

const RANGES = [
  { key: '30', label: 'Last 30 Days' },
  { key: '90', label: 'Last 90 Days' },
  { key: 'fy', label: 'This Financial Year' },
  { key: 'all', label: 'All Time' },
];

function rangeDates(key) {
  if (key === 'all') return {};
  const to = todayStr();
  if (key === 'fy') {
    const d = new Date();
    // Indian FY runs 1 April – 31 March.
    const y = d.getMonth() + 1 >= 4 ? d.getFullYear() : d.getFullYear() - 1;
    return { from: `${y}-04-01`, to };
  }
  const d = new Date();
  d.setDate(d.getDate() - Number(key));
  return { from: d.toISOString().slice(0, 10), to };
}

// Journal `type` → what a shopkeeper calls it.
const TYPE_LABEL = {
  payment: 'Payment In',
  'payment-out': 'Payment Out',
  invoice: 'Sales Invoice',
  purchase: 'Purchase',
  expense: 'Expense',
  transfer: 'Transfer',
  'adjust-in': 'Money Added',
  'adjust-out': 'Money Reduced',
  opening: 'Opening Balance',
  tds: 'TDS',
  voucher: 'Voucher',
};
const typeLabel = (t) => TYPE_LABEL[t] || String(t || '').replace(/-/g, ' ');

const ICONS = { cash: '💵', bank: '🏦', unlinked: '🏛' };

export default function CashBankPage() {
  const t = useT(S);
  const [accounts, setAccounts] = useState([]);
  const [totalBalance, setTotalBalance] = useState(0);
  const [selectedId, setSelectedId] = useState('cash');
  const [range, setRange] = useState('30');
  const [statement, setStatement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const [dialog, setDialog] = useState(null); // 'account' | 'transfer' | 'adjust'
  const [editing, setEditing] = useState(null);

  const loadAccounts = useCallback(async () => {
    try {
      const r = await accountingApi.bankAccounts();
      setAccounts(r.accounts || []);
      setTotalBalance(r.totalBalance || 0);
      invalidateFundingAccounts();
      setErr('');
    } catch (e) {
      setErr(describeError(e, 'Could not load accounts'));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadAccounts(); }, [loadAccounts]);

  const selected = useMemo(
    () => accounts.find((a) => String(a.id) === String(selectedId)) || null,
    [accounts, selectedId],
  );

  const loadStatement = useCallback(async () => {
    if (!selectedId) return;
    setStatement(null);
    try {
      setStatement(await accountingApi.bankTransactions(selectedId, rangeDates(range)));
    } catch (e) {
      setStatement({ rows: [], error: describeError(e, 'Could not load transactions') });
    }
  }, [selectedId, range]);

  useEffect(() => { loadStatement(); }, [loadStatement]);

  const refreshAll = () => { loadAccounts(); loadStatement(); };

  const banks = accounts.filter((a) => a.type !== 'cash');
  const cashRows = accounts.filter((a) => a.type === 'cash');

  const copyDetails = () => {
    if (!selected) return;
    const lines = [
      selected.accountHolderName && `Account Holder: ${selected.accountHolderName}`,
      selected.accountNumber && `Account Number: ${selected.accountNumber}`,
      selected.ifsc && `IFSC: ${selected.ifsc}`,
      selected.upi && `UPI: ${selected.upi}`,
      selected.bankName && `Bank: ${selected.bankName}${selected.branch ? `, ${selected.branch}` : ''}`,
    ].filter(Boolean).join('\n');
    if (!lines) { showToast('No bank details saved yet', 'error'); return; }
    navigator.clipboard?.writeText(lines)
      .then(() => showToast('Bank details copied', 'success'))
      .catch(() => showToast('Could not copy', 'error'));
  };

  const downloadStatement = () => {
    if (!statement || !statement.rows.length) { showToast('Nothing to download', 'error'); return; }
    const head = ['Date', 'Type', 'Txn No', 'Party', 'Mode', 'Paid', 'Received', 'Balance'];
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [head.join(','), ...statement.rows.map((r) => [
      r.date, typeLabel(r.type), r.txnNo || '', r.party || '', r.mode || '',
      r.paid || 0, r.received || 0, r.balance,
    ].map(esc).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${(selected?.name || 'statement').replace(/[^\w-]+/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const removeAccount = async (acc) => {
    if (!window.confirm(`Remove "${acc.name}"?\n\nIf it has transactions it is archived, not deleted — its statement is kept.`)) return;
    try {
      const r = await accountingApi.deleteBankAccount(acc.id);
      showToast(r.archived ? 'Account archived — its statement is preserved' : 'Account removed', 'success');
      if (String(selectedId) === String(acc.id)) setSelectedId('cash');
      refreshAll();
    } catch (e) { showToast(describeError(e, 'Could not remove'), 'error'); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4" style={{ flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>{t('title')}</h2>
        <div className="flex" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-sm btn-ghost" onClick={() => setDialog('adjust')}>＋ Add/Reduce Money</button>
          <button className="btn btn-sm btn-ghost" onClick={() => setDialog('transfer')}>⇄ Transfer Money</button>
          <button className="btn btn-sm btn-primary" onClick={() => { setEditing(null); setDialog('account'); }}>+ Add New Account</button>
        </div>
      </div>

      {err && <div className="card" style={{ padding: 12, color: 'var(--red)', marginBottom: 12 }}>{err}</div>}

      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* ── LEFT: account list ── */}
        <div className="card" style={{ flex: '0 1 340px', minWidth: 280, padding: 0, overflow: 'hidden' }}>
          <div className="flex items-center justify-between" style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: 13, color: 'var(--text2)' }}>Total Balance:</span>
            <span style={{ fontSize: 17, fontWeight: 800 }}>{inr(totalBalance)}</span>
          </div>

          <SectionHead>Cash</SectionHead>
          {cashRows.map((a) => (
            <AccountRow key={a.id} acc={a} active={String(selectedId) === String(a.id)} onClick={() => setSelectedId(a.id)} />
          ))}

          <div className="flex items-center justify-between" style={{ padding: '10px 16px 6px', borderTop: '1px solid var(--border)' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase' }}>Bank Accounts</span>
            <button className="btn btn-xs btn-ghost" onClick={() => { setEditing(null); setDialog('account'); }}>+ Add New Bank</button>
          </div>
          {banks.map((a) => (
            <AccountRow key={a.id} acc={a} active={String(selectedId) === String(a.id)} onClick={() => setSelectedId(a.id)} />
          ))}
          {loading && <div style={{ padding: 20, color: 'var(--text3)', fontSize: 13 }}>Loading…</div>}
        </div>

        {/* ── RIGHT: details + statement ── */}
        <div className="card" style={{ flex: '1 1 560px', minWidth: 320, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 14 }}>
            Transactions
          </div>

          {selected && (
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 340px', minWidth: 260 }}>
                {selected.type === 'bank' ? (
                  <>
                    <Detail label="Account Holder's Name" value={selected.accountHolderName} />
                    <Detail label="Account Name" value={selected.accountName || selected.name} />
                    <Detail label="Account Number" value={selected.accountNumber} />
                    <Detail label="IFSC Code" value={selected.ifsc} />
                    <Detail label="UPI" value={selected.upi} />
                    <Detail label="Bank & Branch" value={[selected.bankName, selected.branch].filter(Boolean).join(', ')} />
                  </>
                ) : (
                  <div style={{ fontSize: 13, color: 'var(--text2)' }}>
                    <b style={{ display: 'block', fontSize: 15, color: 'var(--text)' }}>{selected.name}</b>
                    {selected.hint || (selected.type === 'cash' ? 'Notes and coins on the premises.' : '')}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 180 }}>
                {selected.type === 'bank' && (
                  <>
                    <button className="btn btn-sm btn-ghost" onClick={() => { setEditing(selected); setDialog('account'); }}>Update Bank Details ✏️</button>
                    <button className="btn btn-sm btn-ghost" onClick={copyDetails}>Share Bank Details 🔗</button>
                  </>
                )}
                <button className="btn btn-sm btn-ghost" onClick={downloadStatement}>Download Statement ⬇️</button>
                {selected.deletable && (
                  <button className="btn btn-sm btn-ghost" style={{ color: 'var(--red)' }} onClick={() => removeAccount(selected)}>Remove Account</button>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between" style={{ padding: '10px 16px', gap: 8, flexWrap: 'wrap' }}>
            <select
              className="input"
              style={{ width: 'auto', minWidth: 190 }}
              value={range}
              onChange={(e) => setRange(e.target.value)}
            >
              {RANGES.map((r) => <option key={r.key} value={r.key}>📅 {r.label}</option>)}
            </select>
            {statement && (
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>
                Opening {inr(statement.opening || 0)} · Closing <b style={{ color: 'var(--text)' }}>{inr(statement.closing || 0)}</b>
              </span>
            )}
          </div>

          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: 720 }}>
              <StatementHeader />
              {!statement && <Empty>Loading…</Empty>}
              {statement && statement.error && <Empty color="var(--red)">{statement.error}</Empty>}
              {statement && !statement.error && !statement.rows.length && (
                <Empty>No transactions in this period.</Empty>
              )}
              {statement && statement.rows.map((r) => (
                <div key={r.id} style={ROW}>
                  <div style={{ color: 'var(--text2)' }}>{r.date}</div>
                  <div style={{ fontWeight: 600 }}>{typeLabel(r.type)}</div>
                  <div style={{ fontFamily: 'monospace', fontSize: 11.5, color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {r.txnNo || '—'}
                  </div>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.party || r.memo || '—'}
                  </div>
                  <div style={{ color: 'var(--text2)' }}>{r.mode || '—'}</div>
                  <div style={{ textAlign: 'right', color: r.paid ? 'var(--red, #DC2626)' : 'var(--text3)' }}>
                    {r.paid ? inr(r.paid) : '-'}
                  </div>
                  <div style={{ textAlign: 'right', color: r.received ? 'var(--green, #059669)' : 'var(--text3)' }}>
                    {r.received ? inr(r.received) : '-'}
                  </div>
                  <div style={{ textAlign: 'right', fontWeight: 700 }}>{inr(r.balance)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {dialog === 'account' && (
        <AccountDialog
          account={editing}
          onClose={() => { setDialog(null); setEditing(null); }}
          onSaved={() => { setDialog(null); setEditing(null); refreshAll(); }}
        />
      )}
      {dialog === 'transfer' && (
        <TransferDialog accounts={accounts} onClose={() => setDialog(null)} onSaved={() => { setDialog(null); refreshAll(); }} />
      )}
      {dialog === 'adjust' && (
        <AdjustDialog accounts={accounts} initialId={selectedId} onClose={() => setDialog(null)} onSaved={() => { setDialog(null); refreshAll(); }} />
      )}
    </div>
  );
}

const COLS = '92px 110px 110px 1fr 92px 96px 96px 104px';
const ROW = {
  display: 'grid', gridTemplateColumns: COLS, gap: 8, padding: '10px 16px',
  borderTop: '1px solid var(--border)', fontSize: 12.5, alignItems: 'center',
};

function StatementHeader() {
  return (
    <div style={{ ...ROW, borderTop: '1px solid var(--border)', background: 'var(--surface2)', fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text3)' }}>
      <div>Date</div><div>Type</div><div>Txn No</div><div>Party</div><div>Mode</div>
      <div style={{ textAlign: 'right' }}>Paid</div>
      <div style={{ textAlign: 'right' }}>Received</div>
      <div style={{ textAlign: 'right' }}>Balance</div>
    </div>
  );
}

const Empty = ({ children, color }) => (
  <div style={{ padding: 34, textAlign: 'center', color: color || 'var(--text3)', fontSize: 13, borderTop: '1px solid var(--border)' }}>{children}</div>
);

const SectionHead = ({ children }) => (
  <div style={{ padding: '10px 16px 4px', fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', borderTop: '1px solid var(--border)' }}>
    {children}
  </div>
);

function Detail({ label, value }) {
  return (
    <div style={{ display: 'flex', gap: 8, fontSize: 12.5, padding: '2px 0' }}>
      <span style={{ color: 'var(--text3)', width: 150, flexShrink: 0 }}>{label}</span>
      <span style={{ color: 'var(--text3)' }}>:</span>
      <span style={{ fontWeight: 500, wordBreak: 'break-word' }}>{value || '—'}</span>
    </div>
  );
}

function AccountRow({ acc, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
        padding: '12px 16px', border: 'none', cursor: 'pointer', fontSize: 13,
        background: active ? 'var(--surface2)' : 'transparent',
        borderLeft: `3px solid ${active ? 'var(--primary, #2563EB)' : 'transparent'}`,
        color: 'var(--text)',
      }}
    >
      <span style={{ fontSize: 18 }}>{ICONS[acc.type] || '🏦'}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {acc.name}
        </span>
        {acc.accountNumber && (
          <span style={{ display: 'block', fontSize: 11, color: 'var(--text3)' }}>{acc.accountNumber}</span>
        )}
      </span>
      <span style={{ fontWeight: 700 }}>{inr(acc.balance)}</span>
    </button>
  );
}

/* ─────────────────────────────── Dialogs ─────────────────────────────── */

function Modal({ title, children, onClose, footer, width = 460 }) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 250, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="card" style={{ width: '100%', maxWidth: width, maxHeight: '90vh', overflow: 'auto', padding: 18 }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{title}</h3>
          <button type="button" className="btn btn-xs btn-ghost" onClick={onClose}>✕</button>
        </div>
        {children}
        <div className="flex" style={{ gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>{footer}</div>
      </div>
    </div>
  );
}

function AccountDialog({ account, onClose, onSaved }) {
  const isEdit = !!account;
  const [f, setF] = useState({
    name: account?.name || '',
    accountHolderName: account?.accountHolderName || '',
    accountName: account?.accountName || '',
    accountNumber: account?.accountNumber || '',
    ifsc: account?.ifsc || '',
    upi: account?.upi || '',
    bankName: account?.bankName || '',
    branch: account?.branch || '',
    openingBalance: '',
  });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!String(f.name).trim()) { showToast('Account name is required', 'error'); return; }
    setBusy(true);
    try {
      if (isEdit) {
        const { openingBalance, ...rest } = f;
        await accountingApi.updateBankAccount(account.id, rest);
        showToast('Bank details updated', 'success');
      } else {
        await accountingApi.createBankAccount({ ...f, openingBalance: Number(f.openingBalance) || 0 });
        showToast('Account added', 'success');
      }
      onSaved();
    } catch (e) {
      showToast(describeError(e, 'Could not save'), 'error');
    } finally { setBusy(false); }
  };

  return (
    <Modal
      title={isEdit ? 'Update Bank Details' : 'Add New Account'}
      onClose={onClose}
      width={520}
      footer={<>
        <button className="btn btn-sm btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="btn btn-sm btn-primary" onClick={save} disabled={busy}>{busy ? '…' : 'Save'}</button>
      </>}
    >
      <div className="form-group">
        <label>Account Name *</label>
        <input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. IDFC Current" autoFocus />
      </div>
      <div className="flex gap-2">
        <div className="form-group" style={{ flex: 1 }}>
          <label>Account Holder's Name</label>
          <input className="input" value={f.accountHolderName} onChange={(e) => set('accountHolderName', e.target.value)} />
        </div>
        <div className="form-group" style={{ flex: 1 }}>
          <label>Account Number</label>
          <input className="input" value={f.accountNumber} onChange={(e) => set('accountNumber', e.target.value)} />
        </div>
      </div>
      <div className="flex gap-2">
        <div className="form-group" style={{ flex: 1 }}>
          <label>IFSC Code</label>
          <input className="input" value={f.ifsc} onChange={(e) => set('ifsc', e.target.value.toUpperCase())} />
        </div>
        <div className="form-group" style={{ flex: 1 }}>
          <label>UPI</label>
          <input className="input" value={f.upi} onChange={(e) => set('upi', e.target.value)} />
        </div>
      </div>
      <div className="flex gap-2">
        <div className="form-group" style={{ flex: 1 }}>
          <label>Bank Name</label>
          <input className="input" value={f.bankName} onChange={(e) => set('bankName', e.target.value)} />
        </div>
        <div className="form-group" style={{ flex: 1 }}>
          <label>Branch</label>
          <input className="input" value={f.branch} onChange={(e) => set('branch', e.target.value)} />
        </div>
      </div>
      {!isEdit ? (
        <div className="form-group">
          <label>Opening Balance</label>
          <input className="input input-num" type="number" value={f.openingBalance} onChange={(e) => set('openingBalance', e.target.value)} placeholder="0" />
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>
            What is in the account today. Posted against Opening Balance so the books stay balanced.
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>
          The opening balance isn't editable — it has a ledger entry behind it. To correct a
          balance use <b>Add/Reduce Money</b>, which leaves a dated trail.
        </div>
      )}
    </Modal>
  );
}

function TransferDialog({ accounts, onClose, onSaved }) {
  const usable = accounts.filter((a) => a.type !== 'unlinked');
  const [f, setF] = useState({ fromId: usable[0]?.id || '', toId: usable[1]?.id || '', amount: '', date: todayStr(), memo: '' });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!(Number(f.amount) > 0)) { showToast('Enter an amount', 'error'); return; }
    if (f.fromId === f.toId) { showToast('Choose two different accounts', 'error'); return; }
    setBusy(true);
    try {
      await accountingApi.bankTransfer({ ...f, amount: Number(f.amount) });
      showToast('Transfer recorded', 'success');
      onSaved();
    } catch (e) { showToast(describeError(e, 'Could not transfer'), 'error'); }
    finally { setBusy(false); }
  };

  const opts = (sel) => usable.map((a) => <option key={a.id} value={a.id}>{a.name} ({inr(a.balance)})</option>);

  return (
    <Modal
      title="Transfer Money"
      onClose={onClose}
      footer={<>
        <button className="btn btn-sm btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="btn btn-sm btn-primary" onClick={save} disabled={busy}>{busy ? '…' : 'Transfer'}</button>
      </>}
    >
      <div className="flex gap-2">
        <div className="form-group" style={{ flex: 1 }}>
          <label>From</label>
          <select className="input" value={f.fromId} onChange={(e) => set('fromId', e.target.value)}>{opts()}</select>
        </div>
        <div className="form-group" style={{ flex: 1 }}>
          <label>To</label>
          <select className="input" value={f.toId} onChange={(e) => set('toId', e.target.value)}>{opts()}</select>
        </div>
      </div>
      <div className="flex gap-2">
        <div className="form-group" style={{ flex: 1 }}>
          <label>Amount</label>
          <input className="input input-num" type="number" value={f.amount} onChange={(e) => set('amount', e.target.value)} autoFocus />
        </div>
        <div className="form-group" style={{ flex: 1 }}>
          <label>Date</label>
          <input className="input" type="date" value={f.date} onChange={(e) => set('date', e.target.value)} />
        </div>
      </div>
      <div className="form-group">
        <label>Note (optional)</label>
        <input className="input" value={f.memo} onChange={(e) => set('memo', e.target.value)} placeholder="e.g. Cash deposited" />
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>
        Moving your own money between your own accounts. It is not income or expense, so it
        changes neither the P&amp;L nor your total balance.
      </div>
    </Modal>
  );
}

function AdjustDialog({ accounts, initialId, onClose, onSaved }) {
  const usable = accounts.filter((a) => a.type !== 'unlinked');
  const [f, setF] = useState({
    accountId: usable.some((a) => String(a.id) === String(initialId)) ? initialId : (usable[0]?.id || ''),
    direction: 'add', amount: '', date: todayStr(), reason: '',
  });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!(Number(f.amount) > 0)) { showToast('Enter an amount', 'error'); return; }
    setBusy(true);
    try {
      await accountingApi.bankAdjust({ ...f, amount: Number(f.amount) });
      showToast(f.direction === 'add' ? 'Money added' : 'Money reduced', 'success');
      onSaved();
    } catch (e) { showToast(describeError(e, 'Could not adjust'), 'error'); }
    finally { setBusy(false); }
  };

  return (
    <Modal
      title="Add / Reduce Money"
      onClose={onClose}
      footer={<>
        <button className="btn btn-sm btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="btn btn-sm btn-primary" onClick={save} disabled={busy}>{busy ? '…' : 'Save'}</button>
      </>}
    >
      <div className="form-group">
        <label>Account</label>
        <select className="input" value={f.accountId} onChange={(e) => set('accountId', e.target.value)}>
          {usable.map((a) => <option key={a.id} value={a.id}>{a.name} ({inr(a.balance)})</option>)}
        </select>
      </div>
      <div className="flex gap-2">
        <div className="form-group" style={{ flex: 1 }}>
          <label>Action</label>
          <select className="input" value={f.direction} onChange={(e) => set('direction', e.target.value)}>
            <option value="add">Add money</option>
            <option value="reduce">Reduce money</option>
          </select>
        </div>
        <div className="form-group" style={{ flex: 1 }}>
          <label>Amount</label>
          <input className="input input-num" type="number" value={f.amount} onChange={(e) => set('amount', e.target.value)} autoFocus />
        </div>
        <div className="form-group" style={{ flex: 1 }}>
          <label>Date</label>
          <input className="input" type="date" value={f.date} onChange={(e) => set('date', e.target.value)} />
        </div>
      </div>
      <div className="form-group">
        <label>Reason</label>
        <input className="input" value={f.reason} onChange={(e) => set('reason', e.target.value)} placeholder="e.g. Owner cash introduced" />
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>
        An adjustment still has to land somewhere — an asset cannot change on its own.
        Adding is booked to <b>Owner&apos;s Capital</b>, reducing to <b>Expenses</b>.
      </div>
    </Modal>
  );
}
