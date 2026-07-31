/**
 * Complete & Send modal — the operator's "department done, advance the job" action.
 * A SINGLE scrollable modal with 4 stacked sections (not a wizard):
 *   1) Materials Used  2) Wastage  3) Assembly/Consumables  4) Final Review.
 * On save it builds { materials, assembly, wastageInfo } and calls
 * ordersApi.deptComplete(job.id, body) — the server deducts stock, blocks with a
 * 400 "Not enough stock: …" if any item is short, logs to productionLog, and
 * advances the job to the next department (or QC if this was the last).
 */
import { useEffect, useMemo, useState } from 'react';
import { ordersApi } from '../../services/api';
import { useT } from '../../i18n/LanguageContext';
import { showToast } from './toast';

const S = {
  header:    { en: 'Complete & Send to', hi: 'पूरा करें और भेजें', hinglish: 'Complete & Send to', gu: 'પૂર્ણ કરો અને મોકલો', mr: 'पूर्ण करा आणि पाठवा', mwr: 'पूरो करो अर भेजो' },
  helper:    { en: 'Department work complete — next:', hi: 'विभाग का काम पूरा — अगला:', hinglish: 'Department work complete — next:', gu: 'વિભાગનું કામ પૂર્ણ — આગળ:', mr: 'विभागाचे काम पूर्ण — पुढे:', mwr: 'विभाग रो काम पूरो — अगलो:' },
  sec1:      { en: 'Materials Used (Step 1/4)', hi: 'इस्तेमाल मटेरियल (स्टेप 1/4)', hinglish: 'Materials Used (Step 1/4)', gu: 'વપરાયેલ મટિરિયલ (સ્ટેપ 1/4)', mr: 'वापरलेले मटेरियल (स्टेप 1/4)', mwr: 'काम आयो मटेरियल (स्टेप 1/4)' },
  sec2:      { en: 'Wastage (Step 2/4)', hi: 'बर्बादी (स्टेप 2/4)', hinglish: 'Wastage (Step 2/4)', gu: 'બગાડ (સ્ટેપ 2/4)', mr: 'वाया (स्टेप 2/4)', mwr: 'बरबादी (स्टेप 2/4)' },
  sec3:      { en: 'Assembly / Consumables (Step 3/4)', hi: 'असेंबली / कंज़्यूमेबल्स (स्टेप 3/4)', hinglish: 'Assembly / Consumables (Step 3/4)', gu: 'એસેમ્બલી / કન્ઝ્યુમેબલ્સ (સ્ટેપ 3/4)', mr: 'असेंब्ली / कन्झ्युमेबल्स (स्टेप 3/4)', mwr: 'असेंबली / कंज़्यूमेबल्स (स्टेप 3/4)' },
  sec4:      { en: 'Final Review (Step 4/4)', hi: 'अंतिम समीक्षा (स्टेप 4/4)', hinglish: 'Final Review (Step 4/4)', gu: 'અંતિમ સમીક્ષા (સ્ટેપ 4/4)', mr: 'अंतिम आढावा (स्टेप 4/4)', mwr: 'आखिरी समीक्षा (स्टेप 4/4)' },

  addMaterial:{ en: '+ Add Another Material', hi: '+ और मटेरियल जोड़ें', hinglish: '+ Add Another Material', gu: '+ બીજું મટિરિયલ ઉમેરો', mr: '+ आणखी मटेरियल जोडा', mwr: '+ अर मटेरियल जोड़ो' },
  addAssembly:{ en: '+ Add Assembly Item', hi: '+ असेंबली आइटम जोड़ें', hinglish: '+ Add Assembly Item', gu: '+ એસેમ્બલી આઇટમ ઉમેરો', mr: '+ असेंब्ली आयटम जोडा', mwr: '+ असेंबली आइटम जोड़ो' },
  selectStock:{ en: 'Select item…', hi: 'आइटम चुनें…', hinglish: 'Item chunein…', gu: 'આઇટમ પસંદ કરો…', mr: 'आयटम निवडा…', mwr: 'आइटम चुणो…' },
  available: { en: 'available', hi: 'उपलब्ध', hinglish: 'available', gu: 'ઉપલબ્ધ', mr: 'उपलब्ध', mwr: 'उपलब्ध' },
  qtyUsed:   { en: 'Qty Used', hi: 'इस्तेमाल मात्रा', hinglish: 'Qty Used', gu: 'વપરાયેલ જથ્થો', mr: 'वापरलेली संख्या', mwr: 'काम आयी मात्रा' },
  unit:      { en: 'Unit', hi: 'यूनिट', hinglish: 'Unit', gu: 'એકમ', mr: 'युनिट', mwr: 'यूनिट' },
  length:    { en: 'Length', hi: 'लंबाई', hinglish: 'Length', gu: 'લંબાઈ', mr: 'लांबी', mwr: 'लंबाई' },
  width:     { en: 'Width', hi: 'चौड़ाई', hinglish: 'Width', gu: 'પહોળાઈ', mr: 'रुंदी', mwr: 'चौड़ाई' },
  sheets:    { en: 'Sheets/Pcs', hi: 'शीट/पीस', hinglish: 'Sheets/Pcs', gu: 'શીટ/પીસ', mr: 'शीट/पीस', mwr: 'शीट/पीस' },
  totalArea: { en: 'Total Area', hi: 'कुल क्षेत्रफल', hinglish: 'Total Area', gu: 'કુલ ક્ષેત્રફળ', mr: 'एकूण क्षेत्र', mwr: 'कुल क्षेत्रफळ' },
  qty:       { en: 'Qty', hi: 'मात्रा', hinglish: 'Qty', gu: 'જથ્થો', mr: 'संख्या', mwr: 'मात्रा' },

  wQuestion: { en: 'Was there material wastage?', hi: 'क्या मटेरियल बर्बाद हुआ?', hinglish: 'Kya material wastage hua?', gu: 'શું મટિરિયલનો બગાડ થયો?', mr: 'मटेरियल वाया गेले का?', mwr: 'मटेरियल बरबाद हुयो के?' },
  noWastage: { en: 'No (No Wastage)', hi: 'नहीं (कोई बर्बादी नहीं)', hinglish: 'No (No Wastage)', gu: 'ના (બગાડ નથી)', mr: 'नाही (वाया नाही)', mwr: 'कोनी (बरबादी कोनी)' },
  yesWastage:{ en: 'Yes (Wastage)', hi: 'हाँ (बर्बादी)', hinglish: 'Yes (Wastage)', gu: 'હા (બગાડ)', mr: 'होय (वाया)', mwr: 'हाँ (बरबादी)' },
  wQty:      { en: 'Wastage qty', hi: 'बर्बादी मात्रा', hinglish: 'Wastage qty', gu: 'બગાડ જથ્થો', mr: 'वाया संख्या', mwr: 'बरबादी मात्रा' },
  wNote:     { en: 'Note (optional)', hi: 'नोट (वैकल्पिक)', hinglish: 'Note (optional)', gu: 'નોંધ (વૈકલ્પિક)', mr: 'टीप (ऐच्छिक)', mwr: 'नोट (मरजी रो)' },

  materials: { en: 'Materials', hi: 'मटेरियल', hinglish: 'Materials', gu: 'મટિરિયલ', mr: 'मटेरियल', mwr: 'मटेरियल' },
  assembly:  { en: 'Assembly', hi: 'असेंबली', hinglish: 'Assembly', gu: 'એસેમ્બલી', mr: 'असेंब्ली', mwr: 'असेंबली' },
  wastage:   { en: 'Wastage', hi: 'बर्बादी', hinglish: 'Wastage', gu: 'બગાડ', mr: 'वाया', mwr: 'बरबादी' },
  items:     { en: 'items', hi: 'आइटम', hinglish: 'items', gu: 'આઇટમ', mr: 'आयटम', mwr: 'आइटम' },
  no:        { en: 'No', hi: 'नहीं', hinglish: 'No', gu: 'ના', mr: 'नाही', mwr: 'कोनी' },

  save:      { en: 'Save & Send to', hi: 'सेव करें और भेजें', hinglish: 'Save & Send to', gu: 'સેવ કરો અને મોકલો', mr: 'सेव्ह करा आणि पाठवा', mwr: 'सेव करो अर भेजो' },
  cancel:    { en: 'Cancel', hi: 'रद्द करें', hinglish: 'Cancel', gu: 'રદ કરો', mr: 'रद्द करा', mwr: 'रद्द करो' },
  sent:      { en: 'Sent', hi: 'भेज दिया', hinglish: 'Send ho gaya', gu: 'મોકલ્યું', mr: 'पाठवले', mwr: 'भेज दियो' },
  failed:    { en: 'Failed', hi: 'नहीं हुआ', hinglish: 'Fail hua', gu: 'નિષ્ફળ', mr: 'अयशस्वी', mwr: 'कोनी हुयो' },
};

