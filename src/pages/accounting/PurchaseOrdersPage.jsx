/**
 * Purchase Orders — /purchase-orders. Create, track and receive POs from vendors.
 * Status flow: draft → sent → received (posts to ledger: Dr Inventory + Dr Input-GST, Cr AP).
 */
import { useEffect, useMemo, useState } from 'react';
import { accountingApi } from '../../services/api';
import { useT } from '../../i18n/LanguageContext';
import { Kpi, KpiGrid, inr } from '../../components/common/DashboardCharts';
import BranchSelect from '../../components/common/BranchSelect';

const round2 = (n) => Math.round(((Number(n) || 0) * 100) + 1e-8) / 100;
const today = () => new Date().toISOString().slice(0, 10);

const S = {
  title:    { en: 'Purchase Orders', hi: 'खरीद आदेश', hinglish: 'Purchase Orders' },
  addNew:   { en: 'New PO', hi: 'नया PO', hinglish: 'New PO' },
  poNo:     { en: 'PO No', hinglish: 'PO No' },
  date:     { en: 'Date', hi: 'तारीख', hinglish: 'Date' },
  vendor:   { en: 'Vendor', hi: 'विक्रेता', hinglish: 'Vendor' },
  amount:   { en: 'Amount', hi: 'राशि', hinglish: 'Amount' },
  status:   { en: 'Status', hi: 'स्थिति', hinglish: 'Status' },
  actions:  { en: 'Actions', hi: 'कार्य', hinglish: 'Actions' },
  draft:    { en: 'Draft', hinglish: 'Draft' },
  sent:     { en: 'Sent', hinglish: 'Sent' },
  received: { en: 'Received', hinglish: 'Received' },
  cancelled:{ en: 'Cancelled', hinglish: 'Cancelled' },
  receive:  { en: 'Receive', hi: 'प्राप्त', hinglish: 'Receive' },
  edit:     { en: 'Edit', hi: 'संपादित', hinglish: 'Edit' },
  delete:   { en: 'Delete', hi: 'हटाएँ', hinglish: 'Delete' },
  save:     { en: 'Save', hi: 'सेव', hinglish: 'Save' },
  cancel:   { en: 'Cancel', hi: 'रद्द', hinglish: 'Cancel' },
  total:    { en: 'Total', hi: 'कुल', hinglish: 'Total' },
  totalPOs: { en: 'Total POs', hinglish: 'Total POs' },
  pending:  { en: 'Pending', hi: 'लंबित', hinglish: 'Pending' },
  totalVal: { en: 'Total Value', hinglish: 'Total Value' },
  receivedAmt: { en: 'Received', hinglish: 'Received' },
  noPOs:    { en: 'No purchase orders.', hi: 'कोई PO नहीं।', hinglish: 'No POs.' },
  confirmReceive: { en: 'Mark this PO as received? This will post to the ledger.', hinglish: 'Mark received?' },
  confirmDelete:  { en: 'Delete this PO?', hinglish: 'Delete this PO?' },
  vendorName: { en: 'Vendor Name', hinglish: 'Vendor Name' },
  itemName: { en: 'Item', hinglish: 'Item' },
  qty:      { en: 'Qty', hinglish: 'Qty' },
  rate:     { en: 'Rate', hinglish: 'Rate' },
  taxRate:  { en: 'GST %', hinglish: 'GST %' },
  addItem:  { en: '+ Item', hinglish: '+ Item' },
  removeItem: { en: '✕', hinglish: '✕' },
  interState: { en: 'Inter-State', hinglish: 'Inter-State' },
  notes:    { en: 'Notes', hinglish: 'Notes' },
  subtotal: { en: 'Subtotal', hinglish: 'Subtotal' },
  gstTotal: { en: 'GST', hinglish: 'GST' },
  search:   { en: 'Search POs…', hinglish: 'Search…' },
};

const STATUS_COLORS = { draft: 'var(--text3)', sent: 'var(--amber)', received: 'var(--green)', cancelled: 'var(--red)' };

