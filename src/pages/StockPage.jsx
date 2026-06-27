/**
 * Stock — inventory items with running quantities + material in/out movements.
 * Each in/out adjusts the item's qty (stockApi.move) and is logged. Items are
 * created here too (generic create). Low-stock items are flagged.
 */
import { useEffect, useMemo, useState } from 'react';
import { ref, onValue, db } from '../services/realtime';
import { dbApi, stockApi } from '../services/api';
import { useT } from '../i18n/LanguageContext';
import { showToast } from '../components/common/toast';

const S = {
  title:   { en: '📦 Stock', hi: '📦 स्टॉक', hinglish: '📦 Stock', gu: '📦 સ્ટોક', mr: '📦 स्टॉक', mwr: '📦 स्टॉक' },
  newItem: { en: '+ New item', hi: '+ नया आइटम', hinglish: '+ Naya item', gu: '+ નવો આઇટમ', mr: '+ नवीन आयटम', mwr: '+ नयो आइटम' },
  none:    { en: 'No stock items yet.', hi: 'अभी कोई स्टॉक आइटम नहीं।', hinglish: 'Abhi koi stock item nahi.', gu: 'હજુ કોઈ સ્ટોક આઇટમ નથી.', mr: 'अद्याप स्टॉक आयटम नाही.', mwr: 'अजे कोई स्टॉक आइटम कोनी।' },
  inBtn:   { en: '➕ In', hi: '➕ इन', hinglish: '➕ In', gu: '➕ ઇન', mr: '➕ इन', mwr: '➕ इन' },
  outBtn:  { en: '➖ Out', hi: '➖ आउट', hinglish: '➖ Out', gu: '➖ આઉટ', mr: '➖ आउट', mwr: '➖ आउट' },
  low:     { en: 'LOW', hi: 'कम', hinglish: 'LOW', gu: 'ઓછું', mr: 'कमी', mwr: 'कम' },
  movements:{ en: 'Recent movements', hi: 'हाल की मूवमेंट', hinglish: 'Recent movements', gu: 'તાજેતરની મૂવમેન્ટ', mr: 'अलीकडील हालचाली', mwr: 'हाल री मूवमेंट' },
  qtyIn:   { en: 'Quantity to add (In):', hi: 'जोड़ने की मात्रा (इन):', hinglish: 'Add quantity (In):', gu: 'ઉમેરવાનો જથ્થો:', mr: 'जोडायचे प्रमाण:', mwr: 'जोड़ण री मात्रा:' },
  qtyOut:  { en: 'Quantity to remove (Out):', hi: 'निकालने की मात्रा (आउट):', hinglish: 'Remove quantity (Out):', gu: 'કાઢવાનો જથ્થો:', mr: 'काढायचे प्रमाण:', mwr: 'काढण री मात्रा:' },
  name:    { en: 'Item name', hi: 'आइटम का नाम', hinglish: 'Item name', gu: 'આઇટમ નામ', mr: 'आयटम नाव', mwr: 'आइटम रो नाम' },
  unit:    { en: 'Unit', hi: 'यूनिट', hinglish: 'Unit', gu: 'યુનિટ', mr: 'युनिट', mwr: 'यूनिट' },
  qty:     { en: 'Opening qty', hi: 'शुरुआती मात्रा', hinglish: 'Opening qty', gu: 'ઓપનિંગ જથ્થો', mr: 'सुरुवातीचे प्रमाण', mwr: 'शुरुआती मात्रा' },
  minQty:  { en: 'Min qty (low alert)', hi: 'न्यूनतम (अलर्ट)', hinglish: 'Min qty (alert)', gu: 'મિન જથ્થો', mr: 'किमान प्रमाण', mwr: 'कम सूं कम मात्रा' },
  create:  { en: 'Create', hi: 'बनाएं', hinglish: 'Create', gu: 'બનાવો', mr: 'तयार करा', mwr: 'बणावो' },
  cancel:  { en: 'Cancel', hi: 'रद्द करें', hinglish: 'Cancel', gu: 'રદ કરો', mr: 'रद्द करा', mwr: 'रद्द करो' },
  done:    { en: 'Done', hi: 'हो गया', hinglish: 'Done', gu: 'થયું', mr: 'झाले', mwr: 'हो ग्यो' },
  failed:  { en: 'Failed', hi: 'नहीं हुआ', hinglish: 'Fail hua', gu: 'નિષ્ફળ', mr: 'अयशस्वी', mwr: 'कोनी हुयो' },
};

