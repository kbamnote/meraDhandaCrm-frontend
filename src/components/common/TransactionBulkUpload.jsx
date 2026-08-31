/**
 * Historical sales import — for migrating invoices off another system.
 *
 * One spreadsheet ROW is one invoice LINE; rows sharing an invoiceNo become a
 * single multi-line invoice. Parsed in the browser and posted as plain rows, and
 * every run is a DRY RUN first — this writes financial documents, so seeing the
 * exact impact before committing is not optional.
 *
 * Three things the UI has to be honest about, because they are easy to get
 * wrong and expensive to undo:
 *   * imported invoices do NOT move stock — the goods left months ago
 *   * an invoice number that already exists is skipped, never overwritten
 *   * posting to the ledger is opt-in, because opening balances may already
 *     carry the same receivable
 */
import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { accountingApi, describeError } from '../../services/api';
import { showToast } from './toast';

const COLUMNS = [
  'invoiceNo', 'date', 'type', 'clientName', 'gstNo', 'phone',
  'itemName', 'hsn', 'qty', 'rate',
  'gstRate', 'interState', 'discount', 'paidAmount', 'paymentMode',
];

// Two rows of one 2-line invoice, plus a second invoice — so the sample shows
// how multi-line bills are expressed without needing a manual.
const SAMPLE_ROWS = [
  { invoiceNo: 'MPW/25-26/001', date: '05/04/2025', type: 'invoice', clientName: 'Sharma Traders',
    gstNo: '23AAAAA0000A1Z5', phone: '9876543210', itemName: 'Visiting Cards', hsn: '4909',
    qty: 1000, rate: 6, gstRate: 18, interState: 'no', discount: 0, paidAmount: 7080, paymentMode: 'bank' },
  { invoiceNo: 'MPW/25-26/001', date: '05/04/2025', type: 'invoice', clientName: 'Sharma Traders',
    gstNo: '23AAAAA0000A1Z5', phone: '9876543210', itemName: 'Letterheads', hsn: '4820',
    qty: 500, rate: 9, gstRate: 18, interState: 'no', discount: 0, paidAmount: '', paymentMode: '' },
  { invoiceNo: 'MPW/25-26/002', date: '11/04/2025', type: 'cash', clientName: 'Walk-in Customer',
    gstNo: '', phone: '', itemName: 'Photocopies', hsn: '', qty: 200, rate: 2,
    gstRate: 0, interState: 'no', discount: 0, paidAmount: 400, paymentMode: 'cash' },
];

const norm = (s) => String(s || '').trim().toLowerCase().replace(/[\s_-]/g, '');
const ALIASES = {
  billno: 'invoiceNo', invoiceno: 'invoiceNo', voucherno: 'invoiceNo', billnumber: 'invoiceNo',
  invoicedate: 'date', billdate: 'date',
  party: 'clientName', partyname: 'clientName', customer: 'clientName', customername: 'clientName',
  gstin: 'gstNo', mobile: 'phone',
  item: 'itemName', particulars: 'itemName', description: 'itemName', product: 'itemName',
  quantity: 'qty', price: 'rate', unitprice: 'rate', amount: 'rate',
  tax: 'gstRate', taxrate: 'gstRate', gst: 'gstRate',
  received: 'paidAmount', amountpaid: 'paidAmount', paid: 'paidAmount',
  mode: 'paymentMode',
};

