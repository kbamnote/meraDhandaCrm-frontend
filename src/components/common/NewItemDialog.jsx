/**
 * "That item isn't in your list yet — add it?"
 *
 * Typing a name into an invoice line used to do nothing but print that text on
 * the bill: the line carried no `itemId`, so it was never a catalog item and
 * stock never moved for it. Sell 200 of something that way and the stock report
 * still says you have everything you started with.
 *
 * This turns the typed name into a real product before the invoice is saved, so
 * the existing deduction picks it up like any other catalog line.
 *
 * The field that matters is OPENING STOCK, and it is the one that is easy to get
 * wrong. It means what is on the shelf BEFORE this bill, not after — so the
 * dialog says so and shows the resulting figure live, because "50, and this
 * invoice leaves 40" is checkable at a glance in a way that a bare number is not.
 *
 * Props:
 *   name         — the text already typed on the line
 *   billingQty   — qty on that line, used only to show the after-figure
 *   defaultRate  — the line's price, prefilled as the sale price
 *   defaultGst   — the invoice's GST rate, prefilled
 *   context      — 'sales' (stock will be deducted) | 'purchase' (it will not)
 *   onCreated(product) — the created product, for linking itemId
 *   onClose()
 */
import { useMemo, useState } from 'react';
import { dbApi, describeError } from '../../services/api';
import { showToast } from './toast';

const round2 = (n) => Math.round(((Number(n) || 0) * 100) + 1e-8) / 100;
const num = (v) => Number(v) || 0;
const GST_RATES = ['0', '5', '12', '18', '28'];

