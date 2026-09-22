/**
 * Purchases — /accounting/purchases. Supplier bills, laid out like Sales
 * Invoices on purpose: same KPIs-then-chips-then-cards shape, same View / Edit /
 * Record payment actions, so moving between the two is not a context switch.
 *
 * Recording a bill posts to the ledger immediately — Dr Inventory + input GST,
 * Cr the supplier — and RECEIVES its goods: every line linked to a catalog item
 * adds its quantity to stock and blends its cost into the moving average.
 *
 * The KPIs are derived from the bills themselves, the way the Sales ones are.
 * They used to read the `purchases` ledger account — which purchase bills never
 * post to (they debit Inventory) — so "Purchases" showed ₹0 beside ₹96 lakh of
 * bills.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ref, onValue, db } from '../../services/realtime';
import { dbApi, ledgerApi, accountingApi, describeError } from '../../services/api';
import { useT } from '../../i18n/LanguageContext';
import { showToast } from '../../components/common/toast';
import { Kpi, KpiGrid, inr } from '../../components/common/DashboardCharts';
import CreatePurchaseFlow from '../../components/common/CreatePurchaseFlow';
import PurchaseBulkUpload from '../../components/common/PurchaseBulkUpload';
import BankAccountSelect from '../../components/common/BankAccountSelect';

const round2 = (n) => Math.round(((Number(n) || 0) * 100) + 1e-8) / 100;
const todayStr = () => new Date().toISOString().slice(0, 10);

const S = {
  title:     { en: 'Purchases', hi: 'खरीद', hinglish: 'Purchases' },
  newInvoice: { en: '+ New Purchase Invoice', hi: '+ नई खरीद इनवॉइस', hinglish: '+ Naya Purchase Invoice' },
  purchases: { en: 'Purchases', hi: 'खरीद', hinglish: 'Purchases' },
  payable:   { en: 'Payable', hi: 'देय', hinglish: 'Payable' },
  overdue:   { en: 'Overdue', hi: 'अतिदेय', hinglish: 'Overdue' },
  all:       { en: 'All', hi: 'सभी', hinglish: 'All' },
  unpaid:    { en: 'Unpaid', hi: 'बकाया', hinglish: 'Unpaid' },
  partial:   { en: 'Partial', hi: 'आंशिक', hinglish: 'Partial' },
  paid:      { en: 'Paid', hi: 'पेड', hinglish: 'Paid' },
  orders:    { en: 'Orders', hi: 'ऑर्डर', hinglish: 'Orders' },
  draft:     { en: 'Draft', hi: 'ड्राफ्ट', hinglish: 'Draft' },
  sent:      { en: 'Sent', hi: 'भेजा', hinglish: 'Sent' },
  cancelled: { en: 'Cancelled', hi: 'रद्द', hinglish: 'Cancelled' },
  none:      { en: 'No purchase invoices yet.', hi: 'अभी कोई खरीद नहीं।', hinglish: 'Abhi koi purchase nahi.' },
  noMatch:   { en: 'Nothing matches this filter.', hi: 'कुछ नहीं मिला।', hinglish: 'Kuch nahi mila.' },
  search:    { en: 'Search bill no / supplier…', hi: 'खोजें…', hinglish: 'Search bill…' },
  taxable:   { en: 'Taxable', hi: 'कर योग्य', hinglish: 'Taxable' },
  view:      { en: 'View', hi: 'देखें', hinglish: 'View' },
  edit:      { en: 'Edit', hi: 'बदलें', hinglish: 'Edit' },
  pay:       { en: 'Record payment', hi: 'भुगतान दर्ज करें', hinglish: 'Payment record karein' },
  markReceived: { en: 'Mark received', hi: 'प्राप्त किया', hinglish: 'Mark received' },
  delete:    { en: 'Delete', hi: 'हटाएँ', hinglish: 'Delete' },
  confirmDel: {
    en: 'Delete this purchase? Its ledger entry and the stock it brought in will be removed too.',
    hi: 'यह खरीद हटाएँ? इसकी लेजर एंट्री और स्टॉक भी हटेगा।',
    hinglish: 'Yeh purchase delete karein? Ledger entry aur stock bhi hatega.',
  },
  failed:    { en: 'Failed', hi: 'नहीं हुआ', hinglish: 'Fail hua' },
};

const PAY_MODES = ['Bank Transfer', 'UPI', 'Cash', 'Cheque', 'Card'];

// Where a purchase stands. A bill's payment progress lives in `paidAmount`; its
// `status` is the ORDER lifecycle (draft → sent → received), so an unreceived
// document reports that stage instead — it is not a debt yet.
export function purchaseStanding(p) {
  const st = String((p && p.status) || 'draft').toLowerCase();
  if (st !== 'received') return st;
  const total = round2(p.total || 0);
  const paid = round2(p.paidAmount || 0);
  if (total > 0 && paid >= total) return 'paid';
  if (paid > 0) return 'partial';
  return 'unpaid';
}

const TONE = {
  paid: 'badge-green', partial: 'badge-amber', unpaid: 'badge-red',
  draft: '', sent: 'badge-blue', cancelled: '',
};

export default function PurchasesPage() {
  const t = useT(S);
  const [pos, setPos] = useState({});
  const [accounts, setAccounts] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(null);
  const [paying, setPaying] = useState(null);

  // Deep link: /accounting/purchases?open=<id> highlights that bill and scrolls
  // to it. The full document lives at /purchase-view; this is for any link that
  // wants the bill in the context of the list around it.
  const [params] = useSearchParams();
  const urlOpen = params.get('open');
  const cardRefs = useRef({});
  const appliedDeepLink = useRef(null);

  useEffect(() => {
    const off = onValue(ref(db, 'mpw/purchaseOrders'), (s) => setPos(s.val() || {}));
    ledgerApi.accounts().then(setAccounts).catch(() => setAccounts([]));
    return off;
  }, []);

  useEffect(() => {
    if (!urlOpen || appliedDeepLink.current === urlOpen) return;
    if (!pos || !pos[urlOpen]) return;
    appliedDeepLink.current = urlOpen;
    setTimeout(() => {
      const el = cardRefs.current[urlOpen];
      if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 60);
  }, [urlOpen, pos]);

  const list = useMemo(() => Object.entries(pos)
    .map(([id, p]) => ({ ...p, id }))
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || (b.createdAt || 0) - (a.createdAt || 0)),
  [pos]);

  // ── KPIs, from the bills — as Sales computes its own ─────────────────────
  const today = todayStr();
  const bills = list.filter((p) => String(p.status || '').toLowerCase() === 'received');
  const purchasesTotal = round2(bills.reduce((s, p) => s + (Number(p.total) || 0), 0));
  const inputGst = round2(bills.reduce((s, p) => s + (Number(p.taxTotal) || 0), 0));
  const unpaidBills = round2(bills.reduce((s, p) => s + Math.max(0, (Number(p.total) || 0) - (Number(p.paidAmount) || 0)), 0));
  const overdueCount = bills.filter((p) => (Number(p.total) || 0) - (Number(p.paidAmount) || 0) > 0 && p.dueDate && p.dueDate < today).length;
  const paidCount = bills.filter((p) => purchaseStanding(p) === 'paid').length;

  // The supplier ledger can disagree with the unpaid bills: a payment made to a
  // supplier before bills were matched to payments sits on their account
  // without being against any bill. Say so, rather than show one number and
  // leave the other to be discovered as a contradiction.
  const ledgerPayable = round2((accounts.find((a) => a.key === 'ap') || {}).balance || 0);
  const gap = accounts.length ? round2(unpaidBills - ledgerPayable) : 0;
  const payableSub = Math.abs(gap) < 1 ? null
    : gap > 0
      ? `${inr(gap)} already paid to suppliers, not yet against a bill`
      : `Supplier ledger shows ${inr(ledgerPayable)}`;

  const filtered = useMemo(() => list.filter((p) => {
    const st = purchaseStanding(p);
    if (filter === 'orders' && !['draft', 'sent'].includes(st)) return false;
    if (['unpaid', 'partial', 'paid'].includes(filter) && st !== filter) return false;
    if (q) {
      const s = q.toLowerCase();
      if (!String(p.poNo || '').toLowerCase().includes(s) && !String(p.vendorName || '').toLowerCase().includes(s)) return false;
    }
    return true;
  }), [list, filter, q]);

  const openEditor = async (p) => {
    try { setEditing(await accountingApi.getPurchaseInvoice(p.id)); }
    catch (e) { showToast(describeError(e, t('failed')), 'error'); }
  };

  const markReceived = async (id) => {
    try { await dbApi.update('purchaseOrders', id, { status: 'received' }); showToast(`✅ ${t('markReceived')}`, 'success'); }
    catch (e) { showToast(describeError(e, t('failed')), 'error'); }
  };

  const remove = async (id) => {
    if (!window.confirm(t('confirmDel'))) return;
    try { await dbApi.remove('purchaseOrders', id); showToast(`🗑 ${t('delete')}`, 'success'); }
    catch (e) { showToast(describeError(e, t('failed')), 'error'); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4" style={{ flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>{t('title')}</h2>
        <div className="flex" style={{ gap: 6 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowImport((v) => !v)}>
            {showImport ? '✕ Close import' : '📥 Import Excel'}
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowNew(true)}>{t('newInvoice')}</button>
        </div>
      </div>

      {showImport && (
        <div className="card" style={{ padding: 14, marginBottom: 12 }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Import purchase bills from Excel</h3>
            <button className="btn btn-xs btn-ghost" onClick={() => setShowImport(false)}>✕</button>
          </div>
          <PurchaseBulkUpload onImported={() => setShowImport(false)} />
        </div>
      )}

      <KpiGrid min={170}>
        <Kpi label={t('purchases')} value={inr(purchasesTotal)} icon="🧾" color="var(--red)"
          sub={inputGst ? `incl. ${inr(inputGst)} input GST` : null} />
        <Kpi label={t('payable')} value={inr(unpaidBills)} icon="🏦" color="var(--amber)" sub={payableSub} />
        <Kpi label={t('overdue')} value={overdueCount} icon="⏰" color="var(--red)" />
        <Kpi label={t('paid')} value={paidCount} icon="✅" color="var(--text)" />
      </KpiGrid>

      <div className="flex" style={{ gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {['all', 'unpaid', 'partial', 'paid', 'orders'].map((k) => (
          <button key={k} className="btn btn-xs" onClick={() => setFilter(k)}
            style={{ background: filter === k ? 'var(--blue, #C05621)' : 'var(--surface2)', color: filter === k ? '#fff' : 'var(--text2)', border: 'none', borderRadius: 14 }}>
            {t(k)}
          </button>
        ))}
        <input className="input" style={{ marginLeft: 'auto', maxWidth: 240 }} placeholder={t('search')} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {!list.length && <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>{t('none')}</div>}
      {list.length > 0 && !filtered.length && (
        <div className="card" style={{ textAlign: 'center', padding: 30, color: 'var(--text3)' }}>{t('noMatch')}</div>
      )}

      {filtered.map((p) => (
        <PurchaseRow
          key={p.id}
          p={p}
          t={t}
          highlighted={urlOpen === p.id}
          innerRef={(el) => { cardRefs.current[p.id] = el; }}
          onEdit={() => openEditor(p)}
          onPay={() => setPaying(p)}
          onReceive={() => markReceived(p.id)}
          onDelete={() => remove(p.id)}
        />
      ))}

      {showNew && <CreatePurchaseFlow onClose={() => setShowNew(false)} />}
      {editing && (
        <CreatePurchaseFlow purchase={editing} onClose={() => setEditing(null)} onCreated={() => setEditing(null)} />
      )}
      {paying && <PayBillModal bill={paying} t={t} onClose={() => setPaying(null)} />}
    </div>
  );
}

function PurchaseRow({ p, t, highlighted, innerRef, onEdit, onPay, onReceive, onDelete }) {
  const navigate = useNavigate();
  const st = purchaseStanding(p);
  const received = String(p.status || '').toLowerCase() === 'received';
  const due = round2(Math.max(0, (Number(p.total) || 0) - (Number(p.paidAmount) || 0)));
  const hasPayment = Number(p.paidAmount) > 0;
  const cancelled = st === 'cancelled';

  return (
    <div
      ref={innerRef}
      className="card"
      data-testid="purchase-row"
      style={{ marginBottom: 8, outline: highlighted ? '2px solid var(--primary, #2563EB)' : 'none' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{p.poNo || p.supplierInvoiceNo || '—'}</span>
          <span className={`badge ${TONE[st] || ''}`} style={{ marginLeft: 6 }} data-testid="purchase-standing">{t(st)}</span>
          {p.editedAt && <span className="badge" style={{ marginLeft: 6 }}>edited</span>}
          <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>{p.vendorName || '—'}</div>
          <div style={{ fontSize: 12, color: 'var(--text2)' }}>
            {p.date}
            {p.dueDate && received && due > 0 ? ` · due ${p.dueDate}` : ''}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{inr(p.total)}</div>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>
            {t('taxable')} {inr(p.taxable ?? p.subtotal)} + {inr(p.taxTotal)} GST
          </div>
          {received && hasPayment && due > 0 && (
            <div style={{ fontSize: 11, color: 'var(--amber, #B45309)' }}>{inr(due)} still to pay</div>
          )}
          <div className="flex" style={{ gap: 6, marginTop: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button className="btn btn-sm btn-ghost" onClick={() => navigate(`/purchase-view?id=${encodeURIComponent(p.id)}`)}>{t('view')}</button>
            {/* Editable only while nothing has been paid against it — the same
                rule as sales. Hidden rather than offered and then refused. */}
            {!cancelled && !hasPayment && (
              <button className="btn btn-sm btn-ghost" onClick={onEdit}>{t('edit')}</button>
            )}
            {received && due > 0 && (
              <button className="btn btn-sm btn-ghost" onClick={onPay}>{t('pay')}</button>
            )}
            {!received && !cancelled && (
              <button className="btn btn-sm btn-ghost" style={{ color: 'var(--green)' }} onClick={onReceive}>{t('markReceived')}</button>
            )}
            {!hasPayment && (
              <button className="btn btn-sm btn-ghost" style={{ color: 'var(--red)' }} onClick={onDelete}>{t('delete')}</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Paying a supplier against one bill. A small form rather than the sales page's
// bare prompt, because a payment out has to say which account it left — without
// that it lands in Unlinked Transactions and the bank statement cannot be
// reconciled.
function PayBillModal({ bill, t, onClose }) {
  const due = round2(Math.max(0, (Number(bill.total) || 0) - (Number(bill.paidAmount) || 0)));
  const [amount, setAmount] = useState(String(due));
  const [mode, setMode] = useState('Bank Transfer');
  const [bankAccountId, setBankAccountId] = useState('');
  const [date, setDate] = useState(todayStr());
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);

  const n = round2(Number(amount) || 0);
  const tooMuch = n > due;

  const save = async () => {
    if (!(n > 0)) { showToast('Enter an amount', 'error'); return; }
    if (tooMuch) { showToast(`Only ${inr(due)} is outstanding on this bill`, 'error'); return; }
    setBusy(true);
    try {
      await accountingApi.payPurchaseInvoice(bill.id, {
        amount: n, mode, date, reference: reference.trim() || undefined,
        bankAccountId: bankAccountId || undefined,
      });
      showToast(`${inr(n)} paid to ${bill.vendorName || 'supplier'}`, 'success');
      onClose();
    } catch (e) {
      showToast(describeError(e, t('failed')), 'error');
      setBusy(false);
    }
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 250, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="card" style={{ width: '100%', maxWidth: 440, padding: 18 }}>
        <h3 style={{ margin: '0 0 2px', fontSize: 16, fontWeight: 700 }}>{t('pay')}</h3>
        <div style={{ fontSize: 12.5, color: 'var(--text3)', marginBottom: 12 }}>
          {bill.poNo} · {bill.vendorName} · {inr(due)} outstanding
        </div>
        <div className="flex gap-2">
          <div className="form-group" style={{ flex: 1 }}>
            <label>Amount</label>
            <input className="input input-num" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label>Date</label>
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        {tooMuch && (
          <div style={{ fontSize: 12, color: 'var(--red, #DC2626)', marginTop: -6, marginBottom: 8 }}>
            More than the {inr(due)} owed. Pay the supplier from Parties to hold the excess as an advance.
          </div>
        )}
        <div className="flex gap-2">
          <div className="form-group" style={{ flex: 1 }}>
            <label>Mode</label>
            <select className="input" value={mode} onChange={(e) => setMode(e.target.value)}>
              {PAY_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label>Reference</label>
            <input className="input" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="UTR / cheque no" />
          </div>
        </div>
        <BankAccountSelect label="Paid from" mode={mode} value={bankAccountId} onChange={setBankAccountId} />
        <div className="flex" style={{ gap: 8, justifyContent: 'flex-end', marginTop: 6 }}>
          <button className="btn btn-sm btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn btn-sm btn-primary" onClick={save} disabled={busy || tooMuch}>{busy ? '…' : t('pay')}</button>
        </div>
      </div>
    </div>
  );
}
