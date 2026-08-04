/**
 * Batches & Variants — the operational side of Inventory.
 *
 * Batches are named receipts (batch no + expiry) with their own cost; issues
 * walk batches FIFO (oldest first) or FEFO (soonest expiry first) so near-expiry
 * stock goes out first and COGS is valued at the consumed batches' actual cost.
 * Variants are sub-lines of an item (size/colour/etc.), each carrying its own qty.
 *
 * The parent InventoryPage mounts this inside its "Batches & Variants" tab.
 */
import { useEffect, useMemo, useState } from 'react';
import { stockApi } from '../../services/api';
import { useT } from '../../i18n/LanguageContext';
import { inr } from '../../components/common/DashboardCharts';

const today = () => new Date().toISOString().slice(0, 10);

const S = {
  search:      { en: 'Search items…', hinglish: 'Search…' },
  none:        { en: 'No stock items.', hinglish: 'No items.' },
  itemH:       { en: 'Item', hinglish: 'Item' },
  sourceH:     { en: 'Source', hinglish: 'Source' },
  qtyH:        { en: 'Qty', hinglish: 'Qty' },
  batchesH:    { en: 'Batches', hinglish: 'Batches' },
  variantsH:   { en: 'Variants', hinglish: 'Variants' },
  product:     { en: 'Product', hinglish: 'Product' },
  material:    { en: 'Material', hinglish: 'Material' },
  expand:      { en: 'Open', hinglish: 'Open' },
  close:       { en: 'Close', hinglish: 'Close' },
  receive:     { en: 'Receive', hinglish: 'Receive' },
  issue:       { en: 'Issue', hinglish: 'Issue' },
  addVariant:  { en: '+ Variant', hinglish: '+ Variant' },
  removeVar:   { en: '✕', hinglish: '✕' },
  noBatches:   { en: 'No batches yet — receive stock to create one.', hinglish: 'No batches.' },
  noVariants:  { en: 'No variants.', hinglish: 'No variants.' },
  batchNo:     { en: 'Batch No', hinglish: 'Batch No' },
  expiry:      { en: 'Expiry', hinglish: 'Expiry' },
  bqty:        { en: 'Qty', hinglish: 'Qty' },
  cost:        { en: 'Cost', hinglish: 'Cost' },
  recvTitle:   { en: 'Receive into Batch', hinglish: 'Receive into Batch' },
  issueTitle:  { en: 'Issue from Stock', hinglish: 'Issue from Stock' },
  varTitle:    { en: 'Add / Edit Variant', hinglish: 'Variant' },
  itemName:    { en: 'Item', hinglish: 'Item' },
  qty:         { en: 'Quantity', hinglish: 'Quantity' },
  rate:        { en: 'Cost / unit', hinglish: 'Cost' },
  date:        { en: 'Date', hinglish: 'Date' },
  method:      { en: 'Method', hinglish: 'Method' },
  specific:    { en: 'Specific batch', hinglish: 'Specific batch' },
  fifo:        { en: 'FIFO (oldest first)', hinglish: 'FIFO' },
  fefo:        { en: 'FEFO (expiry first)', hinglish: 'FEFO' },
  reason:      { en: 'Reason', hinglish: 'Reason' },
  save:        { en: 'Save', hinglish: 'Save' },
  cancel:      { en: 'Cancel', hinglish: 'Cancel' },
  variantName: { en: 'Variant name', hinglish: 'Name' },
  sku:         { en: 'SKU', hinglish: 'SKU' },
  unit:        { en: 'Unit', hinglish: 'Unit' },
  name:        { en: 'Name', hinglish: 'Name' },
  chooseBatch: { en: 'Consume from', hinglish: 'From' },
  confirmDel:  { en: 'Delete this variant?', hinglish: 'Delete?' },
  all:         { en: 'All', hinglish: 'All' },
};