const SIZE_UNITS = ['ft', 'in', 'cm', 'm'];

const isMaterial  = (s) => { const t = s.type || 'both'; return t === 'raw' || t === 'both'; };
const isAssembly  = (s) => { const t = s.type || 'both'; return t === 'consumable' || t === 'both'; };
const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };

let _rid = 0;
const newId = () => `r${++_rid}`;
const emptyMaterial = () => ({ rid: newId(), stockId: '', item: '', qtyUsed: '', unit: '', length: '', width: '', sizeUnit: 'ft', sheets: '' });
const emptyAssembly = () => ({ rid: newId(), stockId: '', item: '', qty: '' });

export default function CompleteAndSendModal({ job, currentDept, onClose, onDone }) {
  const t = useT(S);
  const [stock, setStock] = useState([]);
  const [materials, setMaterials] = useState([emptyMaterial()]);
  const [assembly, setAssembly] = useState([]);
  const [hasWastage, setHasWastage] = useState(false);
  const [wQty, setWQty] = useState('');
  const [wNote, setWNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { ordersApi.stockItems().then((d) => setStock(Array.isArray(d) ? d : [])).catch(() => setStock([])); }, []);

  const materialOpts = useMemo(() => stock.filter(isMaterial), [stock]);
  const assemblyOpts = useMemo(() => stock.filter(isAssembly), [stock]);
  const byId = useMemo(() => Object.fromEntries(stock.map((s) => [String(s.id), s])), [stock]);

  const idx = job.currentDeptIndex || 0;
  const plan = Array.isArray(job.plan) ? job.plan : [];
  const nextName = plan[idx + 1]?.name || 'QC';

  // --- material rows
  const setMat = (rid, patch) => setMaterials((rows) => rows.map((r) => (r.rid === rid ? { ...r, ...patch } : r)));
  const pickMat = (rid, stockId) => {
    const s = byId[String(stockId)];
    setMat(rid, { stockId, item: s?.item || '', unit: s?.unit || '' });
  };
  const addMat = () => setMaterials((rows) => [...rows, emptyMaterial()]);
  const removeMat = (rid) => setMaterials((rows) => rows.filter((r) => r.rid !== rid));

  // --- assembly rows
  const setAsm = (rid, patch) => setAssembly((rows) => rows.map((r) => (r.rid === rid ? { ...r, ...patch } : r)));
  const pickAsm = (rid, stockId) => { const s = byId[String(stockId)]; setAsm(rid, { stockId, item: s?.item || '' }); };
  const addAsm = () => setAssembly((rows) => [...rows, emptyAssembly()]);
  const removeAsm = (rid) => setAssembly((rows) => rows.filter((r) => r.rid !== rid));

  const areaOf = (r) => num(r.length) * num(r.width) * (num(r.sheets) || 1);

  // --- review counts
  const matCount = materials.filter((r) => r.stockId && num(r.qtyUsed) > 0).length;
  const asmCount = assembly.filter((r) => r.stockId && num(r.qty) > 0).length;

  const save = async () => {
    const body = {
      materials: materials
        .filter((r) => r.stockId && num(r.qtyUsed) > 0)
        .map((r) => {
          const out = { stockId: r.stockId, item: r.item, qtyUsed: num(r.qtyUsed), unit: r.unit };
          if (num(r.length) > 0 || num(r.width) > 0 || num(r.sheets) > 0) {
            out.length = num(r.length);
            out.width = num(r.width);
            out.sizeUnit = r.sizeUnit;
            out.sheets = num(r.sheets);
            out.totalArea = areaOf(r);
          }
          return out;
        }),
      assembly: assembly
        .filter((r) => r.stockId && num(r.qty) > 0)
        .map((r) => ({ stockId: r.stockId, item: r.item, qty: num(r.qty) })),
      wastageInfo: hasWastage
        ? { hasWastage: true, qty: num(wQty), note: wNote || '' }
        : { hasWastage: false },
    };

    setBusy(true);
    try {
      await ordersApi.deptComplete(job.id, body);
      showToast(`${t('sent')} → ${nextName}`, 'success');
      onDone?.();
      onClose?.();
    } catch (e) {
      showToast(e.response?.data?.error || t('failed'), 'error');
    } finally { setBusy(false); }
  };

  const secTitle = { fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: '18px 0 8px' };
  const lbl = { fontSize: 11, fontWeight: 600, color: 'var(--text3)', display: 'block', marginBottom: 3 };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div className="card" style={{ maxWidth: 560, width: '100%', maxHeight: '92vh', overflow: 'auto' }}>
        {/* Header */}
        <h3 style={{ marginBottom: 2 }}>{t('header')} {nextName}</h3>
        <div style={{ fontSize: 12, color: 'var(--text3)', fontFamily: 'monospace', marginBottom: 4 }}>
          {job.jobNo} — {job.work || ''} — {currentDept?.name || ''}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8 }}>{t('helper')} {nextName}</div>

        {/* Section 1 — Materials Used */}
        <div style={secTitle}>{t('sec1')}</div>
        {materials.map((r) => (
          <div key={r.rid} className="card" style={{ background: 'var(--surface2)', padding: 10, marginBottom: 8 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <div style={{ flex: 2 }}>
                <label style={lbl}>{t('materials')}</label>
                <select className="input" value={r.stockId} onChange={(e) => pickMat(r.rid, e.target.value)}>
                  <option value="">{t('selectStock')}</option>
                  {materialOpts.map((s) => (
                    <option key={s.id} value={s.id}>{s.item} ({s.quantity} {t('available')})</option>
                  ))}
                </select>
              </div>
              <button className="btn btn-ghost btn-xs" onClick={() => removeMat(r.rid)} style={{ marginBottom: 2 }}>×</button>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={lbl}>{t('qtyUsed')}</label>
                <input className="input" type="number" min="0" value={r.qtyUsed} onChange={(e) => setMat(r.rid, { qtyUsed: e.target.value })} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={lbl}>{t('unit')}</label>
                <input className="input" value={r.unit} onChange={(e) => setMat(r.rid, { unit: e.target.value })} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={lbl}>{t('length')}</label>
                <input className="input" type="number" min="0" value={r.length} onChange={(e) => setMat(r.rid, { length: e.target.value })} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={lbl}>{t('width')}</label>
                <input className="input" type="number" min="0" value={r.width} onChange={(e) => setMat(r.rid, { width: e.target.value })} />
              </div>
              <div style={{ width: 70 }}>
                <label style={lbl}>{t('unit')}</label>
                <select className="input" value={r.sizeUnit} onChange={(e) => setMat(r.rid, { sizeUnit: e.target.value })}>
                  {SIZE_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={lbl}>{t('sheets')}</label>
                <input className="input" type="number" min="0" value={r.sheets} onChange={(e) => setMat(r.rid, { sheets: e.target.value })} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={lbl}>{t('totalArea')}</label>
                <input className="input" value={areaOf(r) ? `${areaOf(r)} ${r.sizeUnit}²` : ''} readOnly style={{ background: 'var(--surface)' }} />
              </div>
            </div>
          </div>
        ))}
        <button className="btn btn-sm" onClick={addMat} style={{ background: 'var(--surface2)', border: 'none' }}>{t('addMaterial')}</button>

        {/* Section 2 — Wastage */}
        <div style={secTitle}>{t('sec2')}</div>
        <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 8 }}>{t('wQuestion')}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-sm" onClick={() => setHasWastage(false)}
            style={{ flex: 1, background: hasWastage ? 'var(--surface2)' : 'var(--green)', color: hasWastage ? 'var(--text2)' : '#fff', border: 'none' }}>
            {t('noWastage')}
          </button>
          <button className="btn btn-sm" onClick={() => setHasWastage(true)}
            style={{ flex: 1, background: hasWastage ? 'var(--amber)' : 'var(--surface2)', color: hasWastage ? '#fff' : 'var(--text2)', border: 'none' }}>
            {t('yesWastage')}
          </button>
        </div>
        {hasWastage && (
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <div style={{ flex: 1 }}>
              <label style={lbl}>{t('wQty')}</label>
              <input className="input" type="number" min="0" value={wQty} onChange={(e) => setWQty(e.target.value)} />
            </div>
            <div style={{ flex: 2 }}>
              <label style={lbl}>{t('wNote')}</label>
              <input className="input" value={wNote} onChange={(e) => setWNote(e.target.value)} />
            </div>
          </div>
        )}

        {/* Section 3 — Assembly / Consumables */}
        <div style={secTitle}>{t('sec3')}</div>
        {assembly.map((r) => (
          <div key={r.rid} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 8 }}>
            <div style={{ flex: 2 }}>
              <label style={lbl}>{t('materials')}</label>
              <select className="input" value={r.stockId} onChange={(e) => pickAsm(r.rid, e.target.value)}>
                <option value="">{t('selectStock')}</option>
                {assemblyOpts.map((s) => (
                  <option key={s.id} value={s.id}>{s.item} ({s.quantity} {t('available')})</option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={lbl}>{t('qty')}</label>
              <input className="input" type="number" min="0" value={r.qty} onChange={(e) => setAsm(r.rid, { qty: e.target.value })} />
            </div>
            <button className="btn btn-ghost btn-xs" onClick={() => removeAsm(r.rid)} style={{ marginBottom: 2 }}>×</button>
          </div>
        ))}
        <button className="btn btn-sm" onClick={addAsm} style={{ background: 'var(--surface2)', border: 'none' }}>{t('addAssembly')}</button>

        {/* Section 4 — Final Review */}
        <div style={secTitle}>{t('sec4')}</div>
        <div className="badge" style={{ display: 'block', padding: '8px 10px', fontSize: 13, background: 'var(--surface2)', color: 'var(--text2)', borderRadius: 8 }}>
          {t('materials')}: {matCount} · {t('wastage')}: {hasWastage ? `${t('yesWastage')} (${num(wQty)})` : t('no')} · {t('assembly')}: {asmCount} {t('items')}
        </div>

        {/* Footer */}
        <div className="flex gap-2 mt-2" style={{ marginTop: 16 }}>
          <button className="btn btn-primary flex-1" onClick={save} disabled={busy}
            style={{ background: 'var(--green)', borderColor: 'var(--green)' }}>
            {busy ? '…' : `${t('save')} ${nextName}`}
          </button>
          <button className="btn btn-ghost" onClick={onClose}>{t('cancel')}</button>
        </div>
      </div>
    </div>
  );
}
