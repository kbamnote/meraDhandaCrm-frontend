/**
 * Inventory — accounting view of stock. Shows stock valuation (items × avg cost),
 * movement history, and low-stock alerts. Reads from /stock/valuation (moving-
 * average cost) and /stock/movements (audit trail). The existing StockPage is
 * operational (in/out); this page is financial (values on the balance sheet).
 */
import { useEffect, useMemo, useState } from 'react';
import { ref, onValue, db } from '../../services/realtime';
import { stockApi } from '../../services/api';
import { useT } from '../../i18n/LanguageContext';
import { Kpi, KpiGrid, Section, inr } from '../../components/common/DashboardCharts';
import BatchesTab from './BatchesTab';

const round2 = (n) => Math.round(((Number(n) || 0) * 100) + 1e-8) / 100;

const S = {
  title:    { en: 'Inventory Valuation', hi: 'इन्वेंटरी वैल्यूएशन', hinglish: 'Inventory Valuation' },
  value:    { en: 'Total Value', hi: 'कुल मूल्य', hinglish: 'Total Value' },
  items:    { en: 'Items', hi: 'आइटम', hinglish: 'Items' },
  lowStock: { en: 'Low Stock', hi: 'कम स्टॉक', hinglish: 'Low Stock' },
  units:    { en: 'Total Units', hi: 'कुल यूनिट', hinglish: 'Total Units' },
  valuation:{ en: 'Stock Valuation', hi: 'स्टॉक वैल्यूएशन', hinglish: 'Stock Valuation' },
  movements:{ en: 'Stock Movements', hi: 'स्टॉक मूवमेंट', hinglish: 'Stock Movements' },
  search:   { en: 'Search items…', hi: 'आइटम खोजें…', hinglish: 'Search items…' },
  none:     { en: 'No stock items with value.', hi: 'कोई स्टॉक नहीं।', hinglish: 'No stock items.' },
  noMovements:{ en: 'No movements recorded.', hi: 'कोई मूवमेंट नहीं।', hinglish: 'No movements.' },
  nameH:    { en: 'Item', hi: 'आइटम', hinglish: 'Item' },
  qtyH:     { en: 'Qty', hi: 'मात्रा', hinglish: 'Qty' },
  costH:    { en: 'Avg Cost', hi: 'औसत लागत', hinglish: 'Avg Cost' },
  valueH:   { en: 'Value', hi: 'मूल्य', hinglish: 'Value' },
  sourceH:  { en: 'Source', hi: 'स्रोत', hinglish: 'Source' },
  dateH:    { en: 'Date', hi: 'तारीख', hinglish: 'Date' },
  typeH:    { en: 'Type', hi: 'प्रकार', hinglish: 'Type' },
  itemH:    { en: 'Item', hi: 'आइटम', hinglish: 'Item' },
  qtyInH:   { en: 'Qty', hi: 'मात्रा', hinglish: 'Qty' },
  balH:     { en: 'Balance', hi: 'बैलेंस', hinglish: 'Balance' },
  reasonH:  { en: 'Reason', hi: 'कारण', hinglish: 'Reason' },
  low:      { en: 'LOW', hi: 'कम', hinglish: 'LOW' },
  product:  { en: 'Product', hi: 'प्रोडक्ट', hinglish: 'Product' },
  material: { en: 'Material', hi: 'मटेरियल', hinglish: 'Material' },
  batches:  { en: 'Batches & Variants', hi: 'बैच और वेरिएंट', hinglish: 'Batches & Variants' },
  method:   { en: 'Valuation', hi: 'मूल्यांकन', hinglish: 'Valuation' },
  average:  { en: 'Average cost', hi: 'औसत लागत', hinglish: 'Average' },
  fifo:     { en: 'FIFO', hinglish: 'FIFO' },
  fefo:     { en: 'FEFO', hinglish: 'FEFO' },
  valueH:   { en: 'Value', hi: 'मूल्य', hinglish: 'Value' },
};

const TABS = ['valuation', 'batches', 'movements'];

