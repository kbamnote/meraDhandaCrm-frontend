/**
 * Purchases — /accounting/purchases. Purchase invoices from suppliers with a
 * proper Input-GST split. Saving a RECEIVED purchase posts a ledger entry:
 *   Dr Inventory (subtotal) · Dr CGST/SGST/IGST Input Credit · Cr AP (total)
 * so the P&L, Balance Sheet and supplier statements all pick it up
 * automatically (see posting.purchaseLines). Quantity stock-in stays a separate
 * stock-move on the Stock page.
 */
import { useEffect, useMemo, useState } from 'react';
import { ref, onValue, db } from '../../services/realtime';
import { dbApi, ledgerApi, stockApi } from '../../services/api';
import { useT } from '../../i18n/LanguageContext';
import { showToast } from '../../components/common/toast';
import { Kpi, KpiGrid, inr } from '../../components/common/DashboardCharts';

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const S = {
  title:    { en: 'Purchases', hi: 'खरीद', hinglish: 'Purchases' },
  newInvoice: { en: '+ New Purchase Invoice', hi: '+ नई खरीद इनवॉइस', hinglish: '+ Naya Purchase Invoice' },
  purchases: { en: 'Purchases', hi: 'खरीद', hinglish: 'Purchases' },
  inputGst: { en: 'Input GST', hi: 'इनपुट GST', hinglish: 'Input GST' },
  payable:  { en: 'Payable to suppliers', hi: 'देय', hinglish: 'Payable' },
  stockValue: { en: 'Stock value', hi: 'स्टॉक मूल्य', hinglish: 'Stock value' },
  poNo:     { en: 'PO / Invoice No', hi: 'PO नंबर', hinglish: 'PO No' },
  vendor:   { en: 'Vendor', hi: 'विक्रेता', hinglish: 'Vendor' },
  date:     { en: 'Date', hi: 'दिनांक', hinglish: 'Date' },
  total:    { en: 'Total', hi: 'कुल', hinglish: 'Total' },
  status:   { en: 'Status', hi: 'स्थिति', hinglish: 'Status' },
  draft:    { en: 'Draft', hi: 'ड्राफ्ट', hinglish: 'Draft' },
  sent:     { en: 'Sent', hi: 'भेजा', hinglish: 'Sent' },
  received: { en: 'Received', hi: 'प्राप्त', hinglish: 'Received' },
  none:     { en: 'No purchase invoices yet.', hi: 'अभी कोई खरीद नहीं।', hinglish: 'Abhi koi purchase nahi.' },
  close:    { en: 'Close', hi: 'बंद करें', hinglish: 'Close' },
  save:     { en: 'Save & post', hi: 'सहेजें', hinglish: 'Save' },
  failed:   { en: 'Failed', hi: 'नहीं हुआ', hinglish: 'Fail hua' },
  saved:    { en: 'Purchase invoice posted', hi: 'खरीद इनवॉइस पोस्ट', hinglish: 'Purchase posted' },
  item:     { en: 'Item', hi: 'आइटम', hinglish: 'Item' },
  qty:      { en: 'Qty', hinglish: 'Qty' },
  rate:     { en: 'Rate', hinglish: 'Rate' },
  amount:   { en: 'Amount', hinglish: 'Amount' },
  addItem:  { en: '+ Add item', hi: '+ आइटम', hinglish: '+ Add item' },
  selectVendor: { en: 'Select vendor…', hinglish: 'Vendor chuno…' },
  gstRate:  { en: 'GST rate', hinglish: 'GST rate' },
  intra:    { en: 'Intra-state (CGST+SGST)', hinglish: 'Intra-state (CGST+SGST)' },
  inter:    { en: 'Inter-state (IGST)', hinglish: 'Inter-state (IGST)' },
  subtotal: { en: 'Subtotal', hinglish: 'Subtotal' },
  itemsNeed: { en: 'Add at least one item with a rate.', hinglish: 'Kam se kam ek item dalo.' },
  markReceived: { en: 'Mark received', hi: 'प्राप्त किया', hinglish: 'Mark received' },
  delete:   { en: 'Delete', hi: 'हटाएँ', hinglish: 'Delete' },
  confirmDel: { en: 'Delete this purchase? Its ledger entry will be removed too.', hi: 'यह खरीद हटाएँ?', hinglish: 'Yeh purchase delete karein?' },
  notes:    { en: 'Notes', hinglish: 'Notes' },
  items:    { en: 'Items', hinglish: 'Items' },
  hint:     { en: 'A received purchase posts to Inventory + Input GST + Supplier payable in the ledger. Add stock quantity separately from the Stock page.', hinglish: 'Received purchase ledger mein Inventory + Input GST + Supplier payable post hota hai.' },
};