export default function StockPage() {
  const t = useT(S);
  const [items, setItems] = useState({});
  const [moves, setMoves] = useState({});
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    const u1 = onValue(ref(db, 'mpw/stock'), (s) => setItems(s.val() || {}));
    const u2 = onValue(ref(db, 'mpw/stockMovements'), (s) => setMoves(s.val() || {}));
    return () => { u1(); u2(); };
  }, []);

  const list = useMemo(() => Object.entries(items).map(([id, v]) => ({ ...v, id })).sort((a, b) => (a.name || '').localeCompare(b.name || '')), [items]);
  const movements = useMemo(() => Object.entries(moves).map(([id, v]) => ({ ...v, id })).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 15), [moves]);

  const move = async (item, type) => {
    const v = window.prompt(type === 'in' ? t('qtyIn') : t('qtyOut'));
    if (v === null) return;
    const qty = Number(v);
    if (!(qty > 0)) return;
    try { await stockApi.move({ itemId: item.id, type, qty }); showToast(t('done'), 'success'); }
    catch (e) { showToast(e.response?.data?.error || t('failed'), 'error'); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>{t('title')}</h2>
        <button className="btn btn-primary btn-sm" onClick={() => setShowNew(true)}>{t('newItem')}</button>
      </div>

      {!list.length && <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>{t('none')}</div>}
      {list.map((item) => {
        const qty = Number(item.qty ?? item.stock ?? 0);
        const low = item.minQty != null && qty <= Number(item.minQty);
        return (
          <div key={item.id} className="card" style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontWeight: 600 }}>{item.name} {low && <span className="badge badge-red">{t('low')}</span>}</div>
              <div style={{ fontSize: 13, color: 'var(--text2)' }}>
                <b style={{ color: low ? 'var(--red)' : 'var(--text)' }}>{qty}</b> {item.unit || ''}
              </div>
            </div>
            <div className="flex gap-2">
              <button className="btn btn-success btn-sm" onClick={() => move(item, 'in')}>{t('inBtn')}</button>
              <button className="btn btn-danger btn-sm" onClick={() => move(item, 'out')}>{t('outBtn')}</button>
            </div>
          </div>
        );
      })}

      {!!movements.length && (
        <>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.05em', margin: '20px 0 8px' }}>{t('movements')}</div>
          {movements.map((m) => (
            <div key={m.id} className="card" style={{ marginBottom: 4, fontSize: 13, display: 'flex', justifyContent: 'space-between' }}>
              <span>{m.type === 'in' ? '➕' : '➖'} {m.itemName} · {m.qty}{m.ref ? ` · ${m.ref}` : ''}</span>
              <span style={{ color: 'var(--text3)' }}>→ {m.balance} · {m.date}</span>
            </div>
          ))}
        </>
      )}

      {showNew && <NewItemModal onClose={() => setShowNew(false)} t={t} />}
    </div>
  );
}

function NewItemModal({ onClose, t }) {
  const [form, setForm] = useState({ name: '', unit: 'pcs', qty: '0', minQty: '' });
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const submit = async () => {
    if (!form.name.trim()) return showToast(t('name'), 'error');
    setBusy(true);
    try {
      await dbApi.create('stock', { name: form.name.trim(), unit: form.unit, qty: Number(form.qty) || 0, minQty: form.minQty ? Number(form.minQty) : null });
      showToast(t('done'), 'success'); onClose();
    } catch (e) { showToast(e.response?.data?.error || t('failed'), 'error'); }
    finally { setBusy(false); }
  };
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div className="card" style={{ maxWidth: 420, width: '100%' }}>
        <h3 style={{ marginBottom: 12 }}>{t('newItem')}</h3>
        <div className="form-group"><label>{t('name')}</label><input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} autoFocus /></div>
        <div className="flex gap-2">
          <div className="form-group" style={{ flex: 1 }}><label>{t('unit')}</label><input className="input" value={form.unit} onChange={(e) => set('unit', e.target.value)} /></div>
          <div className="form-group" style={{ flex: 1 }}><label>{t('qty')}</label><input className="input" type="number" value={form.qty} onChange={(e) => set('qty', e.target.value)} /></div>
          <div className="form-group" style={{ flex: 1 }}><label>{t('minQty')}</label><input className="input" type="number" value={form.minQty} onChange={(e) => set('minQty', e.target.value)} /></div>
        </div>
        <div className="flex gap-2 mt-2">
          <button className="btn btn-primary flex-1" onClick={submit} disabled={busy}>{busy ? '…' : t('create')}</button>
          <button className="btn btn-ghost" onClick={onClose}>{t('cancel')}</button>
        </div>
      </div>
    </div>
  );
}
