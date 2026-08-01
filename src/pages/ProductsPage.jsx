/**
 * Products — the generic resource table, with the bulk stock importer above it.
 *
 * A product IS its stock item here (see RESOURCES.products), so this page is
 * where opening stock, reorder level and pricing are maintained. The separate
 * Stock page covers raw materials and consumables.
 */
import ResourcePage from '../components/common/ResourcePage';
import StockBulkUpload from '../components/common/StockBulkUpload';
import { RESOURCES } from '../config/resources';

export default function ProductsPage() {
  return (
    <div>
      <StockBulkUpload />
      <ResourcePage config={RESOURCES.products} />
    </div>
  );
}
