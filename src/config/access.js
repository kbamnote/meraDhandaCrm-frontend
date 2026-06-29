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
  '/job-cards': 'jobs', '/job-detail': 'jobs', '/jobsetter': 'jobs',
  '/tasks': 'tasks',
  '/production': 'production', '/assign-prod': 'production', '/prod-steps': 'production',
  '/qc': 'qc', '/dispatch': 'dispatch',
  '/designers': 'designers', '/designer': 'designers', '/designers-view': 'designers',
  '/leads-crm': 'leads', '/sales-panel': 'leads', '/sales-admin': 'leads',
  '/accounting': 'invoices', '/invoice-view': 'invoices', '/client-ledger': 'invoices',
  '/expenses': 'expenses', '/purchase-orders': 'expenses',
  '/products': 'products', '/stock': 'stock', '/vendors': 'vendors',
  '/machines': 'machines', '/machine-history': 'machines',
  '/cust-dashboard': 'clients',
  '/attendance': 'attendance',
};

const ADMIN_ROLES = ['admin', 'superadmin', 'owner'];

// Gated modules (allow-list) — must stay in sync with the backend
// (src/config/visibility.js) and the app (src/config/nav.js).
export const GATED_MODULES = [
  'jobs', 'production', 'qc', 'dispatch', 'designers', 'clients', 'leads',
  'invoices', 'expenses', 'stock', 'products', 'vendors', 'machines', 'tasks', 'attendance',
];

// What each built-in job role can see out of the box. Plain staff/pending start
// with only the basics (non-gated routes); admins bypass entirely.
export const ROLE_READ_DEFAULTS = {
  manager: [...GATED_MODULES],
  floor_manager: ['jobs', 'production', 'qc', 'dispatch', 'designers', 'machines', 'stock', 'tasks'],
  designer: ['designers', 'jobs', 'tasks'],
  jobsetter: ['jobs', 'production', 'tasks'],
  sales: ['leads', 'clients', 'invoices', 'tasks'],
  hr: ['attendance', 'tasks'],
  staff: [],
  pending: [],
};

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
