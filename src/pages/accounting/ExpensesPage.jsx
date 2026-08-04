/**
 * Expenses — /expenses. CRUD for business expenses with category breakdown,
 * payment mode tracking, and automatic ledger posting (Dr Expense, Cr Cash/Bank).
 */
import { useEffect, useMemo, useState } from 'react';
import { accountingApi } from '../../services/api';
import { useT } from '../../i18n/LanguageContext';
import { Kpi, KpiGrid, inr } from '../../components/common/DashboardCharts';
import BranchSelect from '../../components/common/BranchSelect';

const round2 = (n) => Math.round(((Number(n) || 0) * 100) + 1e-8) / 100;
const today = () => new Date().toISOString().slice(0, 10);

const S = {
  title:    { en: 'Expenses', hi: 'खर्च', hinglish: 'Expenses' },
  addNew:   { en: 'Add Expense', hi: 'खर्च जोड़ें', hinglish: 'Add Expense' },
  edit:     { en: 'Edit', hi: 'संपादित', hinglish: 'Edit' },
  delete:   { en: 'Delete', hi: 'हटाएँ', hinglish: 'Delete' },
  date:     { en: 'Date', hi: 'तारीख', hinglish: 'Date' },
  category: { en: 'Category', hi: 'श्रेणी', hinglish: 'Category' },
  desc:     { en: 'Description', hi: 'विवरण', hinglish: 'Description' },
  amount:   { en: 'Amount', hi: 'राशि', hinglish: 'Amount' },
  mode:     { en: 'Payment Mode', hi: 'भुगतान', hinglish: 'Payment Mode' },
  vendor:   { en: 'Vendor', hi: 'विक्रेता', hinglish: 'Vendor' },
  ref:      { en: 'Invoice Ref', hi: 'रेफ', hinglish: 'Invoice Ref' },
  total:    { en: 'Total Expenses', hi: 'कुल खर्च', hinglish: 'Total Expenses' },
  count:    { en: 'Entries', hi: 'एंट्री', hinglish: 'Entries' },
  thisMonth:{ en: 'This Month', hi: 'इस महीने', hinglish: 'This Month' },
  topCat:   { en: 'Top Category', hi: 'टॉप श्रेणी', hinglish: 'Top Category' },
  cash:     { en: 'Cash', hinglish: 'Cash' },
  bank:     { en: 'Bank', hinglish: 'Bank' },
  save:     { en: 'Save', hi: 'सेव', hinglish: 'Save' },
  cancel:   { en: 'Cancel', hi: 'रद्द', hinglish: 'Cancel' },
  confirm:  { en: 'Delete this expense?', hi: 'यह खर्च हटाएँ?', hinglish: 'Delete this expense?' },
  noExpenses:{ en: 'No expenses recorded yet.', hi: 'अभी तक कोई खर्च नहीं।', hinglish: 'No expenses yet.' },
  search:   { en: 'Search expenses…', hi: 'खर्च खोजें…', hinglish: 'Search…' },
  catBreakdown: { en: 'Category Breakdown', hi: 'श्रेणी विवरण', hinglish: 'Category Breakdown' },
  suggest:   { en: 'Suggested:', hinglish: 'Suggested:' },
  useSugg:   { en: 'Use', hinglish: 'Use' },
  outlier:   { en: 'Amount is X× the usual for this vendor', hinglish: 'Vendor ke usual se X× zyada' },
  dup:       { en: 'Possible duplicate (same vendor & amount recently)', hinglish: 'Duplicate ho sakta hai' },
  anomaly:   { en: 'Anomaly', hinglish: 'Anomaly' },
  branch:    { en: 'Branch', hi: 'शाखा', hinglish: 'Branch' },
};

const CATEGORIES = ['Rent', 'Utilities', 'Salaries', 'Transport', 'Raw Materials', 'Office Supplies', 'Marketing', 'Maintenance', 'Miscellaneous', 'Travel', 'Internet', 'Repairs', 'Bank Charges', 'Insurance', 'Legal', 'Packaging', 'Software', 'Food', 'General'];

