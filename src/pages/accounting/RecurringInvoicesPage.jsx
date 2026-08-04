/**
 * Recurring Invoices — /accounting/recurring. Templates that auto-generate a
 * real invoice on a schedule (weekly/biweekly/monthly/quarterly/yearly).
 * Each template carries client info + line items + GST settings; "Generate
 * now" raises an invoice immediately and advances the next due date.
 */
import { useEffect, useMemo, useState } from 'react';
import { accountingApi } from '../../services/api';
import { useT } from '../../i18n/LanguageContext';
import { Kpi, KpiGrid } from '../../components/common/DashboardCharts';
import BranchSelect from '../../components/common/BranchSelect';

const today = () => new Date().toISOString().slice(0, 10);
const freqLabel = {
  weekly: { en: 'Weekly', hinglish: 'Weekly' },
  biweekly: { en: 'Bi-weekly', hinglish: 'Bi-weekly' },
  monthly: { en: 'Monthly', hinglish: 'Monthly' },
  quarterly: { en: 'Quarterly', hinglish: 'Quarterly' },
  yearly: { en: 'Yearly', hinglish: 'Yearly' },
};

const S = {
  title:     { en: 'Recurring Invoices', hinglish: 'Recurring Invoices' },
  newTpl:    { en: 'New Template', hinglish: 'New Template' },
  client:    { en: 'Client', hinglish: 'Client' },
  items:     { en: 'Items', hinglish: 'Items' },
  freq:      { en: 'Frequency', hinglish: 'Frequency' },
  nextDate:  { en: 'Next Due', hinglish: 'Next Due' },
  lastGen:   { en: 'Last Generated', hinglish: 'Last Generated' },
  status:    { en: 'Status', hinglish: 'Status' },
  actions:   { en: 'Actions', hinglish: 'Actions' },
  active:    { en: 'Active', hinglish: 'Active' },
  paused:    { en: 'Paused', hinglish: 'Paused' },
  gen:       { en: 'Generate', hinglish: 'Generate' },
  edit:      { en: 'Edit', hinglish: 'Edit' },
  delete:    { en: 'Delete', hinglish: 'Delete' },
  save:      { en: 'Save', hinglish: 'Save' },
  cancel:    { en: 'Cancel', hinglish: 'Cancel' },
  noTpl:     { en: 'No recurring invoice templates yet.', hinglish: 'No templates yet.' },
  confirmDelete: { en: 'Delete this template?', hinglish: 'Delete?' },
  clientName: { en: 'Client Name', hinglish: 'Client Name' },
  clientPhone: { en: 'Client Phone', hinglish: 'Client Phone' },
  gstNo:     { en: 'Client GSTIN', hinglish: 'GSTIN' },
  clientAddr: { en: 'Client Address', hinglish: 'Client Address' },
  itemName:  { en: 'Item', hinglish: 'Item' },
  qty:       { en: 'Qty', hinglish: 'Qty' },
  rate:      { en: 'Rate', hinglish: 'Rate' },
  gstRate:   { en: 'GST %', hinglish: 'GST %' },
  discount:  { en: 'Discount', hinglish: 'Discount' },
  interState: { en: 'Inter-state (IGST)', hinglish: 'Inter-state' },
  notes:     { en: 'Notes', hinglish: 'Notes' },
  addItem:   { en: '+ Item', hinglish: '+ Item' },
  removeItem: { en: '✕', hinglish: '✕' },
  startDate: { en: 'Start Date', hinglish: 'Start Date' },
  tplCount:  { en: 'Templates', hinglish: 'Templates' },
  activeCt:  { en: 'Active', hinglish: 'Active' },
  dueSoon:   { en: 'Due ≤ 7 days', hinglish: 'Due soon' },
  monthlyVal: { en: 'Monthly Value', hinglish: 'Monthly Value' },
  search:    { en: 'Search…', hinglish: 'Search…' },
  generated: { en: 'Invoice generated', hinglish: 'Invoice generated' },
  subTotal:  { en: 'Subtotal', hinglish: 'Subtotal' },
  tax:       { en: 'Tax', hinglish: 'Tax' },
  total:     { en: 'Total', hinglish: 'Total' },
  inr:       { en: '₹', hinglish: '₹' },
};

