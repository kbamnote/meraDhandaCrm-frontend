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
  '/leads-crm': 'leads', '/sales-panel': 'leads', '/sales-admin': 'leads',
  '/accounting': 'invoices', '/invoice-view': 'invoices', '/client-ledger': 'invoices',
  '/expenses': 'expenses', '/purchase-orders': 'expenses',
  '/products': 'products', '/stock': 'stock', '/vendors': 'vendors',
  '/machines': 'machines', '/machine-history': 'machines',
  '/cust-dashboard': 'clients', '/customer-outbox': 'clients', '/review': 'review',
  '/attendance': 'attendance', '/hr-attendance': 'attendance',
  '/hr-leaves': 'leaves', '/hr-payroll': 'payroll', '/productivity': 'productivity',
};

const ADMIN_ROLES = ['admin', 'superadmin', 'owner'];

// Gated modules (allow-list) — must stay in sync with the backend
// (src/config/visibility.js) and the app (src/config/nav.js).
export const CORE_MODULES = [
  'jobs', 'production', 'qc', 'dispatch', 'designers', 'clients', 'leads',
  'invoices', 'expenses', 'stock', 'products', 'vendors', 'machines', 'tasks', 'attendance',
];
export const GATED_MODULES = [...CORE_MODULES, 'leaves', 'payroll', 'productivity', 'review'];

// What each built-in job role can see out of the box. Plain staff/pending start
// with only the basics (non-gated routes); admins bypass entirely.
export const ROLE_READ_DEFAULTS = {
  manager: [...CORE_MODULES, 'productivity', 'review', 'completed', 'hold', 'jobsetter', 'analytics'],
  floor_manager: ['jobs', 'production', 'qc', 'dispatch', 'designers', 'machines', 'stock', 'tasks', 'completed', 'hold', 'jobsetter'],
  designer: ['designers', 'jobs', 'tasks', 'completed', 'hold', 'jobsetter'],
  jobsetter: ['jobs', 'production', 'tasks', 'completed', 'hold', 'jobsetter'],
  sales: ['leads', 'clients', 'invoices', 'tasks', 'review'],
  hr: ['attendance', 'tasks', 'leaves', 'payroll', 'productivity'],
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
    { key: 'products', manage: true }, { key: 'stock', manage: true },
    { key: 'vendors', manage: true }, { key: 'review', manage: false },
  ] },
  { group: 'accounting', features: [
    { key: 'invoices', manage: true }, { key: 'expenses', manage: true },
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
];

// Can this role see this gated module? Explicit grant/revoke wins, else role default.
export function canViewModule(role, module, permissions) {
  if (ADMIN_ROLES.includes(role)) return true;
  const g = permissions ? permissions[`${module}.read`] : undefined;
  if (g === true) return true;
  if (g === false) return false;
  return (ROLE_READ_DEFAULTS[role] || []).includes(module);
}

// True if this route should be hidden/blocked for the given profile (allow-list).
export function isSectionHidden(path, profile) {
  if (!profile) return false;
  if (ADMIN_ROLES.includes(profile.role)) return false; // admins/owners see everything
  const mod = PERM_OF[path];
  if (!mod) return false; // not a gated section → a "basic", always visible
  return !canViewModule(profile.role, mod, profile.permissions);
}
