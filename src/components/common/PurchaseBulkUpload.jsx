/**
 * Purchase register import — for a bill-book export where one row is one
 * supplier bill (no line items, no tax column).
 *
 * The difference from the other importers is the MAPPING STEP. Those rely on
 * header aliases alone, which fails the moment a sheet says "Purchase" twice or
 * uses a word nobody anticipated. Here the file's real headers are shown beside
 * a sample value from the first data row, and each is mapped to a field — the
 * guess is pre-filled, the user confirms. Getting the amount column wrong is not
 * a cosmetic error; it writes wrong money into the books.
 *
 * Everything else follows the established contract: parse in the browser, always
 * dry-run first, and show the exact impact before anything is written.
 */
import { useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { accountingApi, describeError } from '../../services/api';
import { showToast } from './toast';

// The fields the server understands. `required` drives the "can we import yet?"
// check so the user is told what is missing rather than getting a wall of
// skipped rows back.
const FIELDS = [
  { key: 'billNo', label: 'Bill / Purchase No.', required: true, hint: 'Identifies the bill — used to skip re-imports' },
  { key: 'date', label: 'Purchase Date', required: true, hint: 'dd/mm/yyyy or yyyy-mm-dd' },
  { key: 'partyName', label: 'Party Name', required: true, hint: 'Matched to an existing supplier by name' },
  { key: 'amount', label: 'Amount', required: true, hint: 'The bill total as written in the register' },
  { key: 'originalInvoiceNo', label: 'Original Invoice No.', required: false },
  { key: 'link', label: 'Bill Link / Attachment', required: false, hint: 'Stored against the bill' },
  { key: 'notes', label: 'Notes', required: false, hint: 'Also used as the line description' },
];

const norm = (s) => String(s || '').trim().toLowerCase().replace(/[\s_.\-/]/g, '');

// First match wins, so the more specific patterns are listed first. These only
// PRE-FILL the mapping — the user sees and can change every one of them.
const GUESSES = [
  [/^(purchase)?(invoice|bill)?(no|number|num|id)$/, 'billNo'],
  [/^purchase(invoice)?(no|number)?$/, 'billNo'],
  [/^(voucher|ref|reference)(no|number)?$/, 'billNo'],
  [/^original(invoice|bill)(no|number)?$/, 'originalInvoiceNo'],
  [/^(purchase|bill|invoice|voucher)?date$/, 'date'],
  [/^(party|supplier|vendor|seller)(name)?$/, 'partyName'],
  [/^(purchase)?(amount|total|value|grandtotal|netamount|billamount)$/, 'amount'],
  [/^(purchase)?link$/, 'link'],
  [/^(attachment|file|url|billcopy|image)$/, 'link'],
  [/^(note|notes|remark|remarks|narration|description|particulars)$/, 'notes'],
];

// Exported for the mapping tests — the guess is the part most likely to drift
// as new bill-book formats turn up.
export function guessField(header, taken) {
  const h = norm(header);
  for (const [re, field] of GUESSES) {
    if (re.test(h) && !taken.has(field)) return field;
  }
  return '';
}

const TAX_MODES = [
  { value: 'none', label: 'No GST — the amount is the whole bill' },
  { value: 'inclusive', label: 'Amount INCLUDES GST — split it out' },
  { value: 'exclusive', label: 'Amount EXCLUDES GST — add it on' },
];
const GST_RATES = ['5', '12', '18', '28'];

export default function PurchaseBulkUpload({ onImported }) {
  const fileRef = useRef(null);
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState([]);
  const [sheetRows, setSheetRows] = useState([]);   // raw objects keyed by header
  const [mapping, setMapping] = useState({});       // header -> field key
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);

  const [taxMode, setTaxMode] = useState('none');
  const [taxRate, setTaxRate] = useState('18');
  const [interState, setInterState] = useState(false);
  const [postToLedger, setPostToLedger] = useState(false);

  const reset = () => {
    setFileName(''); setHeaders([]); setSheetRows([]); setMapping({}); setPreview(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const onFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    setPreview(null);
    try {
      const wb = XLSX.read(await file.arrayBuffer());
      const sheet = wb.Sheets[wb.SheetNames[0]];
      // raw:false so Excel date cells arrive as text rather than serial numbers.
      const raw = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
      const rows = raw.filter((r) => Object.values(r).some((v) => String(v ?? '').trim() !== ''));
      if (!rows.length) { showToast('That sheet has no data rows.', 'error'); reset(); return; }

      const hdrs = Object.keys(rows[0]);
      const taken = new Set();
      const guessed = {};
      hdrs.forEach((h) => {
        const f = guessField(h, taken);
        if (f) { guessed[h] = f; taken.add(f); }
      });
      setHeaders(hdrs);
      setSheetRows(rows);
      setMapping(guessed);
    } catch (err) {
      showToast(describeError(err, 'Could not read that file'), 'error');
      reset();
    }
  };

  // A field may only be claimed by one column; picking it elsewhere releases it.
  const setColumnField = (header, field) => {
    setMapping((m) => {
      const next = { ...m };
      if (!field) delete next[header];
      else {
        Object.keys(next).forEach((h) => { if (next[h] === field) delete next[h]; });
        next[header] = field;
      }
      return next;
    });
    setPreview(null);
  };

  const mappedFields = useMemo(() => new Set(Object.values(mapping)), [mapping]);
  const missing = FIELDS.filter((f) => f.required && !mappedFields.has(f.key));

  // First non-empty value for a column, so the mapping row shows real data.
  const sampleFor = (header) => {
    for (const r of sheetRows) {
      const v = String(r[header] ?? '').trim();
      if (v) return v.length > 28 ? `${v.slice(0, 28)}…` : v;
    }
    return '—';
  };

  const buildRows = () => sheetRows.map((r) => {
    const out = {};
    for (const [header, field] of Object.entries(mapping)) out[field] = r[header];
    return out;
  });

  const run = async (dryRun) => {
    setBusy(true);
    try {
      const body = {
        rows: buildRows(), dryRun,
        taxMode, taxRate: Number(taxRate) || 0,
        interState, postToLedger,
      };
      const res = await accountingApi.importPurchases(body);
      if (dryRun) setPreview(res);
      else {
        showToast(`Imported ${res.createdCount} purchase bill(s)`, 'success');
        reset();
        onImported?.(res);
      }
    } catch (err) {
      showToast(describeError(err, dryRun ? 'Could not read that file' : 'Import failed'), 'error');
    } finally { setBusy(false); }
  };

  const sel = { padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 12.5, width: '100%' };

  return (
    <div>
      <div className="flex" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={onFile} style={{ fontSize: 12.5 }} disabled={busy} />
        {fileName && <span style={{ fontSize: 12, color: 'var(--text3)' }}>{fileName}</span>}
        {!!headers.length && <button className="btn btn-xs btn-ghost" onClick={reset} disabled={busy}>Clear</button>}
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 8 }}>
        One row per purchase bill. Your own column names are fine — you map them below.
      </div>

      {!!headers.length && (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', margin: '14px 0 6px' }}>
            Match your columns
          </div>
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.1fr', gap: 8, padding: '7px 10px', background: 'var(--surface2)', fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text3)' }}>
              <div>Column in your file</div><div>Example value</div><div>Import as</div>
            </div>
            {headers.map((h) => (
              <div key={h} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.1fr', gap: 8, padding: '7px 10px', alignItems: 'center', borderTop: '1px solid var(--border)', fontSize: 12.5 }}>
                <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>{h || <em style={{ color: 'var(--text3)' }}>(unnamed)</em>}</div>
                <div style={{ color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sampleFor(h)}</div>
                <select style={sel} value={mapping[h] || ''} onChange={(e) => setColumnField(h, e.target.value)}>
                  <option value="">— ignore —</option>
                  {FIELDS.map((f) => (
                    <option key={f.key} value={f.key}>{f.label}{f.required ? ' *' : ''}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {!!missing.length && (
            <div style={{ marginTop: 8, padding: '8px 11px', borderRadius: 8, background: 'rgba(239,68,68,.10)', color: 'var(--red, #DC2626)', fontSize: 12.5 }}>
              Still needed: <b>{missing.map((f) => f.label).join(', ')}</b>
            </div>
          )}

          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', margin: '14px 0 6px' }}>
            GST treatment
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text3)', marginBottom: 6 }}>
            Your sheet has no tax column, so this is applied to every row in the file.
            If the bills differ, import them in separate batches.
          </div>
          <div className="flex" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <select style={{ ...sel, width: 'auto', minWidth: 250 }} value={taxMode} onChange={(e) => { setTaxMode(e.target.value); setPreview(null); }}>
              {TAX_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            {taxMode !== 'none' && (
              <>
                <select style={{ ...sel, width: 'auto' }} value={taxRate} onChange={(e) => { setTaxRate(e.target.value); setPreview(null); }}>
                  {GST_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}
                </select>
                <label className="flex items-center" style={{ gap: 6, fontSize: 12.5, cursor: 'pointer' }}>
                  <input type="checkbox" checked={interState} onChange={(e) => { setInterState(e.target.checked); setPreview(null); }} />
                  Inter-state (IGST)
                </label>
              </>
            )}
          </div>

          <div style={{ marginTop: 12, padding: '9px 12px', borderRadius: 8, background: 'rgba(59,130,246,.10)', color: 'var(--text2)', fontSize: 12.5 }}>
            ℹ️ Imported bills <b>do not move stock</b> — those goods arrived long ago and today's
            quantities already reflect them. A bill number that already exists is <b>skipped</b>,
            never overwritten, so you can fix a few rows and re-import safely.
          </div>

          <label className="flex items-center" style={{ gap: 8, marginTop: 10, fontSize: 12.5, cursor: 'pointer' }}>
            <input type="checkbox" checked={postToLedger} onChange={(e) => { setPostToLedger(e.target.checked); setPreview(null); }} />
            <span>
              Also post these to the double-entry ledger
              <span style={{ display: 'block', color: 'var(--text3)', fontSize: 11.5 }}>
                Debits <b>Purchases</b> (an expense), not Inventory — these goods are long
                consumed, so calling them stock would claim shelf value you don't have.
                Leave OFF if you already entered opening balances per supplier.
              </span>
            </span>
          </label>

          <div className="flex" style={{ gap: 8, marginTop: 12 }}>
            <button className="btn btn-sm btn-primary" disabled={busy || !!missing.length} onClick={() => run(true)}>
              {busy && !preview ? 'Checking…' : `Preview ${sheetRows.length} row(s)`}
            </button>
          </div>
        </>
      )}

      {preview && (
        <div className="card" style={{ marginTop: 14, padding: 14 }}>
          <div className="flex" style={{ gap: 18, flexWrap: 'wrap', marginBottom: 10 }}>
            <Stat label="Bills to add" value={preview.createdCount} color="var(--green, #059669)" />
            <Stat label="Already exist" value={preview.duplicateCount} color={preview.duplicateCount ? 'var(--amber, #B45309)' : 'var(--text3)'} />
            <Stat label="Rows skipped" value={preview.skippedCount} color={preview.skippedCount ? 'var(--red, #DC2626)' : 'var(--text3)'} />
            <Stat label="Value" value={`₹${Number(preview.createdTotal || 0).toLocaleString('en-IN')}`} />
          </div>

          {preview.unmatchedVendors > 0 && (
            <div style={{ padding: '9px 12px', borderRadius: 8, background: 'rgba(245,158,11,.12)', color: 'var(--amber, #B45309)', fontSize: 12.5, marginBottom: 10 }}>
              ⚠️ {preview.unmatchedVendors} bill(s) name a supplier that doesn't exist yet. They
              import with the name only and won't appear on that supplier's ledger. Add those
              suppliers first if you want them linked.
            </div>
          )}

          {!!preview.skipped.length && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4, color: 'var(--red, #DC2626)' }}>Skipped rows</div>
              <div style={{ maxHeight: 110, overflowY: 'auto', fontSize: 12, color: 'var(--text2)' }}>
                {preview.skipped.map((s, i) => <div key={i}>Row {s.row}: {s.reason}</div>)}
              </div>
            </div>
          )}

          <div style={{ maxHeight: 200, overflowY: 'auto', fontSize: 12.5, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
            {preview.created.map((r, i) => (
              <div key={i} className="flex" style={{ justifyContent: 'space-between', padding: '3px 0' }}>
                <span>
                  <span style={{ color: 'var(--green, #059669)' }}>+</span> {r.ref}
                  <span style={{ color: 'var(--text3)' }}> · {r.partyName} · {r.date}</span>
                  {!r.matchedVendor && <span style={{ color: 'var(--amber, #B45309)' }}> · unlinked supplier</span>}
                </span>
                <span style={{ fontWeight: 600 }}>
                  ₹{Number(r.total).toLocaleString('en-IN')}
                  {r.taxTotal > 0 && (
                    <span style={{ color: 'var(--text3)', fontWeight: 400 }}> (tax ₹{Number(r.taxTotal).toLocaleString('en-IN')})</span>
                  )}
                </span>
              </div>
            ))}
            {preview.duplicates.map((r, i) => (
              <div key={`d${i}`} style={{ padding: '3px 0', color: 'var(--text3)' }}>
                <span style={{ color: 'var(--amber, #B45309)' }}>=</span> {r.ref} — {r.reason}
              </div>
            ))}
          </div>

          <div className="flex" style={{ gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setPreview(null)} disabled={busy}>Back</button>
            <button className="btn btn-primary btn-sm" onClick={() => run(false)} disabled={busy || !preview.createdCount}>
              {busy ? '…' : `Import ${preview.createdCount} bill(s)`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, color: 'var(--text3)', textTransform: 'uppercase', fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: color || 'var(--text)' }}>{value}</div>
    </div>
  );
}
