/**
 * Section visibility map (single source of truth, shared by the Sidebar nav and
 * the route-level guard in App.jsx).
 *
 * Maps a route to the permission module that controls its visibility — the keys
 * shown in the Permissions "Access" editor. When an admin sets a teammate's
 * `<module>.read = false`, both the sidebar link AND the page itself are hidden,
 * even if the page reads a differently-named collection (e.g. the QC / Dispatch /
 * Production pages all read `jobs`, Sales Admin reads `sales`+`leads`, the
 * customer dashboard reads `jobs`+`invoices`). Self-service routes (/my-*) are
 * intentionally absent so a user can always see their own data. Admins/owners
 * bypass entirely.
 */
export const PERM_OF = {
  '/job-cards': 'jobs', '/job-detail': 'jobs', '/jobsetter': 'jobsetter',
  '/completed': 'completed', '/hold': 'hold',
  '/analytics': 'analytics',
  '/tasks': 'tasks',
  '/production': 'production', '/assign-prod': 'production', '/prod-steps': 'production',
  '/qc': 'qc', '/dispatch': 'dispatch',
  '/designers': 'designers', '/designer': 'designers', '/designers-view': 'designers',
  // A quotation is a priced sales document, so it sits with invoices rather
  // than with leads — whoever may see what was billed may see what was quoted.
  '/quotations': 'invoices',
  // A receipt is money against a bill, so it follows the same grant as
  // the bills themselves rather than needing one of its own.
  '/payments/in': 'invoices',
  // The voucher itself can be either side, so it follows whichever
  // grant already lets you see payments at all.
  '/payment-view': ['invoices', 'purchases'],
  '/payments/out': 'purchases',
  '/leads-crm': 'leads', '/sales-panel': 'leads',
  // The company's own sales figures — every colleague's revenue, the totals,
  // and the box that sets anybody's target. A different question from "let
  // this rep work the lead list", so a different grant.
  '/sales-admin': 'salesAdmin',
  '/accounting': 'invoices', '/invoice-view': 'invoices', '/client-ledger': 'invoices',
  '/accounting/sales': 'invoices', '/accounting/purchases': 'purchases',
  '/purchase-view': 'purchases',
  '/accounting/parties': 'parties', '/accounting/reports': 'reports', '/accounting/gst': 'gst',
  // The Reports directory is a list of links, not data, so either grant opens
  // it — and the list itself hides whatever the reader cannot reach.
  '/reports': ['reports', 'gst'],
  // The GST registers. Their APIs are behind requireModule('gst'), so anything
  // looser here would put links in the nav that answer 403.
  '/reports/gstr1': 'gst',
  '/reports/gstr2': 'gst',
  '/reports/hsn-sales-summary': 'gst',
  '/reports/gstr3b': 'gst',
  '/reports/gst-sales-hsn': 'gst',
  '/reports/gst-purchase-hsn': 'gst',
  '/accounting/cash': 'cashbank', '/accounting/recon': 'cashbank', '/accounting/inventory': 'inventory', '/accounting/entries': 'entries',
  '/accounting/tds': 'tds',
  // Routes with NO entry here are treated as ungated and shown to every role
  // (see isSectionHidden). These four all expose company-wide financials, so
  // they map onto the modules their APIs already require — the backend gates
  // them with requireModule('entries'/'reports'), and without these lines the
  // nav would offer links that then fail with 403.
  '/accounting/daybook': 'entries',
  '/accounting/profit': 'reports',
  '/accounting/job-profit': 'reports',
  '/accounting/year-end': 'reports',
  // Everything under Accounting follows the module whose data it shows. These
  // had no entry, which meant "ungated" — a designer with nothing granted still
  // got Items, Credit Notes, Debit Notes, Challans, Recurring, Branches and
  // Search in their sidebar, and no permission could take them away.
  // The item master is the Products catalog AND the collection the Inventory
  // module is built on (backend SECTION_COLLECTIONS.inventory covers
  // `products`), so either grant opens it. Gated on `products` alone, an
  // accountant granted Inventory had the server serving the data while the nav
  // and the route guard hid the page.
  '/accounting/items': ['products', 'inventory'],
  '/accounting/credit-notes': 'invoices',
  '/accounting/debit-notes': 'invoices',
  '/accounting/challans': 'invoices',
  '/accounting/recurring': 'invoices',
  '/accounting/branches': 'reports',
  '/accounting/search': 'reports',
  // Same hole on the sales side: these three read the enquiry/sample/bulk-order
  // pipeline, which is what the Leads module covers.
  '/enquiry': 'leads', '/sample-dm': 'leads', '/bulk-orders': 'leads',
  '/expenses': 'expenses', '/purchase-orders': 'expenses',
  '/products': 'products', '/stock': 'stock', '/vendors': 'vendors',
  '/machines': 'machines', '/machine-history': 'machines',
  '/cust-dashboard': 'clients', '/customer-outbox': 'clients', '/review': 'review',
  // Where the field team is. No role carries this by default — see
  // ROLE_READ_DEFAULTS — so it is granted per person in Permissions. A rep
  // reaching their OWN route is allowed by the server regardless; this only
  // governs the sidebar link and the route guard.
  '/tracking': 'tracking', '/tracking/route': 'tracking',
  // Filed by the field team from the phone; read here. Sales reps have it by
  // role default, so a rep sees their own visits without being granted
  // anything — the server shows them only theirs.
  '/visits': 'visits',
  '/attendance': 'attendance', '/hr-attendance': 'attendance',
  '/hr-leaves': 'leaves', '/hr-payroll': 'payroll', '/productivity': 'productivity',
};

