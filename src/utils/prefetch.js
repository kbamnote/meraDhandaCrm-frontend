/**
 * Route prefetching on idle and hover.
 *
 * When a user hovers over a navigation link or dashboard tile, or during browser
 * idle time after login, this loads the route's JS chunk into browser cache.
 * By the time the user clicks, the chunk is already cached, eliminating page-switch lag.
 */

const PREFETCH_LOADERS = {
  '/admin': () => import('../pages/RoleDashboard'),
  '/job-cards': () => import('../pages/JobCardsPage'),
  '/tasks': () => import('../pages/TasksPage'),
  '/chat': () => import('../pages/ChatPage'),
  '/accounting': () => import('../pages/accounting/AccountingDashboardPage'),
  '/accounting/sales': () => import('../pages/accounting/SalesInvoicesPage'),
  '/accounting/parties': () => import('../pages/accounting/PartiesPage'),
  '/accounting/items': () => import('../pages/accounting/ItemsPage'),
  '/accounting/cash': () => import('../pages/accounting/CashBankPage'),
  '/quotations': () => import('../pages/accounting/QuotationsPage'),
  '/payments/in': () => import('../pages/accounting/PaymentsPage'),
  '/payments/out': () => import('../pages/accounting/PaymentsPage'),
  '/hr-attendance': () => import('../pages/HrAttendancePage'),
  '/hr-payroll': () => import('../pages/HrPayrollPage'),
  '/leads-crm': () => import('../pages/SalesPage'),
  '/production': () => import('../pages/ProductionPage'),
  '/qc': () => import('../pages/QCPage'),
  '/dispatch': () => import('../pages/DispatchPage'),
};

const prefetched = new Set();

export function prefetchRoute(routePath) {
  if (!routePath || prefetched.has(routePath)) return;
  const loader = PREFETCH_LOADERS[routePath];
  if (loader) {
    prefetched.add(routePath);
    try {
      loader();
    } catch {
      prefetched.delete(routePath);
    }
  }
}

/**
 * Idle-prefetches top frequent routes 2 seconds after the app shell mounts.
 */
export function prefetchCoreRoutes() {
  const core = ['/job-cards', '/admin', '/accounting/sales', '/tasks'];
  const run = () => {
    core.forEach((p) => prefetchRoute(p));
  };
  if (typeof window !== 'undefined') {
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(run, { timeout: 3000 });
    } else {
      setTimeout(run, 2000);
    }
  }
}

