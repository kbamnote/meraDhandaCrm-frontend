/**
 * Accounting → Items — the item master, with the bulk importer above it.
 *
 * The table itself is the generic ResourcePage over RESOURCES['accounting/items'];
 * this page exists only to put the importer on the screen people actually work
 * on. It lived solely on the older Products page, so anyone starting from
 * Accounting had no way to load a supplier's or an old system's stock list and
 * had to type hundreds of items in by hand.
 */
import { useState } from 'react';
import ResourcePage from '../../components/common/ResourcePage';
import StockBulkUpload from '../../components/common/StockBulkUpload';
import { RESOURCES } from '../../config/resources';

export default function AccountingItemsPage() {
  // Folded away by default: the import is occasional and the list is the point
  // of the page. Same pattern as the Purchases page's Import Excel.
  const [showImport, setShowImport] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between mb-2" style={{ gap: 8, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 12.5, color: 'var(--text3)' }}>
          Adding a lot of items at once? Import them from a spreadsheet instead of typing each one.
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => setShowImport((v) => !v)}>
          {showImport ? '✕ Close import' : '📥 Bulk Import Items'}
        </button>
      </div>
      {showImport && <StockBulkUpload />}
      <ResourcePage config={RESOURCES['accounting/items']} />
    </div>
  );
}
