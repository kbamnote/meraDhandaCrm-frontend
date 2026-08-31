/**
 * Bulk party import — customers/suppliers with opening balances, from Excel/CSV.
 *
 * Same shape as StockBulkUpload: the file is parsed in the browser and posted as
 * plain rows, so the API never handles multipart. Every import runs as a DRY RUN
 * first and nothing is written until the user confirms — an import can create
 * hundreds of ledger-affecting opening balances, so seeing the impact first is
 * not optional.
 *
 * Rows match an existing party by GSTIN, then phone, then exact name, so
 * re-importing a corrected sheet updates instead of duplicating.
 */
import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { accountingApi, describeError } from '../../services/api';
import { showToast } from './toast';

const COLUMNS = [
  'name', 'partyType', 'phone', 'email', 'gstNo', 'pan', 'category',
  'billingAddress', 'shippingAddress', 'contactPersonName',
  'creditLimit', 'creditPeriodDays', 'openingBalance', 'openingBalanceType',
];

const SAMPLE_ROWS = [
  {
    name: 'Sharma Traders', partyType: 'customer', phone: '9876543210', email: 'accounts@sharma.in',
    gstNo: '23AAAAA0000A1Z5', pan: 'AAAAA0000A', category: 'Wholesale',
    billingAddress: '12 MG Road, Indore, 452001', shippingAddress: '', contactPersonName: 'Rahul Sharma',
    creditLimit: 50000, creditPeriodDays: 30, openingBalance: 12500, openingBalanceType: 'to_collect',
  },
  {
    name: 'Jain Paper House', partyType: 'supplier', phone: '9812345678', email: '',
    gstNo: '23BBBBB1111B1Z5', pan: '', category: 'Paper',
    billingAddress: 'Sanyogitaganj, Indore', shippingAddress: '', contactPersonName: '',
    creditLimit: '', creditPeriodDays: 15, openingBalance: 8000, openingBalanceType: 'to_pay',
  },
];

const norm = (s) => String(s || '').trim().toLowerCase().replace(/[\s_-]/g, '');

// Header aliases, so a sheet exported from another system still lands correctly.
const ALIASES = {
  partyname: 'name', customername: 'name', suppliername: 'name', company: 'name',
  mobile: 'phone', mobilenumber: 'phone', contact: 'phone', contactnumber: 'phone',
  gstin: 'gstNo', gst: 'gstNo', gstnumber: 'gstNo',
  pannumber: 'pan',
  address: 'billingAddress', billingaddress: 'billingAddress',
  shippingaddress: 'shippingAddress',
  contactperson: 'contactPersonName', contactpersonname: 'contactPersonName',
  creditlimit: 'creditLimit', creditperiod: 'creditPeriodDays', creditdays: 'creditPeriodDays',
  openingbalance: 'openingBalance', opening: 'openingBalance',
  balancetype: 'openingBalanceType', openingtype: 'openingBalanceType',
  type: 'partyType', partytype: 'partyType',
};

