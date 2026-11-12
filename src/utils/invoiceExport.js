/**
 * Spreadsheet rows for the Sales Invoices and Purchase Invoices "Export Excel"
 * buttons. Each page passes the list it is SHOWING (status chip, period, amount
 * range and search already applied), so the file matches the screen.
 *
 * Amounts are plain numbers (not "₹1,074"), so Excel can sum and sort them;
 * dates stay as the YYYY-MM-DD the documents carry.
 */
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const num = (v) => (v == null || v === '' ? '' : round2(v));

const SALES_TYPE = { invoice: 'Tax Invoice', proforma: 'Proforma', cash: 'Cash Bill' };
const SALES_STATUS = { unpaid: 'Unpaid', partial: 'Partial', paid: 'Paid', void: 'Cancelled' };

export function salesInvoiceGrid(list) {
  const headers = [
    'Invoice No', 'Type', 'Date', 'Due Date', 'Customer', 'Customer GSTIN', 'Job No', 'Status',
    'Taxable (₹)', 'CGST (₹)', 'SGST (₹)', 'IGST (₹)', 'Total GST (₹)', 'Discount (₹)', 'Round Off (₹)',
    'Total (₹)', 'Received (₹)', 'Balance (₹)',
  ];
  const rows = (list || []).map((i) => {
    const cancelled = i.status === 'void';
    const total = round2(i.total);
    const paid = round2(i.paidAmount);
    const taxable = i.taxableValue != null ? i.taxableValue : round2((Number(i.subtotal) || 0) - (Number(i.discount) || 0));
    return [
      i.invoiceNo || '', SALES_TYPE[i.type] || i.type || '', i.date || '', i.dueDate || '',
      i.clientName || '', i.clientGstNo || '', i.jobNo || '',
      SALES_STATUS[i.status || 'unpaid'] || i.status || '',
      num(taxable), num(i.cgst), num(i.sgst), num(i.igst), num(i.taxTotal), num(i.discount), num(i.roundOff),
      total, paid,
      // A cancelled invoice is owed nothing; a proforma isn't a debt at all.
      cancelled || i.type === 'proforma' ? 0 : round2(Math.max(0, total - paid)),
    ];
  });
  return { headers, rows };
}

const PURCHASE_STATUS = {
  unpaid: 'Unpaid', partial: 'Partial', paid: 'Paid', draft: 'Draft order', sent: 'Order sent', cancelled: 'Cancelled',
};

// `standing(p)` is the page's own status rule (purchaseStanding), passed in so
// the file says exactly what the badge on screen says.
export function purchaseGrid(list, standing) {
  const headers = [
    'Our No', 'Supplier Bill No', 'Date', 'Due Date', 'Supplier', 'Supplier GSTIN', 'Status',
    'Taxable (₹)', 'CGST (₹)', 'SGST (₹)', 'IGST (₹)', 'Total GST (₹)', 'Discount (₹)', 'TDS (₹)', 'TCS (₹)',
    'Round Off (₹)', 'Total (₹)', 'Paid (₹)', 'Balance (₹)',
  ];
  const rows = (list || []).map((p) => {
    const st = standing ? standing(p) : String(p.status || '');
    const total = round2(p.total);
    const paid = round2(p.paidAmount);
    const isBill = ['unpaid', 'partial', 'paid'].includes(st);
    return [
      p.poNo || '', p.supplierInvoiceNo || '', p.date || '', p.dueDate || '',
      p.vendorName || '', p.vendorGstNo || '', PURCHASE_STATUS[st] || st,
      num(p.taxable != null ? p.taxable : p.subtotal), num(p.cgst), num(p.sgst), num(p.igst), num(p.taxTotal),
      num(p.discount), num(p.tds), num(p.tcs), num(p.roundOff),
      total, paid,
      // Only a received bill is owed; an order isn't a debt yet.
      isBill ? round2(Math.max(0, total - paid)) : 0,
    ];
  });
  return { headers, rows };
}

// 'sales-invoices-2026-11-12.xlsx'
export const exportFileName = (base) => `${base}-${new Date().toISOString().slice(0, 10)}.xlsx`;
