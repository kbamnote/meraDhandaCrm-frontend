/**
 * Delivery Challans — /accounting/challans. Track goods dispatch with
 * item-wise quantities, vehicle/driver details, and printable challan view.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { accountingApi } from '../../services/api';
import { useT } from '../../i18n/LanguageContext';
import { Kpi, KpiGrid } from '../../components/common/DashboardCharts';

const today = () => new Date().toISOString().slice(0, 10);

const S = {
  title:    { en: 'Delivery Challans', hi: 'डिलीवरी चालान', hinglish: 'Delivery Challans' },
  newDC:    { en: 'New Challan', hi: 'नया चालान', hinglish: 'New Challan' },
  dcNo:     { en: 'DC No', hinglish: 'DC No' },
  date:     { en: 'Date', hinglish: 'Date' },
  client:   { en: 'Client', hinglish: 'Client' },
  invoice:  { en: 'Invoice', hinglish: 'Invoice' },
  job:      { en: 'Job', hinglish: 'Job' },
  vehicle:  { en: 'Vehicle No', hinglish: 'Vehicle No' },
  driver:   { en: 'Driver', hinglish: 'Driver' },
  status:   { en: 'Status', hinglish: 'Status' },
  actions:  { en: 'Actions', hinglish: 'Actions' },
  draft:    { en: 'Draft', hinglish: 'Draft' },
  dispatched:{ en: 'Dispatched', hinglish: 'Dispatched' },
  delivered:{ en: 'Delivered', hinglish: 'Delivered' },
  print:    { en: 'Print', hinglish: 'Print' },
  edit:     { en: 'Edit', hinglish: 'Edit' },
  delete:   { en: 'Delete', hinglish: 'Delete' },
  dispatch: { en: 'Dispatch', hinglish: 'Dispatch' },
  save:     { en: 'Save', hinglish: 'Save' },
  cancel:   { en: 'Cancel', hinglish: 'Cancel' },
  close:    { en: 'Close', hinglish: 'Close' },
  noDC:     { en: 'No delivery challans.', hinglish: 'No challans.' },
  confirmDelete: { en: 'Delete this challan?', hinglish: 'Delete?' },
  clientName: { en: 'Client Name', hinglish: 'Client Name' },
  clientAddr: { en: 'Client Address', hinglish: 'Client Address' },
  itemName: { en: 'Item', hinglish: 'Item' },
  qty:      { en: 'Qty', hinglish: 'Qty' },
  unit:     { en: 'Unit', hinglish: 'Unit' },
  desc:     { en: 'Description', hinglish: 'Description' },
  addItem:  { en: '+ Item', hinglish: '+ Item' },
  removeItem: { en: '✕', hinglish: '✕' },
  notes:    { en: 'Notes', hinglish: 'Notes' },
  invoiceNo:{ en: 'Invoice No', hinglish: 'Invoice No' },
  jobNo:    { en: 'Job No', hinglish: 'Job No' },
  total:    { en: 'Total', hinglish: 'Total' },
  count:    { en: 'Challans', hinglish: 'Challans' },
  dispatchedCt: { en: 'Dispatched', hinglish: 'Dispatched' },
  deliveredCt:  { en: 'Delivered', hinglish: 'Delivered' },
  search:   { en: 'Search…', hinglish: 'Search…' },
  // Print view
  printTitle: { en: 'DELIVERY CHALLAN', hinglish: 'DELIVERY CHALLAN' },
  from:     { en: 'From', hinglish: 'From' },
  to:       { en: 'To', hinglish: 'To' },
  sno:      { en: 'S.No', hinglish: 'S.No' },
  item:     { en: 'Item Description', hinglish: 'Item' },
  quantity: { en: 'Quantity', hinglish: 'Quantity' },
  sign:     { en: 'Authorized Signatory', hinglish: 'Signatory' },
  receiver: { en: "Receiver's Signature", hinglish: 'Receiver' },
};

const STATUS_COLORS = { draft: 'var(--text3)', dispatched: 'var(--amber)', delivered: 'var(--green)' };

export default function DeliveryChallansPage() {
  const t = useT(S);
  const [dcs, setDcs] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [printItem, setPrintItem] = useState(null);
  const [q, setQ] = useState('');
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const printRef = useRef();

  function emptyForm() {
    return { date: today(), clientName: '', clientId: '', clientAddress: '', invoiceNo: '', invoiceId: '', jobNo: '', jobId: '', vehicleNo: '', driverName: '', items: [{ name: '', qty: 1, unit: 'pcs', description: '' }], notes: '' };
  }

  const load = () => accountingApi.deliveryChallans().then(setDcs).catch(() => setDcs([]));
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!q) return dcs;
    const s = q.toLowerCase();
    return dcs.filter((d) => (d.dcNo || '').toLowerCase().includes(s) || (d.clientName || '').toLowerCase().includes(s));
  }, [dcs, q]);

  const countBy = (st) => dcs.filter((d) => d.status === st).length;

  const openNew = () => { setEditItem(null); setForm(emptyForm()); setShowForm(true); };
  const openEdit = (dc) => {
    setEditItem(dc);
    setForm({
      date: dc.date || today(), clientName: dc.clientName || '', clientId: dc.clientId || '',
      clientAddress: dc.clientAddress || '', invoiceNo: dc.invoiceNo || '', invoiceId: dc.invoiceId || '',
      jobNo: dc.jobNo || '', jobId: dc.jobId || '', vehicleNo: dc.vehicleNo || '', driverName: dc.driverName || '',
      items: (dc.items && dc.items.length > 0 ? dc.items : [{ name: '', qty: 1, unit: 'pcs', description: '' }]),
      notes: dc.notes || '',
    });
    setShowForm(true);
  };

  const save = async () => {
    if (!form.clientName || form.items.length === 0) return;
    setSaving(true);
    try {
      if (editItem) { await accountingApi.updateDC(editItem.id, form); }
      else { await accountingApi.createDC(form); }
      setShowForm(false); load();
    } catch (e) { alert(e?.response?.data?.error || 'Save failed'); }
    setSaving(false);
  };

  const markDispatched = async (id) => {
    try { await accountingApi.updateDC(id, { status: 'dispatched', dispatchDate: today() }); load(); } catch (e) { alert('Failed'); }
  };

  const removeDC = async (id) => {
    if (!window.confirm(t('confirmDelete'))) return;
    try { await accountingApi.deleteDC(id); load(); } catch (e) { alert('Failed'); }
  };

  const addItem = () => setForm({ ...form, items: [...form.items, { name: '', qty: 1, unit: 'pcs', description: '' }] });
  const removeItem = (i) => setForm({ ...form, items: form.items.filter((_, idx) => idx !== i) });
  const updateItem = (i, key, val) => { const items = [...form.items]; items[i] = { ...items[i], [key]: val }; setForm({ ...form, items }); };

  // Print function
  const printDC = (dc) => {
    const w = window.open('', '_blank', 'width=800,height=600');
    if (!w) return;
    w.document.write(`<html><head><title>${dc.dcNo}</title><style>
      body{font-family:Arial,sans-serif;padding:24px;color:#111;font-size:13px}
      h2{text-align:center;margin:0 0 4px;font-size:18px} .sub{text-align:center;color:#666;font-size:11px;margin-bottom:16px}
      .row{display:flex;justify-content:space-between;margin-bottom:4px} .lbl{font-weight:600}
      table{width:100%;border-collapse:collapse;margin:12px 0}
      th,td{border:1px solid #ccc;padding:5px 8px;text-align:left;font-size:12px}
      th{background:#f4f4f4;font-weight:700}
      .sig{display:flex;justify-content:space-between;margin-top:40px;font-size:11px}
      .sig div{width:40%;border-top:1px solid #999;padding-top:4px;text-align:center}
    </style></head><body>`);
    w.document.write(`<h2>${t('printTitle')}</h2>`);
    w.document.write(`<div class="sub">${dc.dcNo} · ${dc.date}</div>`);
    w.document.write(`<div class="row"><div><span class="lbl">${t('from')}:</span> ${companyName || '—'}</div><div><span class="lbl">${t('to')}:</span> ${dc.clientName}${dc.clientAddress ? '<br>' + dc.clientAddress : ''}</div></div>`);
    if (dc.vehicleNo || dc.driverName) w.document.write(`<div class="row"><div><span class="lbl">${t('vehicle')}:</span> ${dc.vehicleNo || '—'}</div><div><span class="lbl">${t('driver')}:</span> ${dc.driverName || '—'}</div></div>`);
    if (dc.invoiceNo || dc.jobNo) w.document.write(`<div class="row"><div>${dc.invoiceNo ? `<span class="lbl">${t('invoiceNo')}:</span> ${dc.invoiceNo}` : ''}</div><div>${dc.jobNo ? `<span class="lbl">${t('jobNo')}:</span> ${dc.jobNo}` : ''}</div></div>`);
    w.document.write('<table><thead><tr><th>' + t('sno') + '</th><th>' + t('item') + '</th><th>' + t('quantity') + '</th><th>' + t('desc') + '</th></tr></thead><tbody>');
    (dc.items || []).forEach((it, i) => {
      w.document.write(`<tr><td>${i + 1}</td><td>${it.name || '—'}</td><td>${it.qty} ${it.unit || 'pcs'}</td><td>${it.description || ''}</td></tr>`);
    });
    w.document.write('</tbody></table>');
    if (dc.notes) w.document.write(`<div style="margin-top:8px"><b>Notes:</b> ${dc.notes}</div>`);
    w.document.write(`<div class="sig"><div>${t('sign')}</div><div>${t('receiver')}</div></div>`);
    w.document.write('</body></html>');
    w.document.close(); w.focus(); w.print();
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>{t('title')}</h2>
        <button className="btn btn-primary" onClick={openNew}>+ {t('newDC')}</button>
      </div>

      <KpiGrid>
        <Kpi label={t('count')} value={dcs.length} icon="🚚" color="var(--text)" />
        <Kpi label={t('draft')} value={countBy('draft')} icon="📝" color="var(--text3)" />
        <Kpi label={t('dispatchedCt')} value={countBy('dispatched')} icon="🚛" color="var(--amber)" />
        <Kpi label={t('deliveredCt')} value={countBy('delivered')} icon="✅" color="var(--green)" />
      </KpiGrid>

      <input type="text" placeholder={t('search')} value={q} onChange={(e) => setQ(e.target.value)}
        style={{ width: '100%', maxWidth: 320, padding: '7px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13, marginBottom: 12, boxSizing: 'border-box' }} />

      {filtered.length === 0 ? (
        <div style={{ color: 'var(--text3)', fontSize: 13, padding: '24px 0', textAlign: 'center' }}>{t('noDC')}</div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'auto' }}>
          <table className="table table-sm" style={{ minWidth: 700, margin: 0 }}>
            <thead>
              <tr>
                <th>{t('dcNo')}</th><th>{t('date')}</th><th>{t('client')}</th>
                <th>{t('invoice')}</th><th>{t('vehicle')}</th><th>{t('status')}</th>
                <th style={{ width: 160 }}>{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((dc) => (
                <tr key={dc.id}>
                  <td style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 600 }}>{dc.dcNo}</td>
                  <td style={{ fontSize: 12 }}>{dc.date}</td>
                  <td>{dc.clientName}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{dc.invoiceNo || '—'}</td>
                  <td style={{ fontSize: 12 }}>{dc.vehicleNo || '—'}</td>
                  <td>
                    <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: STATUS_COLORS[dc.status] || 'var(--text3)', color: '#fff' }}>
                      {t(dc.status || 'draft')}
                    </span>
                  </td>
                  <td>
                    <button className="btn btn-xs btn-ghost" onClick={() => printDC(dc)}>{t('print')}</button>
                    {dc.status === 'draft' && <button className="btn btn-xs btn-ghost" style={{ color: 'var(--amber)' }} onClick={() => markDispatched(dc.id)}>{t('dispatch')}</button>}
                    {dc.status === 'draft' && <button className="btn btn-xs btn-ghost" onClick={() => openEdit(dc)}>{t('edit')}</button>}
                    <button className="btn btn-xs btn-ghost" style={{ color: 'var(--red)' }} onClick={() => removeDC(dc.id)}>{t('delete')}</button>
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
          <div className="card" style={{ width: '100%', maxWidth: 600, padding: 20, maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>{editItem ? `${t('edit')} ${editItem.dcNo}` : t('newDC')}</h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div className="form-group"><label>{t('date')}</label><input className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
              <div className="form-group"><label>{t('clientName')}</label><input className="input" value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })} /></div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}><label>{t('clientAddr')}</label><input className="input" value={form.clientAddress} onChange={(e) => setForm({ ...form, clientAddress: e.target.value })} /></div>
              <div className="form-group"><label>{t('invoiceNo')}</label><input className="input" value={form.invoiceNo} onChange={(e) => setForm({ ...form, invoiceNo: e.target.value })} /></div>
              <div className="form-group"><label>{t('jobNo')}</label><input className="input" value={form.jobNo} onChange={(e) => setForm({ ...form, jobNo: e.target.value })} /></div>
              <div className="form-group"><label>{t('vehicle')}</label><input className="input" value={form.vehicleNo} onChange={(e) => setForm({ ...form, vehicleNo: e.target.value })} /></div>
              <div className="form-group"><label>{t('driver')}</label><input className="input" value={form.driverName} onChange={(e) => setForm({ ...form, driverName: e.target.value })} /></div>
            </div>

            <div style={{ marginBottom: 12 }}>
              {form.items.map((it, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 2fr auto', gap: 6, marginBottom: 6, alignItems: 'center' }}>
                  <input className="input" placeholder={t('itemName')} value={it.name} onChange={(e) => updateItem(i, 'name', e.target.value)} />
                  <input className="input" type="number" min="0" placeholder={t('qty')} value={it.qty} onChange={(e) => updateItem(i, 'qty', e.target.value)} />
                  <input className="input" placeholder={t('unit')} value={it.unit} onChange={(e) => updateItem(i, 'unit', e.target.value)} />
                  <input className="input" placeholder={t('desc')} value={it.description} onChange={(e) => updateItem(i, 'description', e.target.value)} />
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