export default function ExpensesPage() {
  const t = useT(S);
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [q, setQ] = useState('');
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [suggested, setSuggested] = useState(null); // live rule-based category preview

  function emptyForm() {
    return { date: today(), category: 'General', description: '', amount: '', paymentMode: 'cash', vendor: '', invoiceRef: '', branchId: '' };
  }

  // Live category suggestion — debounced call to the rule engine while typing.
  useEffect(() => {
    if (!form.description && !form.vendor) { setSuggested(null); return; }
    const id = setTimeout(() => {
      accountingApi.suggestCategory({ description: form.description, vendor: form.vendor })
        .then((r) => setSuggested(r.category))
        .catch(() => setSuggested(null));
    }, 350);
    return () => clearTimeout(id);
  }, [form.description, form.vendor]);

  const load = () => {
    accountingApi.expenses().then(setExpenses).catch(() => setExpenses([]));
    accountingApi.expenseCategories().then(setCategories).catch(() => setCategories([]));
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!q) return expenses;
    const s = q.toLowerCase();
    return expenses.filter((e) =>
      (e.category || '').toLowerCase().includes(s) ||
      (e.description || '').toLowerCase().includes(s) ||
      (e.vendor || '').toLowerCase().includes(s)
    );
  }, [expenses, q]);

  // KPIs
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const totalAll = round2(expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0));
  const totalMonth = round2(expenses.filter((e) => (e.date || '').startsWith(thisMonth)).reduce((s, e) => s + (Number(e.amount) || 0), 0));
  const catTotals = useMemo(() => {
    const m = {};
    expenses.forEach((e) => { m[e.category || 'General'] = (m[e.category || 'General'] || 0) + (Number(e.amount) || 0); });
    return Object.entries(m).map(([cat, amt]) => ({ cat, amt: round2(amt) })).sort((a, b) => b.amt - a.amt);
  }, [expenses]);
  const topCat = catTotals.length > 0 ? catTotals[0] : null;

  const openNew = () => { setEditItem(null); setForm(emptyForm()); setShowForm(true); };
  const openEdit = (e) => { setEditItem(e); setForm({ date: e.date || today(), category: e.category || '', description: e.description || '', amount: e.amount || '', paymentMode: e.paymentMode || 'cash', vendor: e.vendor || '', invoiceRef: e.invoiceRef || '', branchId: e.branchId || '' }); setShowForm(true); };

  const save = async () => {
    if (!form.amount || Number(form.amount) <= 0) return;
    setSaving(true);
    try {
      if (editItem) {
        await accountingApi.updateExpense(editItem.id, form);
      } else {
        await accountingApi.createExpense(form);
      }
      setShowForm(false);
      load();
    } catch (e) { alert(e?.response?.data?.error || 'Save failed'); }
    setSaving(false);
  };

  const remove = async (id) => {
    if (!window.confirm(t('confirm'))) return;
    try { await accountingApi.deleteExpense(id); load(); } catch (e) { alert('Delete failed'); }
  };

  const allCats = useMemo(() => {
    const set = new Set([...CATEGORIES, ...categories]);
    return [...set].sort();
  }, [categories]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>{t('title')}</h2>
        <button className="btn btn-primary" onClick={openNew}>+ {t('addNew')}</button>
      </div>

      <KpiGrid>
        <Kpi label={t('total')} value={inr(totalAll)} icon="💸" color="var(--red)" />
        <Kpi label={t('thisMonth')} value={inr(totalMonth)} icon="📅" color="var(--blue)" />
        <Kpi label={t('count')} value={expenses.length} icon="📄" color="var(--text)" />
        <Kpi label={t('topCat')} value={topCat ? `${topCat.cat} (${inr(topCat.amt)})` : '—'} icon="📊" color="var(--green)" />
      </KpiGrid>

      {/* Category Breakdown */}
      {catTotals.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{t('catBreakdown')}</h3>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {catTotals.map((c) => (
              <span key={c.cat} style={{ padding: '4px 10px', borderRadius: 12, fontSize: 12, background: 'var(--surface2)', color: 'var(--text)' }}>
                {c.cat}: {inr(c.amt)}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      <input type="text" placeholder={t('search')} value={q} onChange={(e) => setQ(e.target.value)}
        style={{ width: '100%', maxWidth: 320, padding: '7px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13, marginBottom: 12, boxSizing: 'border-box' }} />

      {/* Table */}
      {filtered.length === 0 ? (
        <div style={{ color: 'var(--text3)', fontSize: 13, padding: '24px 0', textAlign: 'center' }}>{t('noExpenses')}</div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'auto' }}>
          <table className="table table-sm" style={{ minWidth: 700, margin: 0 }}>
            <thead>
              <tr>
                <th>{t('date')}</th>
                <th>{t('category')}</th>
                <th>{t('desc')}</th>
                <th>{t('vendor')}</th>
                <th style={{ textAlign: 'right' }}>{t('amount')}</th>
                <th>{t('mode')}</th>
                <th style={{ width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id}>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{e.date}</td>
                  <td>
                    <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, background: 'var(--blue)', color: '#fff' }}>{e.category || 'General'}</span>
                    {e.anomaly && (e.anomaly.amountOutlier || e.anomaly.possibleDuplicate) && (
                      <span title={e.anomaly.amountOutlier ? t('outlier').replace('X', e.anomaly.amountOutlier.ratio) : t('dup')}
                        style={{ marginLeft: 4, padding: '1px 5px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: 'var(--red)', color: '#fff', cursor: 'help' }}>
                        ⚠
                      </span>
                    )}
                  </td>
                  <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.description || '—'}</td>
                  <td>{e.vendor || '—'}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--red)' }}>{inr(e.amount)}</td>
                  <td>
                    <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 11, background: e.paymentMode === 'bank' ? 'var(--green)' : 'var(--amber)', color: '#fff' }}>
                      {e.paymentMode === 'bank' ? t('bank') : t('cash')}
                    </span>
                  </td>
                  <td>
                    <button className="btn btn-xs btn-ghost" onClick={() => openEdit(e)}>{t('edit')}</button>
                    <button className="btn btn-xs btn-ghost" style={{ color: 'var(--red)' }} onClick={() => remove(e.id)}>{t('delete')}</button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: 700, borderTop: '2px solid var(--border)' }}>
                <td colSpan={4}>{t('total')}</td>
                <td style={{ textAlign: 'right', color: 'var(--red)' }}>{inr(totalAll)}</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Modal Form */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowForm(false); }}>
          <div className="card" style={{ width: '100%', maxWidth: 480, padding: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>{editItem ? t('edit') : t('addNew')}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div className="form-group">
                <label>{t('date')}</label>
                <input className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
              <div className="form-group">
                <label>{t('amount')}</label>
                <input className="input" type="number" step="0.01" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" />
              </div>
              <div className="form-group">
                <label>{t('category')}</label>
                <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {allCats.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                {suggested && suggested !== form.category && (
                  <div style={{ marginTop: 4, fontSize: 11, color: 'var(--blue)', display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span>{t('suggest')} {suggested}</span>
                    <button type="button" className="btn btn-xs btn-ghost" onClick={() => setForm({ ...form, category: suggested })}>{t('useSugg')}</button>
                  </div>
                )}
              </div>
              <div className="form-group">
                <label>{t('mode')}</label>
                <select className="input" value={form.paymentMode} onChange={(e) => setForm({ ...form, paymentMode: e.target.value })}>
                  <option value="cash">{t('cash')}</option>
                  <option value="bank">{t('bank')}</option>
                </select>
              </div>
              <div className="form-group">
                <label>{t('branch')}</label>
                <BranchSelect value={form.branchId} onChange={(v) => setForm({ ...form, branchId: v })} />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>{t('desc')}</label>
                <input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g. Office rent for July" />
              </div>
              <div className="form-group">
                <label>{t('vendor')}</label>
                <input className="input" value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} />
              </div>
              <div className="form-group">
                <label>{t('ref')}</label>
                <input className="input" value={form.invoiceRef} onChange={(e) => setForm({ ...form, invoiceRef: e.target.value })} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
              <button className="btn btn-ghost" onClick={() => setShowForm(false)}>{t('cancel')}</button>
              <button className="btn btn-primary" disabled={saving || !form.amount} onClick={save}>{saving ? '…' : t('save')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