const ADMIN_ROLES = ['admin', 'superadmin', 'owner'];

// Gated modules (allow-list) — must stay in sync with the backend
// (src/config/visibility.js) and the app (src/config/nav.js).
export const CORE_MODULES = [
  'jobs', 'production', 'qc', 'dispatch', 'designers', 'clients', 'leads', 'salesAdmin',
  'invoices', 'expenses', 'stock', 'products', 'vendors', 'machines', 'tasks', 'attendance',
];
const ACCOUNTING_MODULES = ['parties', 'purchases', 'inventory', 'cashbank', 'gst', 'reports', 'entries', 'tds'];
export const GATED_MODULES = [...CORE_MODULES, 'leaves', 'payroll', 'productivity', 'review', 'tracking', 'fieldTrack', 'visits', ...ACCOUNTING_MODULES];

// What each built-in job role can see out of the box. Plain staff/pending start
// with only the basics (non-gated routes); admins bypass entirely.
export const ROLE_READ_DEFAULTS = {
  manager: [...CORE_MODULES, 'productivity', 'review', 'completed', 'hold', 'jobsetter', 'analytics', 'parties', 'gst', 'reports', 'salesAdmin'],
  floor_manager: ['jobs', 'production', 'qc', 'dispatch', 'designers', 'machines', 'stock', 'tasks', 'completed', 'hold', 'jobsetter'],
  designer: ['designers', 'jobs', 'tasks', 'completed', 'hold', 'jobsetter'],
  jobsetter: ['jobs', 'production', 'tasks', 'completed', 'hold', 'jobsetter'],
  // A field rep: their customers, their tasks, their shop visits — and their
  // own location shared while punched in. Deliberately NOT `invoices`,
  // `parties` or `reports`: those unlocked the whole Accounting menu (the
  // dashboard, credit/debit notes, Profitability, Job Profit, Year-End Close,
  // Branches), which is company financials nobody granted them. An owner who
  // wants a rep to see invoices can tick it in Permissions — that is what the
  // allow-list is for. Leads and the Sales Panel are out too: the rep's work
  // now starts from a shop visit.
  sales: ['clients', 'tasks', 'review', 'fieldTrack', 'visits'],
  hr: ['attendance', 'tasks', 'leaves', 'payroll', 'productivity'],
  accountant: [...CORE_MODULES, ...ACCOUNTING_MODULES, 'leaves', 'payroll', 'productivity'],
  cashier: ['clients', 'invoices', 'payments', 'parties', 'cashbank'], // no reports/gst — payments + cash only
  inventory: ['products', 'stock', 'vendors', 'purchases', 'inventory', 'parties'],
  viewer: ['invoices', 'parties', 'gst', 'reports'],
  staff: [],
  pending: [],
};