export default function PartyBulkUpload({ onImported }) {
  const fileRef = useRef(null);
  const [rows, setRows] = useState([]);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState('');

  const downloadSample = () => {
    const ws = XLSX.utils.json_to_sheet(SAMPLE_ROWS, { header: COLUMNS });
    ws['!cols'] = COLUMNS.map((c) => ({ wch: Math.max(14, c.length + 4) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Parties');
    XLSX.writeFile(wb, 'parties-upload-sample.xlsx');
  };

  const reset = () => {
    setPreview(null); setRows([]); setFileName('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const onFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    setPreview(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      const mapped = raw.map((r) => {
        const out = {};
        for (const [k, v] of Object.entries(r)) {
          const hit = COLUMNS.find((col) => norm(col) === norm(k)) || ALIASES[norm(k)] || null;
          if (hit) out[hit] = v;
        }
        return out;
      }).filter((r) => Object.values(r).some((v) => v !== '' && v != null));

      if (!mapped.length) {
        showToast('No usable rows found — check the column headers', 'error');
        return;
      }
      setRows(mapped);
      setBusy(true);
      setPreview(await accountingApi.importParties({ rows: mapped, dryRun: true }));
    } catch (err) {
      showToast(describeError(err, 'Could not read that file'), 'error');
    } finally { setBusy(false); }
  };

  const commit = async () => {
    setBusy(true);
    try {
      const res = await accountingApi.importParties({ rows });
      showToast(`Imported — ${res.createdCount} added, ${res.updatedCount} updated`, 'success');
      reset();
      onImported?.(res);
    } catch (err) {
      showToast(describeError(err, 'Import failed'), 'error');
    } finally { setBusy(false); }
  };

  const openingTotal = preview
    ? preview.created.reduce((s, r) => s + (Number(r.openingBalance) || 0), 0)
    : 0;

  return (
    <div>
      <div className="flex" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button className="btn btn-sm btn-ghost" onClick={downloadSample}>⬇️ Download sample sheet</button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={onFile}
          style={{ fontSize: 12.5 }} disabled={busy} />
        {fileName && <span style={{ fontSize: 12, color: 'var(--text3)' }}>{fileName}</span>}
      </div>

      <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 8 }}>
        Columns: {COLUMNS.join(', ')} · <b>name</b> is required · matched on GSTIN → phone → name
      </div>

      {busy && !preview && <div style={{ marginTop: 14, color: 'var(--text3)', fontSize: 13 }}>Reading…</div>}

      {preview && (
        <div className="card" style={{ marginTop: 14, padding: 14 }}>
          <div className="flex" style={{ gap: 18, flexWrap: 'wrap', marginBottom: 10 }}>
            <Stat label="Will be added" value={preview.createdCount} color="var(--green, #059669)" />
            <Stat label="Will be updated" value={preview.updatedCount} color="var(--blue, #2563EB)" />
            <Stat label="Skipped" value={preview.skippedCount} color={preview.skippedCount ? 'var(--red, #DC2626)' : 'var(--text3)'} />
            <Stat label="Rows read" value={preview.total} />
          </div>

          {openingTotal > 0 && (
            <div style={{ padding: '9px 12px', borderRadius: 8, background: 'rgba(245,158,11,.12)', color: 'var(--amber, #B45309)', fontSize: 12.5, marginBottom: 10 }}>
              ⚠️ ₹{openingTotal.toLocaleString('en-IN')} of opening balances will be posted to the ledger.
              Opening balances apply to NEW parties only — existing parties are updated without touching their balance.
            </div>
          )}

          {!!preview.skipped.length && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4, color: 'var(--red, #DC2626)' }}>Skipped rows</div>
              <div style={{ maxHeight: 120, overflowY: 'auto', fontSize: 12 }}>
                {preview.skipped.map((s, i) => (
                  <div key={i} style={{ color: 'var(--text2)' }}>Row {s.row}: {s.reason}</div>
                ))}
              </div>
            </div>
          )}

          <div style={{ maxHeight: 200, overflowY: 'auto', fontSize: 12.5, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
            {preview.created.map((r, i) => (
              <div key={'c' + i} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                <span><span style={{ color: 'var(--green, #059669)' }}>+</span> {r.name} <span style={{ color: 'var(--text3)' }}>({r.partyType})</span></span>
                {r.openingBalance > 0 && <span style={{ color: 'var(--text3)' }}>₹{Number(r.openingBalance).toLocaleString('en-IN')}</span>}
              </div>
            ))}
            {preview.updated.map((r, i) => (
              <div key={'u' + i} style={{ padding: '3px 0', color: 'var(--text2)' }}>
                <span style={{ color: 'var(--blue, #2563EB)' }}>~</span> {r.name} — {r.fields} field(s) updated
              </div>
            ))}
          </div>

          <div className="flex" style={{ gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
            <button className="btn btn-ghost btn-sm" onClick={reset} disabled={busy}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={commit}
              disabled={busy || (!preview.createdCount && !preview.updatedCount)}>
              {busy ? '…' : `Import ${preview.createdCount + preview.updatedCount} parties`}
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