export default function BatchesTab() {
  const t = useT(S);
  const [items, setItems] = useState([]);
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState(null);
  const [modal, setModal] = useState(null); // { kind:'receive'|'issue'|'variant', item }
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  const load = () => stockApi.items({ withBatches: 1, withVariants: 1 }).then(setItems).catch(() => setItems([]));
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!q) return items;
    const s = q.toLowerCase();
    return items.filter((i) => (i.name || '').toLowerCase().includes(s));
  }, [items, q]);

  const batchCount = (item) => (item.batches || []).reduce((s, b) => s + (Number(b.qty) || 0), 0);
  const isExpired = (b) => b.expired;

  const openReceive = (item) => { setModal({ kind: 'receive', item }); setForm({ qty: 1, rate: '', batchNo: '', expiryDate: '', date: today() }); };
  const openIssue = (item) => {
    const batches = (item.batches || []).filter((b) => (Number(b.qty) || 0) > 0);
    setModal({ kind: 'issue', item });
    setForm({ qty: 1, method: 'fefo', reason: '', batchId: batches.length === 1 ? batches[0].id : '' });
  };
  const openVariant = (item, v) => {
    setModal({ kind: 'variant', item, variant: v || null });
    setForm(v ? { name: v.name, sku: v.sku || '', qty: v.qty, cost: v.cost ?? '', unit: v.unit || '' } : { name: '', sku: '', qty: 0, cost: '', unit: '' });
  };

  const save = async () => {
    setSaving(true);
    try {
      const item = modal.item;
      if (modal.kind === 'receive') {
        await stockApi.receiveBatch({
          itemId: item.id, source: item.source,
          batchNo: form.batchNo || null, expiryDate: form.expiryDate || null,
          qty: Number(form.qty), rate: form.rate !== '' ? Number(form.rate) : undefined,
          date: form.date,
        });
      } else if (modal.kind === 'issue') {
        await stockApi.issueBatch({
          itemId: item.id, source: item.source,
          batchId: form.batchId || undefined,
          qty: Number(form.qty), method: form.batchId ? undefined : form.method,
          reason: form.reason || null,
        });
      } else if (modal.kind === 'variant') {
        await stockApi.addVariant({
          itemId: item.id, source: item.source,
          variant: {
            id: modal.variant ? modal.variant.id : undefined,
            name: form.name, sku: form.sku || null, qty: Number(form.qty) || 0,
            cost: form.cost !== '' ? Number(form.cost) : undefined, unit: form.unit || null,
          },
        });
      }
      setModal(null); load();
    } catch (e) { alert(e?.response?.data?.error || 'Failed'); }
    setSaving(false);
  };

  const removeVariant = async (item, v) => {
    if (!window.confirm(t('confirmDel'))) return;
    try { await stockApi.deleteVariant(v.id, { itemId: item.id, source: item.source }); load(); }
    catch (e) { alert(e?.response?.data?.error || 'Failed'); }
  };

  return (
    <div>
      <input type="text" placeholder={t('search')} value={q} onChange={(e) => setQ(e.target.value)}
        style={{ width: '100%', maxWidth: 320, padding: '7px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13, marginBottom: 12, boxSizing: 'border-box' }} />

      {filtered.length === 0 ? (
        <div style={{ color: 'var(--text3)', fontSize: 13, padding: '24px 0', textAlign: 'center' }}>{t('none')}</div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'auto' }}>
          <table className="table table-sm" style={{ minWidth: 640, margin: 0 }}>
            <thead>
              <tr>
                <th>{t('itemH')}</th><th>{t('sourceH')}</th><th>{t('qtyH')}</th>
                <th>{t('batchesH')}</th><th>{t('variantsH')}</th><th style={{ width: 90 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const batches = (item.batches || []).filter((b) => (Number(b.qty) || 0) > 0);
                const variants = item.variants || [];
                return (
                  <tr key={item.id}>
                    <td style={{ fontWeight: 500 }}>{item.name || '—'}</td>
                    <td>
                      <span style={{ padding: '1px 6px', borderRadius: 4, fontSize: 11, background: item.source === 'product' ? 'var(--blue)' : 'var(--amber)', color: '#fff' }}>
                        {item.source === 'product' ? t('product') : t('material')}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{item.qty || 0}</td>
                    <td style={{ fontSize: 12 }}>{batches.length > 0 ? `${batches.length} (${batchCount(item)} u)` : '—'}</td>
                    <td style={{ fontSize: 12 }}>{variants.length > 0 ? variants.length : '—'}</td>
                    <td>
                      <button className="btn btn-xs btn-ghost" onClick={() => setOpenId(openId === item.id ? null : item.id)}>
                        {openId === item.id ? t('close') : t('expand')}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Expanded item detail */}
      {filtered.map((item) => {
        if (openId !== item.id) return null;
        const batches = (item.batches || []).filter((b) => (Number(b.qty) || 0) > 0);
        const variants = item.variants || [];
        return (
          <div key={item.id} className="card" style={{ marginTop: 12, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
              <h4 style={{ fontSize: 15, fontWeight: 600 }}>{item.name || '—'}</h4>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-xs btn-primary" onClick={() => openReceive(item)}>+ {t('receive')}</button>
                <button className="btn btn-xs btn-ghost" style={{ color: 'var(--amber)' }} onClick={() => openIssue(item)}>{t('issue')}</button>
                <button className="btn btn-xs btn-ghost" onClick={() => openVariant(item, null)}>{t('addVariant')}</button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {/* Batches */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', marginBottom: 6 }}>{t('batchesH')}</div>
                {batches.length === 0 ? (
                  <div style={{ color: 'var(--text3)', fontSize: 12 }}>{t('noBatches')}</div>
                ) : (
                  <table className="table table-sm" style={{ margin: 0 }}>
                    <thead>
                      <tr><th>{t('batchNo')}</th><th>{t('expiry')}</th><th>{t('bqty')}</th><th>{t('cost')}</th></tr>
                    </thead>
                    <tbody>
                      {batches.map((b) => (
                        <tr key={b.id}>
                          <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{b.batchNo || '—'}</td>
                          <td style={{ fontSize: 12, color: isExpired(b) ? 'var(--red)' : 'var(--text)' }}>
                            {b.expiryDate || '—'} {isExpired(b) ? '⚠' : ''}
                          </td>
                          <td style={{ fontSize: 12 }}>{b.qty}</td>
                          <td style={{ fontSize: 12 }}>{inr(b.cost)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Variants */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', marginBottom: 6 }}>{t('variantsH')}</div>
                {variants.length === 0 ? (
                  <div style={{ color: 'var(--text3)', fontSize: 12 }}>{t('noVariants')}</div>
                ) : (
                  <table className="table table-sm" style={{ margin: 0 }}>
                    <thead>
                      <tr><th>{t('name')}</th><th>{t('sku')}</th><th>{t('bqty')}</th><th>{t('cost')}</th><th></th></tr>
                    </thead>
                    <tbody>
                      {variants.map((v) => (
                        <tr key={v.id}>
                          <td style={{ fontSize: 12, fontWeight: 500 }}>{v.name}</td>
                          <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{v.sku || '—'}</td>
                          <td style={{ fontSize: 12 }}>{v.qty}</td>
                          <td style={{ fontSize: 12 }}>{inr(v.cost)}</td>
                          <td>
                            <button className="btn btn-xs btn-ghost" style={{ color: 'var(--blue)' }} onClick={() => openVariant(item, v)}>{t('expand')}</button>
                            <button className="btn btn-xs btn-ghost" style={{ color: 'var(--red)' }} onClick={() => removeVariant(item, v)}>{t('removeVar')}</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* Modal */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
          onClick={(e) => { if (e.target === e.currentTarget) setModal(null); }}>
          <div className="card" style={{ width: '100%', maxWidth: 440, padding: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
              {modal.kind === 'receive' && t('recvTitle')}
              {modal.kind === 'issue' && t('issueTitle')}
              {modal.kind === 'variant' && t('varTitle')}
            </h3>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 14 }}>{modal.item.name}</div>

            {modal.kind === 'receive' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="form-group"><label>{t('batchNo')}</label><input className="input" value={form.batchNo} onChange={(e) => setForm({ ...form, batchNo: e.target.value })} /></div>
                <div className="form-group"><label>{t('expiry')}</label><input className="input" type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} /></div>
                <div className="form-group"><label>{t('qty')} *</label><input className="input" type="number" min="1" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} /></div>
                <div className="form-group"><label>{t('rate')}</label><input className="input" type="number" min="0" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} /></div>
                <div className="form-group"><label>{t('date')}</label><input className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
              </div>
            )}

            {modal.kind === 'issue' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}><label>{t('qty')} *</label><input className="input" type="number" min="1" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} /></div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}><label>{t('chooseBatch')}</label>
                  <select className="input" value={form.batchId || ''} onChange={(e) => setForm({ ...form, batchId: e.target.value })}>
                    <option value="">{t('all')}</option>
                    {(modal.item.batches || []).filter((b) => (Number(b.qty) || 0) > 0).map((b) => (
                      <option key={b.id} value={b.id}>{b.batchNo || b.id} ({b.qty} u)</option>
                    ))}
                  </select>
                </div>
                {!form.batchId && (
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}><label>{t('method')}</label>
                    <select className="input" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
                      <option value="fefo">{t('fefo')}</option>
                      <option value="fifo">{t('fifo')}</option>
                    </select>
                  </div>
                )}
                <div className="form-group" style={{ gridColumn: '1 / -1' }}><label>{t('reason')}</label><input className="input" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
              </div>
            )}

            {modal.kind === 'variant' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="form-group"><label>{t('variantName')} *</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div className="form-group"><label>{t('sku')}</label><input className="input" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></div>
                <div className="form-group"><label>{t('qty')}</label><input className="input" type="number" min="0" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} /></div>
                <div className="form-group"><label>{t('cost')}</label><input className="input" type="number" min="0" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} /></div>
                <div className="form-group"><label>{t('unit')}</label><input className="input" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="btn btn-ghost" onClick={() => setModal(null)}>{t('cancel')}</button>
              <button className="btn btn-primary" disabled={saving} onClick={save}>{saving ? '…' : t('save')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
