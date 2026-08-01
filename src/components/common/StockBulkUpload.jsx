/**
 * Bulk stock upload — import products + opening stock from an Excel sheet.
 *
 * The file is parsed in the browser (xlsx) and posted as plain rows, so the API
 * never handles multipart uploads. Every import runs as a DRY RUN first: the
 * server reports exactly what it would create, update or skip, and nothing is
 * written until the user confirms. That matters because an import can overwrite
 * live stock figures.
 *
 * Rows match an existing product by SKU first, then by exact name.
 */
import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { stockApi } from '../../services/api';
import { showToast } from './toast';

// The columns the importer understands. Header matching is case/space-insensitive.
const COLUMNS = [
  'sku', 'name', 'category', 'type', 'unit',
  'purchasePrice', 'price', 'gst', 'hsn',
  'stock', 'lowStock', 'material',
];

// Two illustrative rows so the sample doubles as documentation.
const SAMPLE_ROWS = [
  {
    sku: 'BVC-001', name: 'Business Visiting Card', category: 'Printing', type: 'product',
    unit: 'PCS', purchasePrice: 120, price: 350, gst: '12', hsn: '4909',
    stock: 100, lowStock: 20, material: '250 GSM Art Paper',
  },
  {
    sku: 'ACR-3MM', name: '040 White Acrylic 3mm', category: 'Laser Cutting', type: 'product',
    unit: 'sqft', purchasePrice: 95, price: 150, gst: '18', hsn: '3920',
    stock: 40, lowStock: 10, material: '3mm cast acrylic sheet',
  },
];

const norm = (s) => String(s || '').trim().toLowerCase().replace(/[\s_-]/g, '');

export default function StockBulkUpload() {
  const fileRef = useRef(null);
  const [rows, setRows] = useState([]);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState('');

  const downloadSample = () => {
    const ws = XLSX.utils.json_to_sheet(SAMPLE_ROWS, { header: COLUMNS });
    ws['!cols'] = COLUMNS.map((c) => ({ wch: Math.max(12, c.length + 4) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Stock');
    XLSX.writeFile(wb, 'stock-upload-sample.xlsx');
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

      // Map whatever the user's headers are onto our known columns, so
      // "Sale Price", "sale_price" and "price" all land in the same field.
      const mapped = raw.map((r) => {
        const out = {};
        for (const [k, v] of Object.entries(r)) {
          const hit = COLUMNS.find((c) => norm(c) === norm(k))
            || (norm(k) === 'saleprice' ? 'price' : null)
            || (norm(k) === 'qty' || norm(k) === 'quantity' ? 'stock' : null)
            || (norm(k) === 'code' ? 'sku' : null);
          if (hit) out[hit] = v;
        }
        return out;
      }).filter((r) => Object.values(r).some((v) => v !== '' && v != null));

      if (!mapped.length) {
        showToast('No usable rows found — check the column headers', 'error');
        return;
      }
      setRows(mapped);
      // Dry run immediately so the user sees the impact before committing.
      setBusy(true);
      const res = await stockApi.bulk({ rows: mapped, dryRun: true });
      setPreview(res);
    } catch (err) {
      showToast(err.response?.data?.error || 'Could not read that file', 'error');
    } finally { setBusy(false); }
  };

  const commit = async () => {
    setBusy(true);
    try {
      const res = await stockApi.bulk({ rows });
      showToast(`Imported — ${res.counts.created} added, ${res.counts.updated} updated`, 'success');
      setPreview(null); setRows([]); setFileName('');
      if (fileRef.current) fileRef.current.value = '';
    } catch (err) {
      showToast(err.response?.data?.error || 'Import failed', 'error');
    } finally { setBusy(false); }
  };

  const reset = () => {
    setPreview(null); setRows([]); setFileName('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const c = preview?.counts;

  return (
    <div className="card" style={{ marginBottom: 14, padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <strong style={{ fontSize: 14 }}>📥 Bulk Stock Upload</strong>
        <span style={{ fontSize: 12, color: 'var(--text2)', flex: 1, minWidth: 200 }}>
          Import products with opening stock from Excel. Existing items are matched by SKU, then name.
        </span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={downloadSample}>
          ⬇ Sample file
        </button>
        <label className="btn btn-primary btn-sm" style={{ cursor: 'pointer', margin: 0 }}>
          📄 Choose Excel
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={onFile}
            style={{ display: 'none' }}
          />
        </label>
      </div>

      {fileName && (
        <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 8 }}>
          {busy ? 'Reading…' : `File: ${fileName} · ${rows.length} row(s)`}
        </div>
      )}

      {preview && (
        <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            <span className="badge badge-green">{c.created} to add</span>
            <span className="badge badge-amber">{c.updated} to update</span>
            {c.skipped > 0 && <span className="badge badge-red">{c.skipped} skipped</span>}
          </div>

          <div style={{ maxHeight: 200, overflow: 'auto', fontSize: 12 }}>
            {preview.updated.slice(0, 40).map((u) => (
              <div key={`u${u.row}`} style={{ padding: '3px 0', color: 'var(--text2)' }}>
                Row {u.row}: <b>{u.name}</b> — stock {u.from} → {u.to}
              </div>
            ))}
            {preview.created.slice(0, 40).map((n) => (
              <div key={`c${n.row}`} style={{ padding: '3px 0', color: 'var(--green)' }}>
                Row {n.row}: <b>{n.name}</b> — new item, stock {n.stock}
              </div>
            ))}
            {preview.skipped.map((s) => (
              <div key={`s${s.row}`} style={{ padding: '3px 0', color: 'var(--red)' }}>
                Row {s.row}: skipped — {s.reason}
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button type="button" className="btn btn-primary btn-sm" onClick={commit} disabled={busy || (!c.created && !c.updated)}>
              {busy ? 'Importing…' : `Confirm import (${c.created + c.updated})`}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={reset} disabled={busy}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