export default function PurchaseOrdersPage() {
  const t = useT(S);
  const [pos, setPos] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [q, setQ] = useState('');
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  function emptyForm() {
    return { date: today(), vendorName: '', vendorId: '', vendorGstNo: '', interState: false, branchId: '', items: [{ name: '', qty: 1, rate: 0, taxRate: 18 }], notes: '' };
  }

  const load = () => accountingApi.purchaseOrders().then(setPos).catch(() => setPos([]));
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!q) return pos;
    const s = q.toLowerCase();
    return pos.filter((p) => (p.poNo || '').toLowerCase().includes(s) || (p.vendorName || '').toLowerCase().includes(s));
  }, [pos, q]);

  // KPIs
  const totalAll = round2(pos.reduce((s, p) => s + (Number(p.total) || 0), 0));
  const pending = pos.filter((p) => p.status === 'received');
  const pendingCount = pos.filter((p) => p.status !== 'received' && p.status !== 'cancelled').length;
  const receivedAmt = round2(pending.reduce((s, p) => s + (Number(p.total) || 0), 0));

  const openNew = () => { setEditItem(null); setForm(emptyForm()); setShowForm(true); };
  const openEdit = (po) => {
    setEditItem(po);
    setForm({
      date: po.date || today(), vendorName: po.vendorName || '', vendorId: po.vendorId || '',
      vendorGstNo: po.vendorGstNo || '', interState: !!po.interState,
      branchId: po.branchId || '',
      items: (po.items && po.items.length > 0 ? po.items : [{ name: '', qty: 1, rate: 0, taxRate: 18 }]),
      notes: po.notes || '',
    });
    setShowForm(true);
  };

  const save = async () => {
    if (!form.vendorName || form.items.length === 0) return;
    setSaving(true);
    try {
      if (editItem) {
        await accountingApi.updatePO(editItem.id, form);
      } else {
        await accountingApi.createPO(form);
      }
      setShowForm(false);
      load();
    } catch (e) { alert(e?.response?.data?.error || 'Save failed'); }
    setSaving(false);
  };

  const receivePO = async (id) => {
    if (!window.confirm(t('confirmReceive'))) return;
    try { await accountingApi.receivePO(id); load(); } catch (e) { alert(e?.response?.data?.error || 'Receive failed'); }
  };

  const removePO = async (id) => {
    if (!window.confirm(t('confirmDelete'))) return;
    try { await accountingApi.deletePO(id); load(); } catch (e) { alert(e?.response?.data?.error || 'Delete failed'); }
  };

  const addItem = () => setForm({ ...form, items: [...form.items, { name: '', qty: 1, rate: 0, taxRate: 18 }] });
  const removeItem = (i) => setForm({ ...form, items: form.items.filter((_, idx) => idx !== i) });
  const updateItem = (i, key, val) => {
    const items = [...form.items];
    items[i] = { ...items[i], [key]: val };
    setForm({ ...form, items });
  };

  // Form totals
  const formCalc = useMemo(() => {
    let subtotal = 0; let gst = 0;
    form.items.forEach((it) => {
      const amt = (Number(it.qty) || 0) * (Number(it.rate) || 0);
      const tx = (amt * (Number(it.taxRate) || 0)) / 100;
      subtotal += amt; gst += tx;
    });
    return { subtotal: round2(subtotal), gst: round2(gst), total: round2(subtotal + gst) };
  }, [form.items]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>{t('title')}</h2>
        <button className="btn btn-primary" onClick={openNew}>+ {t('addNew')}</button>
      </div>

      <KpiGrid>
        <Kpi label={t('totalPOs')} value={pos.length} icon="📦" color="var(--text)" />
        <Kpi label={t('pending')} value={pendingCount} icon="⏳" color="var(--amber)" />
        <Kpi label={t('totalVal')} value={inr(totalAll)} icon="💰" color="var(--blue)" />
        <Kpi label={t('receivedAmt')} value={inr(receivedAmt)} icon="✅" color="var(--green)" />
      </KpiGrid>

      <input type="text" placeholder={t('search')} value={q} onChange={(e) => setQ(e.target.value)}
        style={{ width: '100%', maxWidth: 320, padding: '7px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13, marginBottom: 12, boxSizing: 'border-box' }} />

      {filtered.length === 0 ? (
        <div style={{ color: 'var(--text3)', fontSize: 13, padding: '24px 0', textAlign: 'center' }}>{t('noPOs')}</div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'auto' }}>
          <table className="table table-sm" style={{ minWidth: 700, margin: 0 }}>
            <thead>
              <tr>
                <th>{t('poNo')}</th>
                <th>{t('date')}</th>
                <th>{t('vendor')}</th>
                <th style={{ textAlign: 'right' }}>{t('amount')}</th>
                <th>{t('status')}</th>
                <th style={{ width: 140 }}>{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((po) => (
                <tr key={po.id}>
                  <td style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 600 }}>{po.poNo}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{po.date}</td>
                  <td>{po.vendorName}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{inr(po.total)}</td>
                  <td>
                    <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: STATUS_COLORS[po.status] || 'var(--text3)', color: '#fff' }}>
                      {t(po.status || 'draft')}
                    </span>
                  </td>
                  <td>
                    {po.status !== 'received' && po.status !== 'cancelled' && (
                      <>
                        <button className="btn btn-xs btn-ghost" onClick={() => receivePO(po.id)} style={{ color: 'var(--green)' }}>{t('receive')}</button>
                        <button className="btn btn-xs btn-ghost" onClick={() => openEdit(po)}>{t('edit')}</button>
                      </>
                    )}
                    {po.status !== 'received' && (
                      <button className="btn btn-xs btn-ghost" style={{ color: 'var(--red)' }} onClick={() => removePO(po.id)}>{t('delete')}</button>
                    )}
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
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>{editItem ? `${t('edit')} ${editItem.poNo}` : t('addNew')}</h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div className="form-group">
                <label>{t('date')}</label>
                <input className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
              <div className="form-group">
                <label>{t('vendorName')}</label>
                <input className="input" value={form.vendorName} onChange={(e) => setForm({ ...form, vendorName: e.target.value })} />
              </div>
              <div className="form-group">
                <label>{t('vendor')} GSTIN</label>
                <input className="input" value={form.vendorGstNo} onChange={(e) => setForm({ ...form, vendorGstNo: e.target.value })} />
              </div>
              <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 4 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.interState} onChange={(e) => setForm({ ...form, interState: e.target.checked })} />
                  {t('interState')}
                </label>
              </div>
              <div className="form-group">
                <label>Branch</label>
                <BranchSelect value={form.branchId} onChange={(v) => setForm({ ...form, branchId: v })} />
              </div>
            </div>

            {/* Line items */}
            <div style={{ marginBottom: 12 }}>
              {form.items.map((it, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 6, marginBottom: 6, alignItems: 'center' }}>
                  <input className="input" placeholder={t('itemName')} value={it.name} onChange={(e) => updateItem(i, 'name', e.target.value)} />
                  <input className="input" type="number" min="0" placeholder={t('qty')} value={it.qty} onChange={(e) => updateItem(i, 'qty', e.target.value)} />
                  <input className="input" type="number" min="0" step="0.01" placeholder={t('rate')} value={it.rate} onChange={(e) => updateItem(i, 'rate', e.target.value)} />
                  <input className="input" type="number" min="0" max="100" placeholder={t('taxRate')} value={it.taxRate} onChange={(e) => updateItem(i, 'taxRate', e.target.value)} />
                  {form.items.length > 1 && (
                    <button className="btn btn-xs btn-ghost" style={{ color: 'var(--red)' }} onClick={() => removeItem(i)}>{t('removeItem')}</button>
                  )}
                </div>
              ))}
              <button className="btn btn-xs btn-ghost" onClick={addItem}>+ {t('addItem')}</button>
            </div>

            {/* Totals */}
            <div style={{ display: 'flex', gap: 16, marginBottom: 12, fontSize: 13 }}>
              <span>{t('subtotal')}: <b>{inr(formCalc.subtotal)}</b></span>
              <span>{t('gstTotal')}: <b>{inr(formCalc.gst)}</b></span>
              <span style={{ fontWeight: 700 }}>{t('total')}: <b style={{ color: 'var(--green)' }}>{inr(formCalc.total)}</b></span>
            </div>

            <div className="form-group" style={{ marginBottom: 12 }}>
              <label>{t('notes')}</label>
              <textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setShowForm(false)}>{t('cancel')}</button>
              <button className="btn btn-primary" disabled={saving || !form.vendorName} onClick={save}>{saving ? '…' : t('save')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
