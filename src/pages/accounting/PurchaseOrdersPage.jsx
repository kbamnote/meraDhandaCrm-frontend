/**
 * Purchase Orders — /purchase-orders. Create, track and receive POs from vendors.
 * Status flow: draft → sent → received (posts to ledger: Dr Inventory + Dr Input-GST, Cr AP).
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { accountingApi, describeError } from '../../services/api';
import { showToast } from '../../components/common/toast';
import CreatePurchaseFlow from '../../components/common/CreatePurchaseFlow';
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

// Same badge classes as Sales Invoices, so a status reads the same on both.
const PO_TONE = { draft: '', sent: 'badge-amber', received: 'badge-green', cancelled: 'badge-red' };

export default function PurchaseOrdersPage() {
  const t = useT(S);
  const [pos, setPos] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  function emptyForm() {
    return { date: today(), vendorName: '', vendorId: '', vendorGstNo: '', interState: false, branchId: '', items: [{ name: '', qty: 1, rate: 0, taxRate: 18 }], notes: '' };
  }

  const load = () => accountingApi.purchaseOrders().then(setPos).catch(() => setPos([]));
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => pos.filter((p) => {
    if (filter !== 'all' && String(p.status || 'draft') !== filter) return false;
    if (q) {
      const s = q.toLowerCase();
      if (!(p.poNo || '').toLowerCase().includes(s) && !(p.vendorName || '').toLowerCase().includes(s)) return false;
    }
    return true;
  }), [pos, q, filter]);

  // KPIs — the same four-card shape as Sales Invoices, read from the orders.
  const open = pos.filter((p) => ['draft', 'sent'].includes(String(p.status || 'draft')));
  const openValue = round2(open.reduce((s, p) => s + (Number(p.total) || 0), 0));
  const awaitingCount = pos.filter((p) => p.status === 'sent').length;
  const receivedOrders = pos.filter((p) => p.status === 'received');
  const receivedAmt = round2(receivedOrders.reduce((s, p) => s + (Number(p.total) || 0), 0));
  const draftCount = pos.filter((p) => String(p.status || 'draft') === 'draft').length;

  const openNew = () => { setEditItem(null); setForm(emptyForm()); setShowForm(true); };
  const navigate = useNavigate();
  // The full purchase editor, same one the Purchases page and the document
  // view use — so editing an order looks and behaves like editing a sales
  // invoice. The basic form below is kept for raising a NEW order, which is a
  // different thing from recording a supplier's bill.
  const [editingPurchase, setEditingPurchase] = useState(null);
  const openFullEdit = async (po) => {
    try { setEditingPurchase(await accountingApi.getPurchaseInvoice(po.id)); }
    catch (e) { showToast(describeError(e, 'Could not open this order'), 'error'); }
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
      <div className="flex items-center justify-between mb-4" style={{ flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>{t('title')}</h2>
        <button className="btn btn-primary btn-sm" onClick={openNew}>+ {t('addNew')}</button>
      </div>

      <KpiGrid min={170}>
        <Kpi label="Open orders" value={inr(openValue)} icon="📦" color="var(--blue)"
          sub={`${open.length} order${open.length === 1 ? '' : 's'}`} />
        <Kpi label="Awaiting delivery" value={awaitingCount} icon="🚚" color="var(--amber)" />
        <Kpi label={t('receivedAmt')} value={inr(receivedAmt)} icon="✅" color="var(--green)"
          sub={`${receivedOrders.length} order${receivedOrders.length === 1 ? '' : 's'}`} />
        <Kpi label={t('draft')} value={draftCount} icon="📝" color="var(--text)" />
      </KpiGrid>

      <div className="flex" style={{ gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {['all', 'draft', 'sent', 'received', 'cancelled'].map((k) => (
          <button key={k} className="btn btn-xs" onClick={() => setFilter(k)}
            style={{ background: filter === k ? 'var(--blue, #C05621)' : 'var(--surface2)', color: filter === k ? '#fff' : 'var(--text2)', border: 'none', borderRadius: 14 }}>
            {k === 'all' ? 'All' : t(k)}
          </button>
        ))}
        <input className="input" style={{ marginLeft: 'auto', maxWidth: 240 }} placeholder={t('search')} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {!pos.length && <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>{t('noPOs')}</div>}
      {pos.length > 0 && !filtered.length && (
        <div className="card" style={{ textAlign: 'center', padding: 30, color: 'var(--text3)' }}>Nothing matches this filter.</div>
      )}

      {filtered.map((po) => {
        const st = String(po.status || 'draft');
        const paidAgainst = Number(po.paidAmount) > 0;
        return (
          <div key={po.id} className="card" style={{ marginBottom: 8 }} data-testid="po-row">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0 }}>
                <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{po.poNo || '—'}</span>
                <span className={`badge ${PO_TONE[st] || ''}`} style={{ marginLeft: 6 }}>{t(st)}</span>
                {po.editedAt && <span className="badge" style={{ marginLeft: 6 }}>edited</span>}
                <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>{po.vendorName || '—'}</div>
                <div style={{ fontSize: 12, color: 'var(--text2)' }}>
                  {po.date}{po.receivedDate ? ` · received ${po.receivedDate}` : ''}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{inr(po.total)}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                  Taxable {inr(po.taxable ?? po.subtotal)} + {inr(po.taxTotal ?? round2((po.cgst || 0) + (po.sgst || 0) + (po.igst || 0)))} GST
                </div>
                <div className="flex" style={{ gap: 6, marginTop: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                  <button className="btn btn-sm btn-ghost" onClick={() => navigate(`/purchase-view?id=${encodeURIComponent(po.id)}`)}>View</button>
                  {/* Editable whatever its stage — a received order is corrected
                      the way a sales invoice is, with the ledger re-posted and the
                      stock re-received. Not once cancelled or paid against. */}
                  {st !== 'cancelled' && !paidAgainst && (
                    <button className="btn btn-sm btn-ghost" onClick={() => openFullEdit(po)}>{t('edit')}</button>
                  )}
                  {st !== 'received' && st !== 'cancelled' && (
                    <button className="btn btn-sm btn-ghost" style={{ color: 'var(--green)' }} onClick={() => receivePO(po.id)}>{t('receive')}</button>
                  )}
                  {st !== 'received' && (
                    <button className="btn btn-sm btn-ghost" style={{ color: 'var(--red)' }} onClick={() => removePO(po.id)}>{t('delete')}</button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}

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
      {editingPurchase && (
        <CreatePurchaseFlow
          purchase={editingPurchase}
          onClose={() => setEditingPurchase(null)}
          onCreated={() => { setEditingPurchase(null); load(); }}
        />
      )}
    </div>
  );
}