export default function InventoryPage() {
  const t = useT(S);
  const [valuation, setValuation] = useState({ total: 0, items: [] });
  const [movements, setMovements] = useState([]);
  const [products, setProducts] = useState({}); // for lowStock threshold
  const [tab, setTab] = useState('valuation');
  const [q, setQ] = useState('');
  const [method, setMethod] = useState('average');

  // Load valuation (re-fetched when the valuation method changes) + movements.
  useEffect(() => {
    stockApi.valuation({ method }).then(setValuation).catch(() => setValuation({ total: 0, items: [] }));
    stockApi.movements().then((m) => setMovements(m || [])).catch(() => setMovements([]));
  }, [method]);

  // Load products (for lowStock threshold) via realtime
  useEffect(() => {
    const u = onValue(ref(db, 'mpw/products'), (s) => setProducts(s.val() || {}));
    return () => u();
  }, []);

  // Build low-stock map from products
  const lowStockMap = useMemo(() => {
    const m = new Map();
    Object.entries(products).forEach(([id, p]) => {
      const qty = Number(p.stock) || Number(p.currentStock) || 0;
      const low = Number(p.lowStock) || 0;
      if (low > 0 && qty > 0 && qty <= low) m.set(id, { qty, low });
    });
    return m;
  }, [products]);

  // Filtered items
  const items = useMemo(() => {
    const list = valuation.items || [];
    if (!q) return list;
    const s = q.toLowerCase();
    return list.filter((i) => (i.name || '').toLowerCase().includes(s));
  }, [valuation.items, q]);

  const totalUnits = useMemo(() => round2((valuation.items || []).reduce((s, i) => s + (i.qty || 0), 0)), [valuation.items]);
  const lowCount = useMemo(() => {
    let c = 0;
    (valuation.items || []).forEach((i) => {
      if (lowStockMap.has(i.id)) c++;
    });
    return c;
  }, [valuation.items, lowStockMap]);

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>{t('title')}</h2>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text2)' }}>
          {t('method')}
          <select className="input" value={method} onChange={(e) => setMethod(e.target.value)} style={{ width: 140, padding: '5px 8px', fontSize: 13 }}>
            <option value="average">{t('average')}</option>
            <option value="fifo">{t('fifo')}</option>
            <option value="fefo">{t('fefo')}</option>
          </select>
        </label>
      </div>

      {/* KPIs */}
      <KpiGrid>
        <Kpi label={t('value')} value={inr(valuation.total)} icon="💰" color="var(--green)" />
        <Kpi label={t('items')} value={valuation.items?.length || 0} icon="📦" color="var(--blue)" />
        <Kpi label={t('lowStock')} value={lowCount} icon="⚠️" color={lowCount > 0 ? 'var(--red)' : 'var(--green)'} />
        <Kpi label={t('units')} value={totalUnits} icon="📊" color="var(--text)" />
      </KpiGrid>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--border)', marginBottom: 16 }}>
        {TABS.map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            style={{
              padding: '8px 16px', cursor: 'pointer', border: 'none', background: 'none',
              fontWeight: tab === k ? 600 : 400, fontSize: 13,
              color: tab === k ? 'var(--blue)' : 'var(--text2)',
              borderBottom: tab === k ? '2px solid var(--blue)' : '2px solid transparent',
              marginBottom: -2, transition: 'color .15s',
            }}
          >
            {k === 'valuation' ? `💰 ${t(k)}` : k === 'batches' ? `🧬 ${t(k)}` : `🔄 ${t(k)}`}
          </button>
        ))}
      </div>

      {/* Search */}
      {tab === 'valuation' && (
        <input
          type="text"
          placeholder={t('search')}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{
            width: '100%', maxWidth: 320, padding: '7px 12px', borderRadius: 6,
            border: '1px solid var(--border)', background: 'var(--surface)',
            color: 'var(--text)', fontSize: 13, marginBottom: 12, boxSizing: 'border-box',
          }}
        />
      )}

      {/* Valuation table */}
      {tab === 'valuation' && (
        <div>
          {items.length === 0 ? (
            <div style={{ color: 'var(--text3)', fontSize: 13, padding: '24px 0', textAlign: 'center' }}>{t('none')}</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)' }}>
                    <th style={thL}>{t('nameH')}</th>
                    <th style={thR}>{t('qtyH')}</th>
                    <th style={thR}>{t('costH')}</th>
                    <th style={thR}>{t('valueH')}</th>
                    <th style={thR}>{t('sourceH')}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const isLow = lowStockMap.has(item.id);
                    return (
                      <tr key={item.id} style={{ borderBottom: '1px solid var(--border)', background: isLow ? 'rgba(239,68,68,0.06)' : 'none' }}>
                        <td style={{ ...tdL, fontWeight: 500 }}>
                          {item.name || '—'}
                          {isLow && (
                            <span style={{ marginLeft: 6, padding: '1px 5px', borderRadius: 3, fontSize: 10, fontWeight: 700, background: 'var(--red)', color: '#fff' }}>
                              {t('low')}
                            </span>
                          )}
                        </td>
                        <td style={tdR}>{item.qty || 0}</td>
                        <td style={tdR}>{inr(item.cost)}</td>
                        <td style={{ ...tdR, fontWeight: 600 }}>{inr(item.value)}</td>
                        <td style={tdR}>
                          <span style={{
                            padding: '1px 6px', borderRadius: 4, fontSize: 11,
                            background: item.source === 'product' ? 'var(--blue)' : 'var(--amber)',
                            color: '#fff',
                          }}>
                            {item.source === 'product' ? t('product') : t('material')}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {/* Grand total row */}
                <tfoot>
                  <tr style={{ borderTop: '2px solid var(--border)', fontWeight: 700 }}>
                    <td style={tdL}>{t('valuation')}</td>
                    <td style={tdR}>{totalUnits}</td>
                    <td style={tdR}></td>
                    <td style={{ ...tdR, color: 'var(--green)' }}>{inr(valuation.total)}</td>
                    <td style={tdR}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Movements table */}
      {tab === 'movements' && (
        <div>
          {movements.length === 0 ? (
            <div style={{ color: 'var(--text3)', fontSize: 13, padding: '24px 0', textAlign: 'center' }}>{t('noMovements')}</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)' }}>
                    <th style={thL}>{t('dateH')}</th>
                    <th style={thL}>{t('itemH')}</th>
                    <th style={thR}>{t('typeH')}</th>
                    <th style={thR}>{t('qtyInH')}</th>
                    <th style={thR}>{t('balH')}</th>
                    <th style={thL}>{t('reasonH')}</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={tdL}>{m.date}</td>
                      <td style={tdL}>{m.itemName || '—'}</td>
                      <td style={tdR}>
                        <span style={{
                          display: 'inline-block', padding: '1px 6px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                          background: m.type === 'in' ? 'var(--green)' : 'var(--red)', color: '#fff',
                        }}>
                          {m.type === 'in' ? 'IN' : 'OUT'}
                        </span>
                      </td>
                      <td style={{ ...tdR, color: m.type === 'in' ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                        {m.type === 'in' ? '+' : '-'}{m.qty}
                      </td>
                      <td style={tdR}>{m.balance}</td>
                      <td style={{ ...tdL, color: 'var(--text2)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {m.reason || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Batches & Variants tab */}
      {tab === 'batches' && <BatchesTab />}
    </div>
  );
}

// ── styles ──
const thL = { textAlign: 'left', padding: '6px 8px', color: 'var(--text3)', fontWeight: 500, fontSize: 12 };
const thR = { textAlign: 'right', padding: '6px 8px', color: 'var(--text3)', fontWeight: 500, fontSize: 12 };
const tdL = { padding: '6px 8px', textAlign: 'left', color: 'var(--text)' };
const tdR = { padding: '6px 8px', textAlign: 'right', color: 'var(--text)' };