const GST_RATES = ['0', '5', '12', '18', '28'];

const STATUS_STYLE = (s) => s === 'received' ? { background: 'var(--green, #1F9D55)', color: '#fff' }
  : s === 'sent' ? { background: 'var(--blue, #C05621)', color: '#fff' }
  : { background: 'var(--surface2)', color: 'var(--text3)' };

const vendorName = (v) => (v && (v.name || v.company || v.title)) || '—';

export default function PurchasesPage() {
  const t = useT(S);
  const [pos, setPos] = useState({});
  const [accounts, setAccounts] = useState([]);
  const [valuation, setValuation] = useState(0);
  const [showNew, setShowNew] = useState(false);
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    const off = onValue(ref(db, 'mpw/purchaseOrders'), (s) => setPos(s.val() || {}));
    ledgerApi.accounts().then(setAccounts).catch(() => setAccounts([]));
    stockApi.valuation().then((v) => setValuation(v && v.value != null ? v.value : 0)).catch(() => setValuation(0));
    return off;
  }, []);

  const acct = (k) => accounts.find((a) => a.key === k)?.balance || 0;
  const purchases = round2(acct('purchases'));
  const inputGst = round2(acct('cgst_input') + acct('sgst_input') + acct('igst_input'));
  const payable = round2(acct('ap'));

  const rows = useMemo(() => Object.entries(pos)
    .map(([id, p]) => ({ id, ...p }))
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || (b.createdAt || 0) - (a.createdAt || 0)), [pos]);

  const markReceived = async (id) => {
    try { await dbApi.update('purchaseOrders', id, { status: 'received' }); showToast('✅ ' + t('markReceived'), 'success'); }
    catch (e) { showToast(e.response?.data?.error || t('failed'), 'error'); }
  };

  const remove = async (id) => {
    if (!window.confirm(t('confirmDel'))) return;
    try { await dbApi.remove('purchaseOrders', id); showToast('🗑 ' + t('delete'), 'success'); }
    catch (e) { showToast(e.response?.data?.error || t('failed'), 'error'); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4" style={{ flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>{t('title')}</h2>
        <button className="btn btn-primary btn-sm" onClick={() => setShowNew(true)}>{t('newInvoice')}</button>
      </div>

      <KpiGrid>
        <Kpi label={t('purchases')} value={inr(purchases)} icon="🧾" color="var(--red)" />
        <Kpi label={t('inputGst')} value={inr(inputGst)} icon="🧮" color="var(--blue)" />
        <Kpi label={t('payable')} value={inr(payable)} icon="🏦" color="var(--amber)" />
        <Kpi label={t('stockValue')} value={inr(valuation)} icon="📦" color="var(--green)" />
      </KpiGrid>

      <div className="card" style={{ padding: '10px 14px', marginBottom: 14, fontSize: 12, color: 'var(--text3)' }}>
        💡 {t('hint')}
      </div>

      {rows.length === 0 && <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>{t('none')}</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rows.map((p) => {
          const isOpen = openId === p.id;
          const st = String(p.status || 'draft').toLowerCase();
          return (
            <div key={p.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <button type="button" onClick={() => setOpenId(isOpen ? null : p.id)}
                style={{ display: 'flex', gap: 12, alignItems: 'center', width: '100%', textAlign: 'left', padding: '12px 14px', background: 'none', border: 'none', borderBottom: isOpen ? '1px solid var(--border)' : 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text)', flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{p.poNo || p.invoiceNo || '—'}</span>
                <span style={{ fontWeight: 600, flex: 1, minWidth: 140 }}>{p.vendorName || vendorName({ name: p.vendor }) || '—'}</span>
                <span style={{ color: 'var(--text2)', fontSize: 12 }}>{p.date}</span>
                <span className="badge" style={STATUS_STYLE(st)}>{t(st) || st}</span>
                <span style={{ fontWeight: 700, marginLeft: 'auto' }}>{inr(p.total || 0)}</span>
              </button>
              {isOpen && (
                <div style={{ padding: '12px 14px' }}>
                  {(p.items && p.items.length > 0) && (
                    <div style={{ overflow: 'auto' }}>
                      <table className="table table-sm" style={{ margin: 0, minWidth: 420 }}>
                        <thead><tr><th>{t('item')}</th><th style={{ textAlign: 'right' }}>{t('qty')}</th><th style={{ textAlign: 'right' }}>{t('rate')}</th><th style={{ textAlign: 'right' }}>{t('amount')}</th></tr></thead>
                        <tbody>
                          {p.items.map((it, i) => (
                            <tr key={i}>
                              <td>{it.name}</td>
                              <td style={{ textAlign: 'right' }}>{it.qty}</td>
                              <td style={{ textAlign: 'right' }}>{inr(it.rate)}</td>
                              <td style={{ textAlign: 'right', fontWeight: 600 }}>{inr(it.amount || (Number(it.qty) || 0) * (Number(it.rate) || 0))}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, marginTop: 10, fontSize: 12 }}>
                    <div><span style={{ color: 'var(--text3)' }}>{t('subtotal')}</span><br /><b>{inr(p.subtotal != null ? p.subtotal : (p.total || 0))}</b></div>
                    <div><span style={{ color: 'var(--text3)' }}>CGST</span><br />{inr(p.cgst || 0)}</div>
                    <div><span style={{ color: 'var(--text3)' }}>SGST</span><br />{inr(p.sgst || 0)}</div>
                    <div><span style={{ color: 'var(--text3)' }}>IGST</span><br />{inr(p.igst || 0)}</div>
                    <div><span style={{ color: 'var(--text3)' }}>{t('total')}</span><br /><b>{inr(p.total || 0)}</b></div>
                  </div>
                  {p.notes && <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 8 }}>📝 {p.notes}</div>}
                  <div className="flex" style={{ gap: 6, marginTop: 10 }}>
                    {st !== 'received' && <button className="btn btn-sm btn-primary" onClick={() => markReceived(p.id)}>{t('markReceived')}</button>}
                    <button className="btn btn-sm btn-ghost" style={{ color: 'var(--red)' }} onClick={() => remove(p.id)}>{t('delete')}</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showNew && <NewInvoiceModal t={t} onClose={() => setShowNew(false)} />}
    </div>
  );
}

function NewInvoiceModal({ t, onClose }) {
  const [vendors, setVendors] = useState([]);
  const [vendorId, setVendorId] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [poNo, setPoNo] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [gstType, setGstType] = useState('intra');
  const [gstRate, setGstRate] = useState('18');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([{ name: '', qty: '', rate: '' }]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    dbApi.list('vendors').then((m) => {
      setVendors(Object.entries(m).map(([id, v]) => ({ id, name: vendorName(v) })).filter((x) => x.name !== '—'));
    }).catch(() => setVendors([]));
  }, []);

  const setItem = (i, patch) => setItems((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const num = (v) => Number(v) || 0;

  const subtotal = round2(items.reduce((s, it) => s + round2(num(it.qty) * num(it.rate)), 0));
  const taxAmt = round2(subtotal * (num(gstRate) / 100));
  const cgst = gstType === 'intra' ? round2(subtotal * (num(gstRate) / 200)) : 0;
  const sgst = gstType === 'intra' ? round2(taxAmt - cgst) : 0;
  const igst = gstType === 'inter' ? taxAmt : 0;
  const total = round2(subtotal + cgst + sgst + igst);
  const valid = vendorId && items.some((it) => it.name.trim() && num(it.rate) > 0) && subtotal > 0;

  const save = async () => {
    if (!valid) { showToast(t('itemsNeed'), 'error'); return; }
    setSaving(true);
    const cleanItems = items
      .filter((it) => it.name.trim() && (num(it.qty) > 0 || num(it.rate) > 0))
      .map((it) => ({ name: it.name.trim(), qty: num(it.qty), rate: num(it.rate), amount: round2(num(it.qty) * num(it.rate)) }));
    try {
      await dbApi.create('purchaseOrders', {
        poNo: poNo.trim() || undefined,
        invoiceNo: poNo.trim() || undefined,
        vendorId: vendorId || undefined,
        vendorName: vendorName || undefined,
        date,
        gstType, gstRate: num(gstRate),
        items: cleanItems,
        subtotal, cgst, sgst, igst, total,
        status: 'received',
        notes: notes.trim() || undefined,
        createdAt: Date.now(),
      });
      showToast('✅ ' + t('saved'), 'success');
      onClose();
    } catch (e) {
      showToast(e.response?.data?.error || t('failed'), 'error');
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div className="card" style={{ maxWidth: 660, width: '100%', maxHeight: '88vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
          <h3 style={{ fontSize: 17, fontWeight: 700 }}>{t('newInvoice')}</h3>
          <button className="btn btn-sm btn-ghost" onClick={onClose}>{t('close')}</button>
        </div>

        <div className="flex gap-2" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
          <div className="form-group" style={{ margin: 0, flex: 1, minWidth: 220 }}>
            <label>{t('vendor')}</label>
            <select className="input" value={vendorId} onChange={(e) => {
              const v = vendors.find((x) => x.id === e.target.value);
              setVendorId(e.target.value); setVendorName(v ? v.name : '');
            }}>
              <option value="">{t('selectVendor')}</option>
              {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ margin: 0 }}><label>{t('poNo')}</label><input className="input" value={poNo} onChange={(e) => setPoNo(e.target.value)} /></div>
          <div className="form-group" style={{ margin: 0 }}><label>{t('date')}</label><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        </div>

        <div className="flex gap-2" style={{ marginBottom: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label>{t('gstRate')}</label>
            <select className="input" value={gstRate} onChange={(e) => setGstRate(e.target.value)}>
              {GST_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}
            </select>
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label>{t('status')}</label>
            <select className="input" value={gstType} onChange={(e) => setGstType(e.target.value)}>
              <option value="intra">{t('intra')}</option>
              <option value="inter">{t('inter')}</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 90px 90px 32px', gap: 8, padding: '8px 10px', fontSize: 11, textTransform: 'uppercase', color: 'var(--text3)', fontWeight: 700, borderBottom: '1px solid var(--border)' }}>
          <div>{t('item')}</div><div style={{ textAlign: 'right' }}>{t('qty')}</div><div style={{ textAlign: 'right' }}>{t('rate')}</div><div style={{ textAlign: 'right' }}>{t('amount')}</div><div />
        </div>
        {items.map((it, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 90px 90px 32px', gap: 8, padding: '6px 10px', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
            <input className="input" placeholder={t('item')} value={it.name} onChange={(e) => setItem(i, { name: e.target.value })} />
            <input className="input" type="number" placeholder="0" value={it.qty} onChange={(e) => setItem(i, { qty: e.target.value })} />
            <input className="input" type="number" placeholder="0" value={it.rate} onChange={(e) => setItem(i, { rate: e.target.value })} />
            <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 600 }}>{inr(round2(num(it.qty) * num(it.rate)))}</div>
            <button type="button" className="btn btn-xs btn-ghost" style={{ color: 'var(--red)' }} disabled={items.length <= 1} onClick={() => setItems((rs) => rs.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}
        <div style={{ padding: '8px 10px' }}>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => setItems((rs) => [...rs, { name: '', qty: '', rate: '' }])}>{t('addItem')}</button>
        </div>

        <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '2px 0' }}><span style={{ color: 'var(--text3)' }}>{t('subtotal')}</span><span>{inr(subtotal)}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '2px 0' }}><span style={{ color: 'var(--text3)' }}>CGST / SGST / IGST</span><span>{inr(cgst)} / {inr(sgst)} / {inr(igst)}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 700, padding: '4px 0', borderTop: '1px solid var(--border)', marginTop: 4 }}><span>{t('total')}</span><span>{inr(total)}</span></div>
        </div>

        <div className="flex items-center justify-between" style={{ padding: '10px 12px', borderTop: '1px solid var(--border)' }}>
          <span style={{ fontSize: 11, color: 'var(--text3)' }}>{t('hint')}</span>
          <div className="flex" style={{ gap: 6 }}>
            <button className="btn btn-sm btn-ghost" onClick={onClose}>{t('close')}</button>
            <button className="btn btn-sm btn-primary" disabled={!valid || saving} onClick={save}>{saving ? '…' : t('save')}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
