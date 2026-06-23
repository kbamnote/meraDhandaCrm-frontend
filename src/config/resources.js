/**
 * Resource configs for the data-driven ResourcePage.
 *
 * Keyed by ROUTE PATH (matches the route paths in App.jsx). Each config drives
 * one CRUD page:
 *   collection  — Mongo collection / legacy mpw/<collection> path
 *   fields[]    — { key, label, type, required?, table?, options?, default? }
 *                 type: text | textarea | number | date | tel | email | select
 *                 table:true → shown as a column in the list
 *   writeRoles  — roles allowed to create/edit/delete (MUST match backend
 *                 writeGuard in routes/db.js, or writes will 403)
 *   readOnly    — list only, no create/edit/delete (e.g. identity collections)
 *
 * NOTE: editing sends a PATCH with only these fields, so any extra fields on a
 * record (e.g. from the legacy data) are preserved untouched.
 */

const ADMIN = ['admin', 'superadmin', 'owner'];
const ADMIN_SALES = [...ADMIN, 'sales'];
const ADMIN_HR = [...ADMIN, 'hr'];
const ADMIN_DESIGNER = [...ADMIN, 'designer'];

const STATUS_ACTIVE = ['active', 'inactive'];

export const RESOURCES = {
  vendors: {
    collection: 'vendors', title: '🏪 Vendors', plural: 'Vendors', singular: 'Vendor',
    legacyId: 'page-vendors', writeRoles: ADMIN,
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true, table: true },
      { key: 'company', label: 'Company', type: 'text', table: true },
      { key: 'phone', label: 'Phone', type: 'tel', table: true },
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'gstNo', label: 'GST No.', type: 'text' },
      { key: 'address', label: 'Address', type: 'textarea' },
      { key: 'status', label: 'Status', type: 'select', options: STATUS_ACTIVE, table: true },
    ],
  },

  products: {
    collection: 'products', title: '🛍 Products', plural: 'Products', singular: 'Product',
    legacyId: 'page-products', writeRoles: ADMIN,
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true, table: true },
      { key: 'category', label: 'Category', type: 'text', table: true },
      { key: 'sku', label: 'SKU', type: 'text', table: true },
      { key: 'price', label: 'Price (₹)', type: 'number', table: true },
      { key: 'unit', label: 'Unit', type: 'text' },
      { key: 'hsn', label: 'HSN', type: 'text' },
      { key: 'stock', label: 'Stock', type: 'number' },
      { key: 'status', label: 'Status', type: 'select', options: STATUS_ACTIVE },
    ],
  },

  'client-ledger': {
    collection: 'clients', title: '📒 Clients', plural: 'Clients', singular: 'Client',
    legacyId: 'page-client-ledger', writeRoles: ADMIN_SALES,
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true, table: true },
      { key: 'company', label: 'Company', type: 'text', table: true },
      { key: 'phone', label: 'Phone', type: 'tel', table: true },
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'gstNo', label: 'GST No.', type: 'text' },
      { key: 'city', label: 'City', type: 'text', table: true },
      { key: 'address', label: 'Address', type: 'textarea' },
    ],
  },

  'leads-crm': {
    collection: 'leads', title: '📞 Leads CRM', plural: 'Leads', singular: 'Lead',
    legacyId: 'page-leads-crm', writeRoles: ADMIN_SALES,
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true, table: true },
      { key: 'phone', label: 'Phone', type: 'tel', table: true },
      { key: 'source', label: 'Source', type: 'text', table: true },
      { key: 'stage', label: 'Stage', type: 'select', table: true,
        options: ['new', 'contacted', 'qualified', 'quoted', 'won', 'lost'] },
      { key: 'city', label: 'City', type: 'text' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },

  machines: {
    collection: 'machines', title: '⚙️ Machines', plural: 'Machines', singular: 'Machine',
    legacyId: 'page-machines', writeRoles: ADMIN,
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true, table: true },
      { key: 'type', label: 'Type', type: 'text', table: true },
      { key: 'model', label: 'Model', type: 'text' },
      { key: 'location', label: 'Location', type: 'text', table: true },
      { key: 'status', label: 'Status', type: 'select', table: true,
        options: ['operational', 'maintenance', 'idle', 'down'] },
    ],
  },

  'machine-history': {
    collection: 'machineHistory', title: '🕐 Machine History', plural: 'Entries', singular: 'Entry',
    legacyId: 'page-machine-history', writeRoles: ADMIN,
    fields: [
      { key: 'machine', label: 'Machine', type: 'text', required: true, table: true },
      { key: 'event', label: 'Event', type: 'text', table: true },
      { key: 'date', label: 'Date', type: 'date', table: true },
      { key: 'note', label: 'Note', type: 'textarea' },
    ],
  },

  'dept-mgmt': {
    collection: 'departments', title: '🏢 Departments', plural: 'Departments', singular: 'Department',
    legacyId: 'page-dept-mgmt', writeRoles: ADMIN_HR,
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true, table: true },
      { key: 'head', label: 'Head', type: 'text', table: true },
      { key: 'description', label: 'Description', type: 'textarea' },
    ],
  },

  enquiry: {
    collection: 'enquiries', title: '❓ Enquiries', plural: 'Enquiries', singular: 'Enquiry',
    legacyId: 'page-enquiry', writeRoles: ADMIN_SALES,
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true, table: true },
      { key: 'phone', label: 'Phone', type: 'tel', table: true },
      { key: 'product', label: 'Product', type: 'text', table: true },
      { key: 'quantity', label: 'Quantity', type: 'number' },
      { key: 'status', label: 'Status', type: 'select', table: true,
        options: ['open', 'quoted', 'converted', 'closed'] },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },

  'sample-dm': {
    collection: 'samples', title: '📦 Sample DM', plural: 'Samples', singular: 'Sample',
    legacyId: 'page-sample-dm', writeRoles: ADMIN_SALES,
    fields: [
      { key: 'client', label: 'Client', type: 'text', required: true, table: true },
      { key: 'product', label: 'Product', type: 'text', table: true },
      { key: 'quantity', label: 'Quantity', type: 'number' },
      { key: 'status', label: 'Status', type: 'select', table: true,
        options: ['requested', 'in_progress', 'sent', 'approved', 'rejected'] },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },

  'bulk-orders': {
    collection: 'bulkOrders', title: '📑 Bulk Orders', plural: 'Bulk Orders', singular: 'Order',
    legacyId: 'page-bulk-orders', writeRoles: ADMIN_SALES,
    fields: [
      { key: 'client', label: 'Client', type: 'text', required: true, table: true },
      { key: 'product', label: 'Product', type: 'text', table: true },
      { key: 'quantity', label: 'Quantity', type: 'number', table: true },
      { key: 'rate', label: 'Rate (₹)', type: 'number' },
      { key: 'status', label: 'Status', type: 'select', table: true,
        options: ['pending', 'confirmed', 'in_production', 'delivered'] },
      { key: 'deliveryDate', label: 'Delivery Date', type: 'date' },
    ],
  },

  stock: {
    collection: 'stock', title: '📦 Stock', plural: 'Items', singular: 'Item',
    legacyId: 'page-stock', writeRoles: ADMIN,
    fields: [
      { key: 'item', label: 'Item', type: 'text', required: true, table: true },
      { key: 'category', label: 'Category', type: 'text', table: true },
      { key: 'quantity', label: 'Quantity', type: 'number', table: true },
      { key: 'unit', label: 'Unit', type: 'text' },
      { key: 'reorderLevel', label: 'Reorder Level', type: 'number' },
      { key: 'location', label: 'Location', type: 'text' },
    ],
  },

  designers: {
    collection: 'designers', title: '🎨 Designers', plural: 'Designers', singular: 'Designer',
    legacyId: 'page-designers', writeRoles: ADMIN_DESIGNER,
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true, table: true },
      { key: 'phone', label: 'Phone', type: 'tel', table: true },
      { key: 'specialization', label: 'Specialization', type: 'text', table: true },
      { key: 'status', label: 'Status', type: 'select', options: STATUS_ACTIVE, table: true },
    ],
  },

  jobsetter: {
    collection: 'jobs', title: '🛠 Job Setter', plural: 'Jobs', singular: 'Job',
    legacyId: 'page-jobsetter', writeRoles: ADMIN_DESIGNER,
    fields: [
      { key: 'title', label: 'Title', type: 'text', required: true, table: true },
      { key: 'client', label: 'Client', type: 'text', table: true },
      { key: 'product', label: 'Product', type: 'text', table: true },
      { key: 'quantity', label: 'Quantity', type: 'number' },
      { key: 'status', label: 'Status', type: 'select', table: true,
        options: ['queued', 'design', 'production', 'qc', 'done'] },
      { key: 'deadline', label: 'Deadline', type: 'date', table: true },
    ],
  },

  production: {
    collection: 'production', title: '🏭 Production', plural: 'Jobs', singular: 'Job',
    legacyId: 'page-production', writeRoles: ADMIN,
    fields: [
      { key: 'job', label: 'Job', type: 'text', required: true, table: true },
      { key: 'stage', label: 'Stage', type: 'text', table: true },
      { key: 'operator', label: 'Operator', type: 'text', table: true },
      { key: 'machine', label: 'Machine', type: 'text' },
      { key: 'status', label: 'Status', type: 'select', table: true,
        options: ['pending', 'running', 'paused', 'complete'] },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },

  qc: {
    collection: 'qc', title: '🔍 Quality Control', plural: 'Checks', singular: 'Check',
    legacyId: 'page-qc', writeRoles: ADMIN,
    fields: [
      { key: 'job', label: 'Job', type: 'text', required: true, table: true },
      { key: 'result', label: 'Result', type: 'select', table: true,
        options: ['pass', 'fail', 'rework'] },
      { key: 'inspector', label: 'Inspector', type: 'text', table: true },
      { key: 'date', label: 'Date', type: 'date', table: true },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },

  dispatch: {
    collection: 'dispatch', title: '🚚 Dispatch', plural: 'Dispatches', singular: 'Dispatch',
    legacyId: 'page-dispatch', writeRoles: ADMIN,
    fields: [
      { key: 'job', label: 'Job', type: 'text', required: true, table: true },
      { key: 'client', label: 'Client', type: 'text', table: true },
      { key: 'courier', label: 'Courier', type: 'text', table: true },
      { key: 'trackingNo', label: 'Tracking No.', type: 'text', table: true },
      { key: 'status', label: 'Status', type: 'select', table: true,
        options: ['packed', 'shipped', 'delivered', 'returned'] },
      { key: 'dispatchDate', label: 'Dispatch Date', type: 'date' },
    ],
  },

  'sales-panel': {
    collection: 'sales', title: '💼 Sales', plural: 'Sales', singular: 'Sale',
    legacyId: 'page-sales-panel', writeRoles: ADMIN_SALES,
    fields: [
      { key: 'client', label: 'Client', type: 'text', required: true, table: true },
      { key: 'product', label: 'Product', type: 'text', table: true },
      { key: 'amount', label: 'Amount (₹)', type: 'number', table: true },
      { key: 'salesperson', label: 'Salesperson', type: 'text', table: true },
      { key: 'status', label: 'Status', type: 'select', table: true,
        options: ['open', 'won', 'lost'] },
      { key: 'date', label: 'Date', type: 'date' },
    ],
  },

  accounting: {
    collection: 'invoices', title: '💰 Accounting — Invoices', plural: 'Invoices', singular: 'Invoice',
    legacyId: 'page-accounting', writeRoles: ADMIN_SALES,
    fields: [
      { key: 'invoiceNo', label: 'Invoice No.', type: 'text', required: true, table: true },
      { key: 'client', label: 'Client', type: 'text', table: true },
      { key: 'amount', label: 'Amount (₹)', type: 'number', table: true },
      { key: 'status', label: 'Status', type: 'select', table: true,
        options: ['unpaid', 'partial', 'paid'] },
      { key: 'date', label: 'Date', type: 'date', table: true },
      { key: 'dueDate', label: 'Due Date', type: 'date' },
    ],
  },

  'hr-leaves': {
    collection: 'leaves', title: '🏖 Leaves', plural: 'Leaves', singular: 'Leave',
    legacyId: 'page-hr-leaves', writeRoles: ADMIN_HR,
    fields: [
      { key: 'username', label: 'Employee', type: 'text', required: true, table: true },
      { key: 'type', label: 'Type', type: 'select', table: true,
        options: ['casual', 'sick', 'earned', 'unpaid'] },
      { key: 'fromDate', label: 'From', type: 'date', table: true },
      { key: 'toDate', label: 'To', type: 'date', table: true },
      { key: 'status', label: 'Status', type: 'select', table: true,
        options: ['pending', 'approved', 'rejected'] },
      { key: 'reason', label: 'Reason', type: 'textarea' },
    ],
  },

  'hr-payroll': {
    collection: 'payroll', title: '💵 Payroll', plural: 'Slips', singular: 'Slip',
    legacyId: 'page-hr-payroll', writeRoles: ADMIN_HR,
    fields: [
      { key: 'username', label: 'Employee', type: 'text', required: true, table: true },
      { key: 'month', label: 'Month', type: 'text', table: true },
      { key: 'year', label: 'Year', type: 'number', table: true },
      { key: 'basic', label: 'Basic (₹)', type: 'number' },
      { key: 'allowances', label: 'Allowances (₹)', type: 'number' },
      { key: 'deductions', label: 'Deductions (₹)', type: 'number' },
      { key: 'net', label: 'Net (₹)', type: 'number', table: true },
    ],
  },

  attendance: {
    collection: 'attendance', title: '🕒 Attendance', plural: 'Records', singular: 'Record',
    legacyId: 'page-attendance', writeRoles: ADMIN_HR,
    fields: [
      { key: 'username', label: 'Employee', type: 'text', required: true, table: true },
      { key: 'date', label: 'Date', type: 'date', table: true },
      { key: 'loginTime', label: 'Login', type: 'text', table: true },
      { key: 'logoutTime', label: 'Logout', type: 'text', table: true },
      { key: 'status', label: 'Status', type: 'select', table: true,
        options: ['present', 'absent', 'half-day', 'leave'] },
    ],
  },

  broadcast: {
    collection: 'tenantNotifications', title: '📣 Broadcast', plural: 'Broadcasts', singular: 'Broadcast',
    legacyId: 'page-broadcast', writeRoles: ADMIN,
    fields: [
      { key: 'title', label: 'Title', type: 'text', required: true, table: true },
      { key: 'message', label: 'Message', type: 'textarea', required: true },
      { key: 'audience', label: 'Audience', type: 'select', table: true,
        options: ['all', 'staff', 'designers', 'sales', 'hr'] },
    ],
  },

  // Identity collection — managed via /api/auth, so list-only here.
  'hr-staff': {
    collection: 'users', title: '🧑‍💼 Staff', plural: 'Staff', singular: 'Staff',
    legacyId: 'page-hr-staff', readOnly: true,
    fields: [
      { key: 'name', label: 'Name', type: 'text', table: true },
      { key: 'phone', label: 'Phone', type: 'tel', table: true },
      { key: 'role', label: 'Role', type: 'text', table: true },
      { key: 'customRole', label: 'Custom Role', type: 'text', table: true },
      { key: 'department', label: 'Department', type: 'text', table: true },
    ],
  },
};
