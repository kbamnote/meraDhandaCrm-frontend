/**
 * Purchases — /accounting/purchases. Purchase invoices from suppliers with a
 * proper Input-GST split. Recording a bill (CreatePurchaseFlow) posts to the
 * ledger immediately — Dr Inventory + input GST, Cr the supplier — so the P&L,
 * Balance Sheet and supplier statements all pick it up without a second step.
 * Older purchase ORDERS listed here post only once marked received. Quantity
 * stock-in stays a separate stock-move on the Stock page.
 */
import { useEffect, useMemo, useState } from 'react';
import { ref, onValue, db } from '../../services/realtime';
import { dbApi, ledgerApi, stockApi } from '../../services/api';
import { useT } from '../../i18n/LanguageContext';
import { showToast } from '../../components/common/toast';
import { Kpi, KpiGrid, inr } from '../../components/common/DashboardCharts';
import CreatePurchaseFlow from '../../components/common/CreatePurchaseFlow';
import PurchaseBulkUpload from '../../components/common/PurchaseBulkUpload';

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
  const [showImport, setShowImport] = useState(false);
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
        <div className="flex" style={{ gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowImport((v) => !v)}>
            {showImport ? '✕ Close import' : '📥 Import Excel'}
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowNew(true)}>{t('newInvoice')}</button>
        </div>
      </div>

      {showImport && (
        <div className="card" style={{ padding: 16, marginBottom: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>Import purchase bills from Excel</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>
            One row per bill. Nothing is written until you review the preview.
          </div>
          <PurchaseBulkUpload onImported={() => setShowImport(false)} />
        </div>
      )}

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

      {showNew && <CreatePurchaseFlow onClose={() => setShowNew(false)} />}
    </div>
  );
}