export default function TransactionBulkUpload({ onImported }) {
  const fileRef = useRef(null);
  const [rows, setRows] = useState([]);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState('');
  const [postToLedger, setPostToLedger] = useState(false);

  const downloadSample = () => {
    const ws = XLSX.utils.json_to_sheet(SAMPLE_ROWS, { header: COLUMNS });
    ws['!cols'] = COLUMNS.map((c) => ({ wch: Math.max(13, c.length + 3) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Invoices');
    XLSX.writeFile(wb, 'historical-invoices-sample.xlsx');
  };

  const reset = () => {
    setPreview(null); setRows([]); setFileName('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const runDry = async (parsed) => {
    setBusy(true);
    try {
      setPreview(await accountingApi.importTransactions({ rows: parsed, dryRun: true, postToLedger }));
    } catch (err) {
      showToast(describeError(err, 'Could not read that file'), 'error');
    } finally { setBusy(false); }
  };

  const onFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    setPreview(null);
    try {
      const wb = XLSX.read(await file.arrayBuffer());
      const sheet = wb.Sheets[wb.SheetNames[0]];
      // raw:false so Excel date cells arrive as text the server can parse rather
      // than as serial numbers.
      const raw = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
      const mapped = raw.map((r) => {
        const out = {};
        for (const [k, v] of Object.entries(r)) {
          const hit = COLUMNS.find((col) => norm(col) === norm(k)) || ALIASES[norm(k)] || null;
          if (hit) out[hit] = v;
        }
        return out;
      }).filter((r) => Object.values(r).some((v) => v !== '' && v != null));

      if (!mapped.length) { showToast('No usable rows found — check the column headers', 'error'); return; }
      setRows(mapped);
      await runDry(mapped);
    } catch (err) {
      showToast(describeError(err, 'Could not read that file'), 'error');
    }
  };

  const commit = async () => {
    setBusy(true);
    try {
      const res = await accountingApi.importTransactions({ rows, postToLedger });
      showToast(`Imported ${res.createdCount} invoice(s)`, 'success');
      reset();
      onImported?.(res);
    } catch (err) {
      showToast(describeError(err, 'Import failed'), 'error');
    } finally { setBusy(false); }
  };

  return (
    <div>
      <div className="flex" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button className="btn btn-sm btn-ghost" onClick={downloadSample}>⬇️ Download sample sheet</button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={onFile} style={{ fontSize: 12.5 }} disabled={busy} />
        {fileName && <span style={{ fontSize: 12, color: 'var(--text3)' }}>{fileName}</span>}
      </div>

      <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 8 }}>
        One row per invoice <b>line</b> — rows sharing an <b>invoiceNo</b> become one invoice.
        Required: invoiceNo, date, clientName. Dates may be dd/mm/yyyy or yyyy-mm-dd.
      </div>

      <div style={{ marginTop: 10, padding: '9px 12px', borderRadius: 8, background: 'rgba(59,130,246,.10)', color: 'var(--text2)', fontSize: 12.5 }}>
        ℹ️ Imported invoices <b>do not move stock</b> — those goods left long ago and today's
        quantities already reflect it. Invoice numbers that already exist are <b>skipped</b>,
        never overwritten, so you can fix a few rows and re-import safely.
      </div>

      <label className="flex items-center" style={{ gap: 8, marginTop: 10, fontSize: 12.5, cursor: 'pointer' }}>
        <input type="checkbox" checked={postToLedger} onChange={(e) => { setPostToLedger(e.target.checked); if (rows.length) runDry(rows); }} />
        <span>
          Also post these to the double-entry ledger
          <span style={{ display: 'block', color: 'var(--text3)', fontSize: 11.5 }}>
            Leave OFF if you already entered opening balances per party — posting history
            as well would count the same receivable twice.
          </span>
        </span>
      </label>

      {busy && !preview && <div style={{ marginTop: 14, color: 'var(--text3)', fontSize: 13 }}>Reading…</div>}

      {preview && (
        <div className="card" style={{ marginTop: 14, padding: 14 }}>
          <div className="flex" style={{ gap: 18, flexWrap: 'wrap', marginBottom: 10 }}>
            <Stat label="Invoices to add" value={preview.createdCount} color="var(--green, #059669)" />
            <Stat label="Already exist" value={preview.duplicateCount} color={preview.duplicateCount ? 'var(--amber, #B45309)' : 'var(--text3)'} />
            <Stat label="Rows skipped" value={preview.skippedCount} color={preview.skippedCount ? 'var(--red, #DC2626)' : 'var(--text3)'} />
            <Stat label="Rows read" value={preview.total} />
          </div>

          {preview.unmatchedClients > 0 && (
            <div style={{ padding: '9px 12px', borderRadius: 8, background: 'rgba(245,158,11,.12)', color: 'var(--amber, #B45309)', fontSize: 12.5, marginBottom: 10 }}>
              ⚠️ {preview.unmatchedClients} invoice(s) name a party that doesn't exist yet. They
              import with the name only and won't appear on that party's ledger. Import your
              parties first if you want them linked.
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
                  <span style={{ color: 'var(--green, #059669)' }}>+</span> {r.invoiceNo}
                  <span style={{ color: 'var(--text3)' }}> · {r.clientName} · {r.lines} line(s)</span>
                  {!r.matchedClient && <span style={{ color: 'var(--amber, #B45309)' }}> · unlinked party</span>}
                </span>
                <span style={{ fontWeight: 600 }}>₹{Number(r.total).toLocaleString('en-IN')}</span>
              </div>
            ))}
            {preview.duplicates.map((r, i) => (
              <div key={'d' + i} style={{ padding: '3px 0', color: 'var(--text3)' }}>
                <span style={{ color: 'var(--amber, #B45309)' }}>=</span> {r.invoiceNo} — {r.reason}
              </div>
            ))}
          </div>

          <div className="flex" style={{ gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
            <button className="btn btn-ghost btn-sm" onClick={reset} disabled={busy}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={commit} disabled={busy || !preview.createdCount}>
              {busy ? '…' : `Import ${preview.createdCount} invoice(s)`}
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