// Grouped permission catalog (single source for the Permissions editor UI —
// web PermissionsPage + app PermissionsScreen mirror this). Each feature stores
// `<key>.read` (View) and, when `manage` is true, `<key>.write` (Manage =
// create/edit/delete). Labels are i18n keys resolved in the UI. Modules backed
// by a real collection enforce server-side; `productivity` is view-only (nav).
export const PERMISSION_CATALOG = [
  { group: 'jobsProd', features: [
    { key: 'jobs', manage: true },
    { key: 'completed', manage: false }, { key: 'hold', manage: false },
    { key: 'jobsetter', manage: false },
    { key: 'production', manage: true },
    { key: 'qc', manage: true }, { key: 'dispatch', manage: true },
    { key: 'designers', manage: true }, { key: 'machines', manage: true },
  ] },
  { group: 'salesCust', features: [
    { key: 'leads', manage: true }, { key: 'clients', manage: true },
    { key: 'salesAdmin', manage: false },
    { key: 'products', manage: true }, { key: 'stock', manage: true },
    { key: 'vendors', manage: true }, { key: 'review', manage: false },
  ] },
  { group: 'accounting', features: [
    { key: 'invoices', manage: true }, { key: 'expenses', manage: true },
    { key: 'parties', manage: true }, { key: 'purchases', manage: true },
    { key: 'inventory', manage: true }, { key: 'cashbank', manage: true },
    { key: 'entries', manage: true }, { key: 'gst', manage: false },
    { key: 'reports', manage: false }, { key: 'tds', manage: true },
  ] },
  // NOTE: payroll is intentionally absent — it's in the backend SENSITIVE_NO_GRANT
  // set (salary data, owner/HR-only). Including it would make sanitizePermissions
  // reject the whole save. Make it grantable only by removing payroll from that
  // backend set (a deliberate decision).
  { group: 'hr', features: [
    { key: 'attendance', manage: true }, { key: 'leaves', manage: true },
    { key: 'productivity', manage: false },
  ] },
  { group: 'workspace', features: [
    { key: 'tasks', manage: true }, { key: 'analytics', manage: false },
  ] },
  // Field tracking. Two separate things, deliberately: WATCHING the team
  // (`tracking`) and a person's own phone SHARING its position (`fieldTrack`).
  // Nobody watches by default; sales reps share by role default, and this is
  // where you excuse one of them without changing their role.
  { group: 'tracking', features: [
    { key: 'tracking', manage: false },
    { key: 'fieldTrack', manage: false },
    { key: 'visits', manage: false },
  ] },
];

// Can this role see this gated module? Explicit grant/revoke wins, else role default.
export function canViewModule(role, module, permissions) {
  if (ADMIN_ROLES.includes(role)) return true;
  // A route may name MORE THAN ONE module when its data belongs to several —
  // the item master is both the Products catalog and what the Inventory module
  // is built on. Any one of them unlocks it, the same way the server treats a
  // collection as readable when any covering section grants it
  // (canReadCollection in backend routes/db.js). With one module the behaviour
  // is unchanged.
  const mods = Array.isArray(module) ? module : [module];
  const flag = (m) => (permissions ? permissions[`${m}.read`] : undefined);
  if (mods.some((m) => flag(m) === true)) return true;
  if (mods.some((m) => (ROLE_READ_DEFAULTS[role] || []).includes(m) && flag(m) !== false)) return true;
  return false;
}

// True if this route should be hidden/blocked for the given profile (allow-list).
export function isSectionHidden(path, profile) {
  if (!profile) return false;
  if (ADMIN_ROLES.includes(profile.role)) return false; // admins/owners see everything
  const mod = PERM_OF[path];
  if (!mod) return false; // not a gated section → a "basic", always visible
  return !canViewModule(profile.role, mod, profile.permissions);
}