export default function NewItemDialog({
  name, billingQty, defaultRate, defaultGst, context = 'sales', onCreated, onClose,
}) {
  const [f, setF] = useState({
    name: String(name || '').trim(),
    type: 'product',
    sku: '',
    category: '',
    unit: 'pcs',
    hsn: '',
    price: defaultRate != null && defaultRate !== '' ? String(defaultRate) : '',
    purchasePrice: '',
    gst: defaultGst != null ? String(defaultGst) : '18',
    openingStock: '',
    lowStock: '',
  });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const [busy, setBusy] = useState(false);

  const isService = f.type === 'service';
  const isPurchase = context === 'purchase';
  const billing = round2(num(billingQty));
  const opening = round2(num(f.openingStock));
  // What the document will leave behind. A sales invoice takes the quantity
  // out; a purchase bill brings it in. Showing the resulting figure is what
  // makes the opening number checkable rather than a guess.
  const after = isPurchase ? round2(opening + billing) : round2(opening - billing);
  // Only a sale can leave you short.
  const short = !isPurchase && !isService && billing > 0 && opening < billing;

  const save = async () => {
    const itemName = String(f.name || '').trim();
    if (!itemName) { showToast('Item name is required', 'error'); return; }
    setBusy(true);
    try {
      const product = await dbApi.create('products', {
        name: itemName,
        type: f.type,
        sku: String(f.sku || '').trim() || null,
        category: String(f.category || '').trim() || null,
        unit: String(f.unit || '').trim() || null,
        hsn: String(f.hsn || '').trim() || null,
        price: f.price === '' ? null : num(f.price),
        purchasePrice: f.purchasePrice === '' ? null : num(f.purchasePrice),
        gst: f.gst || null,
        // A service has no quantity to track, and marking it 'no' is what stops
        // the invoice deduction touching it.
        trackStock: isService ? 'no' : 'yes',
        // openingStock is the starting figure and is never mutated afterwards;
        // `stock` is the live quantity the movement engine reads and writes.
        // They start equal — everything after this is a recorded movement.
        openingStock: isService ? null : opening,
        stock: isService ? null : opening,
        lowStock: f.lowStock === '' ? null : num(f.lowStock),
        createdFrom: context === 'purchase' ? 'purchase-invoice' : 'sales-invoice',
      });
      showToast(`${itemName} added to your items`, 'success');
      onCreated?.(product);
    } catch (e) {
      showToast(describeError(e, 'Could not add the item'), 'error');
      setBusy(false);
    }
  };

  const hint = { fontSize: 11, color: 'var(--text3)', marginTop: 3 };

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="card" style={{ width: '100%', maxWidth: 520, maxHeight: '92vh', overflow: 'auto', padding: 18 }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700 }}>Add a new item</h3>
        <p style={{ fontSize: 12.5, color: 'var(--text3)', margin: '0 0 14px' }}>
          This isn&apos;t in your items list yet. Adding it here keeps stock counted
          on every future bill instead of it being loose text.
        </p>

        <div className="form-group">
          <label>Item name *</label>
          <input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} autoFocus />
        </div>

        <div className="flex gap-2">
          <div className="form-group" style={{ flex: 1 }}>
            <label>Type</label>
            <select className="input" value={f.type} onChange={(e) => set('type', e.target.value)}>
              <option value="product">Product (track stock)</option>
              <option value="service">Service (no stock)</option>
            </select>
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label>Unit</label>
            <input className="input" value={f.unit} onChange={(e) => set('unit', e.target.value)} placeholder="pcs / sqft / kg" />
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label>HSN / SAC</label>
            <input className="input" value={f.hsn} onChange={(e) => set('hsn', e.target.value)} />
          </div>
        </div>

        <div className="flex gap-2">
          <div className="form-group" style={{ flex: 1 }}>
            <label>Sale price (₹)</label>
            <input className="input input-num" type="number" value={f.price} onChange={(e) => set('price', e.target.value)} />
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label>Purchase price (₹)</label>
            <input className="input input-num" type="number" value={f.purchasePrice} onChange={(e) => set('purchasePrice', e.target.value)} />
            <div style={hint}>Used to value stock and work out margin.</div>
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label>GST %</label>
            <select className="input" value={f.gst} onChange={(e) => set('gst', e.target.value)}>
              {GST_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}
            </select>
          </div>
        </div>

        {!isService && (
          <>
            <div className="flex gap-2">
              <div className="form-group" style={{ flex: 1 }}>
                <label>Stock in hand now *</label>
                <input
                  className="input input-num"
                  type="number"
                  value={f.openingStock}
                  onChange={(e) => set('openingStock', e.target.value)}
                  placeholder="0"
                />
                <div style={hint}>
                  How many you have <b>before</b> this bill{isPurchase ? ' — usually 0 for something you are buying for the first time' : ''}.
                </div>
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Low-stock alert at</label>
                <input className="input input-num" type="number" value={f.lowStock} onChange={(e) => set('lowStock', e.target.value)} placeholder="optional" />
              </div>
            </div>

            {billing > 0 && (
              <div
                style={{
                  padding: '9px 12px', borderRadius: 8, fontSize: 12.5, marginBottom: 12,
                  background: short ? 'rgba(239,68,68,.10)' : 'rgba(37,99,235,.10)',
                  color: short ? 'var(--red, #DC2626)' : 'var(--text2)',
                }}
              >
                {opening} in hand {isPurchase ? '+' : '−'} {billing} on this bill ={' '}
                <b>{after}</b> {isPurchase ? 'in stock after saving.' : 'left after saving.'}
                {short && (
                  <span style={{ display: 'block', marginTop: 3 }}>
                    That is less than you are billing. Save it and the stock goes
                    negative (or stops at zero, depending on your settings) — enter
                    what you really have if this is wrong.
                  </span>
                )}
              </div>
            )}
          </>
        )}

        {isService && (
          <div style={{ padding: '9px 12px', borderRadius: 8, background: 'var(--surface2)', fontSize: 12.5, color: 'var(--text2)', marginBottom: 12 }}>
            A service has no quantity to track, so nothing moves when it appears on a bill.
          </div>
        )}

        <div className="flex" style={{ gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-sm btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn btn-sm btn-primary" onClick={save} disabled={busy}>
            {busy ? '…' : 'Add item'}
          </button>
        </div>
      </div>
    </div>
  );
}