export default function RecurringInvoicesPage() {
  const t = useT(S);
  const [tpls, setTpls] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editTpl, setEditTpl] = useState(null);
  const [q, setQ] = useState('');
  const [saving, setSaving] = useState(false);
  const [genId, setGenId] = useState(null);

  function emptyForm() {
    return {
      clientName: '', clientPhone: '', gstNo: '', clientAddress: '',
      frequency: 'monthly', startDate: today(), nextDate: today(), gstRate: 18, interState: false,
      branchId: '', discount: 0, active: true, notes: '',
      items: [{ name: '', qty: 1, rate: 0, taxRate: 18 }],
    };
  }
  const [form, setForm] = useState(emptyForm());

  const load = () => accountingApi.recurringInvoices().then(setTpls).catch(() => setTpls([]));
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!q) return tpls;
    const s = q.toLowerCase();
    return tpls.filter((x) => (x.clientName || '').toLowerCase().includes(s));
  }, [tpls, q]);

  const tplTotal = (x) => {
    const st = (x.items || []).reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.rate) || 0), 0);
    const gst = Number(x.gstRate) || 0;
    const tax = (st * gst) / 100;
    return Math.max(0, st + tax - (Number(x.discount) || 0));
  };
  const monthlyValue = (x) => {
    const total = tplTotal(x);
    const mult = { weekly: 52 / 12, biweekly: 26 / 12, monthly: 1, quarterly: 4 / 12, yearly: 1 / 12 };
    return total * (mult[x.frequency] || 1);
  };

  const activeCount = tpls.filter((x) => x.active).length;
  const dueSoonCount = tpls.filter((x) => x.active && x.nextDate && (new Date(x.nextDate) - new Date()) <= 7 * 86400000).length;

  const openNew = () => { setEditTpl(null); setForm(emptyForm()); setShowForm(true); };
  const openEdit = (x) => {
    setEditTpl(x);
    setForm({
      clientName: x.clientName || '', clientPhone: x.clientPhone || '', gstNo: x.clientGstNo || '',
      clientAddress: x.clientAddress || '', frequency: x.frequency || 'monthly',
      startDate: x.startDate || today(), nextDate: x.nextDate || today(),
      gstRate: x.gstRate != null ? x.gstRate : 18, interState: !!x.interState,
      branchId: x.branchId || '', discount: x.discount || 0, active: x.active !== false, notes: x.notes || '',
      items: (x.items && x.items.length ? x.items : [{ name: '', qty: 1, rate: 0, taxRate: 18 }]),
    });
    setShowForm(true);
  };

  const save = async () => {
    if (!form.clientName || form.items.length === 0) return;
    setSaving(true);
    try {
      if (editTpl) { await accountingApi.updateRecurringInvoice(editTpl.id, form); }
      else { await accountingApi.createRecurringInvoice(form); }
      setShowForm(false); load();
    } catch (e) { alert(e?.response?.data?.error || 'Save failed'); }
    setSaving(false);
  };

  const generateNow = async (id) => {
    setGenId(id);
    try { await accountingApi.generateRecurringInvoice(id); load(); }
    catch (e) { alert(e?.response?.data?.error || 'Generation failed'); }
    setGenId(null);
  };

  const removeTpl = async (id) => {
    if (!window.confirm(t('confirmDelete'))) return;
    try { await accountingApi.deleteRecurringInvoice(id); load(); } catch (e) { alert('Failed'); }
  };

  const addItem = () => setForm({ ...form, items: [...form.items, { name: '', qty: 1, rate: 0, taxRate: form.gstRate }] });
  const removeItem = (i) => setForm({ ...form, items: form.items.filter((_, idx) => idx !== i) });
  const updateItem = (i, key, val) => { const items = [...form.items]; items[i] = { ...items[i], [key]: val }; setForm({ ...form, items }); };
  const fmt = (n) => '₹' + (Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>{t('title')}</h2>
        <button className="btn btn-primary" onClick={openNew}>+ {t('newTpl')}</button>
      </div>

      <KpiGrid>
        <Kpi label={t('tplCount')} value={tpls.length} icon="🔁" color="var(--text)" />
        <Kpi label={t('activeCt')} value={activeCount} icon="✅" color="var(--green)" />
        <Kpi label={t('dueSoon')} value={dueSoonCount} icon="⏰" color="var(--amber)" />
        <Kpi label={t('monthlyVal')} value={fmt(tpls.reduce((s, x) => s + monthlyValue(x), 0))} icon="💰" color="var(--blue)" />
      </KpiGrid>

      <input type="text" placeholder={t('search')} value={q} onChange={(e) => setQ(e.target.value)}
        style={{ width: '100%', maxWidth: 320, padding: '7px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13, marginBottom: 12, boxSizing: 'border-box' }} />

      {filtered.length === 0 ? (
        <div style={{ color: 'var(--text3)', fontSize: 13, padding: '24px 0', textAlign: 'center' }}>{t('noTpl')}</div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'auto' }}>
          <table className="table table-sm" style={{ minWidth: 760, margin: 0 }}>
            <thead>
              <tr>
                <th>{t('client')}</th><th>{t('items')}</th><th>{t('freq')}</th>
                <th>{t('nextDate')}</th><th>{t('lastGen')}</th><th>{t('status')}</th>
                <th style={{ width: 200 }}>{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((x) => (
                <tr key={x.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{x.clientName}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>{fmt(tplTotal(x))}</div>
                  </td>
                  <td style={{ fontSize: 12 }}>{(x.items || []).length} line{(x.items || []).length === 1 ? '' : 's'}</td>
                  <td><span style={{ fontSize: 12 }}>{t(freqLabel[x.frequency]?.en ? x.frequency : 'monthly')}</span></td>
                  <td style={{ fontSize: 12, fontWeight: x.active && x.nextDate && (new Date(x.nextDate) - new Date()) <= 7 * 86400000 ? 600 : 400 }}>{x.nextDate || '—'}</td>
                  <td style={{ fontSize: 12 }}>{x.lastGenerated || '—'}</td>
                  <td>
                    <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: x.active ? 'var(--green)' : 'var(--text3)', color: '#fff' }}>
                      {x.active ? t('active') : t('paused')}
                    </span>
                  </td>
                  <td>
                    <button className="btn btn-xs btn-primary" disabled={genId === x.id} onClick={() => generateNow(x.id)}>{genId === x.id ? '…' : t('gen')}</button>
                    <button className="btn btn-xs btn-ghost" onClick={() => openEdit(x)}>{t('edit')}</button>
                    <button className="btn btn-xs btn-ghost" style={{ color: 'var(--red)' }} onClick={() => removeTpl(x.id)}>{t('delete')}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Form */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowForm(false); }}>
          <div className="card" style={{ width: '100%', maxWidth: 640, padding: 20, maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>{editTpl ? `${t('edit')} — ${editTpl.clientName}` : t('newTpl')}</h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}><label>{t('clientName')} *</label><input className="input" value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })} /></div>
              <div className="form-group"><label>{t('clientPhone')}</label><input className="input" value={form.clientPhone} onChange={(e) => setForm({ ...form, clientPhone: e.target.value })} /></div>
              <div className="form-group"><label>{t('gstNo')}</label><input className="input" value={form.gstNo} onChange={(e) => setForm({ ...form, gstNo: e.target.value })} /></div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}><label>{t('clientAddr')}</label><input className="input" value={form.clientAddress} onChange={(e) => setForm({ ...form, clientAddress: e.target.value })} /></div>
              <div className="form-group"><label>{t('freq')}</label>
                <select className="input" value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })}>
                  {['weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'].map((f) => (
                    <option key={f} value={f}>{t(freqLabel[f].en ? f : 'monthly')}</option>
                  ))}
                </select>
              </div>
              <div className="form-group"><label>{t('nextDate')}</label><input className="input" type="date" value={form.nextDate} onChange={(e) => setForm({ ...form, nextDate: e.target.value })} /></div>
              <div className="form-group"><label>{t('gstRate')}</label>
                <select className="input" value={form.gstRate} onChange={(e) => setForm({ ...form, gstRate: Number(e.target.value) })}>
                  {[0, 5, 12, 18, 28].map((r) => <option key={r} value={r}>{r}%</option>)}
                </select>
              </div>
              <div className="form-group"><label>{t('discount')}</label><input className="input" type="number" min="0" value={form.discount} onChange={(e) => setForm({ ...form, discount: Number(e.target.value) })} /></div>
              <div className="form-group"><label>Branch</label><BranchSelect value={form.branchId} onChange={(v) => setForm({ ...form, branchId: v })} /></div>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, marginBottom: 10 }}>
              <input type="checkbox" checked={form.interState} onChange={(e) => setForm({ ...form, interState: e.target.checked })} /> {t('interState')}
            </label>

            <div style={{ marginBottom: 12 }}>
              {form.items.map((it, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 6, marginBottom: 6, alignItems: 'center' }}>
                  <input className="input" placeholder={t('itemName')} value={it.name} onChange={(e) => updateItem(i, 'name', e.target.value)} />
                  <input className="input" type="number" min="0" placeholder={t('qty')} value={it.qty} onChange={(e) => updateItem(i, 'qty', e.target.value)} />
                  <input className="input" type="number" min="0" placeholder={t('rate')} value={it.rate} onChange={(e) => updateItem(i, 'rate', e.target.value)} />
                  <input className="input" type="number" min="0" placeholder={t('gstRate')} value={it.taxRate} onChange={(e) => updateItem(i, 'taxRate', e.target.value)} />
                  {form.items.length > 1 && <button className="btn btn-xs btn-ghost" style={{ color: 'var(--red)' }} onClick={() => removeItem(i)}>{t('removeItem')}</button>}
                </div>
              ))}
              <button className="btn btn-xs btn-ghost" onClick={addItem}>+ {t('addItem')}</button>
            </div>

            <div className="form-group" style={{ marginBottom: 14 }}>
              <label>{t('notes')}</label>
              <textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setShowForm(false)}>{t('cancel')}</button>
              <button className="btn btn-primary" disabled={saving || !form.clientName} onClick={save}>{saving ? '…' : t('save')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
