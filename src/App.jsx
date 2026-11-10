import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { LanguageProvider } from './i18n/LanguageContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import AppLayout from './components/layout/AppLayout';
import { ProtectedRoute, RequireOnboarded } from './components/common/Guards';
import PageStub from './components/common/PageStub';
import ResourcePage from './components/common/ResourcePage';
import { RESOURCES } from './config/resources';
import { isSectionHidden } from './config/access';

// ── Eagerly-loaded pages ───────────────────────────────────────────────────
// These are either part of the initial render path (Login, Signup, the
// top-level shell components) or small enough that splitting them adds
// more round-trips than it saves.
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import OnboardingPage from './pages/OnboardingPage';
import PublicPayPage from './pages/PublicPayPage';

// ── Lazily-loaded pages ────────────────────────────────────────────────────
// Everything behind authentication is code-split.  The browser downloads
// only the chunk(s) for the page the user actually navigates to, so the
// initial JS payload is a fraction of the full app.
//
// Vite groups these by the manualChunks in vite.config.js; pages in the same
// functional area end up in the same chunk and are prefetched on idle.
const RoleDashboard          = lazy(() => import('./pages/RoleDashboard'));
const AdminPage              = lazy(() => import('./pages/AdminPage'));
const CompanyDetailPage      = lazy(() => import('./pages/CompanyDetailPage'));
const PlatformBroadcastPage  = lazy(() => import('./pages/PlatformBroadcastPage'));
const TasksPage              = lazy(() => import('./pages/TasksPage'));
const ChatPage               = lazy(() => import('./pages/ChatPage'));
const JobCardsPage           = lazy(() => import('./pages/JobCardsPage'));
const BillingPage            = lazy(() => import('./pages/BillingPage'));
const PlatformConsolePage    = lazy(() => import('./pages/PlatformConsolePage'));

const MySalaryPage           = lazy(() => import('./pages/MySalaryPage'));
const MyLeavesPage           = lazy(() => import('./pages/MyLeavesPage'));
const MyAttendancePage       = lazy(() => import('./pages/MyAttendancePage'));
const ProfilePage            = lazy(() => import('./pages/ProfilePage'));
const AnalyticsPage          = lazy(() => import('./pages/AnalyticsPage'));
const HrDashboardPage        = lazy(() => import('./pages/HrDashboardPage'));
const HrLeavesPage           = lazy(() => import('./pages/HrLeavesPage'));
const HrPayrollPage          = lazy(() => import('./pages/HrPayrollPage'));
const HrAttendancePage       = lazy(() => import('./pages/HrAttendancePage'));
const ProductivityPage       = lazy(() => import('./pages/ProductivityPage'));
const CustDashboardPage      = lazy(() => import('./pages/CustDashboardPage'));
const PermissionsPage        = lazy(() => import('./pages/PermissionsPage'));
const HierarchyPage          = lazy(() => import('./pages/HierarchyPage'));
const InvoiceViewPage        = lazy(() => import('./pages/InvoiceViewPage'));
const PurchaseViewPage       = lazy(() => import('./pages/PurchaseViewPage'));
const JobDetailPage          = lazy(() => import('./pages/JobDetailPage'));
const JobViewPage            = lazy(() => import('./pages/JobViewPage'));
const ReviewPage             = lazy(() => import('./pages/ReviewPage'));
const CompanySettingsPage    = lazy(() => import('./pages/CompanySettingsPage'));
const SuperAdminPage         = lazy(() => import('./pages/SuperAdminPage'));
const DesignersViewPage      = lazy(() => import('./pages/DesignersViewPage'));
const DesignerPanelPage      = lazy(() => import('./pages/DesignerPanelPage'));
const DesignersPage          = lazy(() => import('./pages/DesignersPage'));
const ProductionPage         = lazy(() => import('./pages/ProductionPage'));
const QCPage                 = lazy(() => import('./pages/QCPage'));
const DispatchPage           = lazy(() => import('./pages/DispatchPage'));
const StockPage              = lazy(() => import('./pages/StockPage'));
const BroadcastPage          = lazy(() => import('./pages/BroadcastPage'));
const AssignProdPage         = lazy(() => import('./pages/AssignProdPage'));
const JobSetterPage          = lazy(() => import('./pages/JobSetterPage'));
const ProdStepsPage          = lazy(() => import('./pages/ProdStepsPage'));
const ManageProductionTypesPage = lazy(() => import('./pages/ManageProductionTypesPage'));
const SalesAdminPage         = lazy(() => import('./pages/SalesAdminPage'));
const SalesPage              = lazy(() => import('./pages/SalesPage'));
const AuditLogPage           = lazy(() => import('./pages/AuditLogPage'));
const ApiKeysPage            = lazy(() => import('./pages/ApiKeysPage'));
const WebhooksPage           = lazy(() => import('./pages/WebhooksPage'));
const CustomDomainPage       = lazy(() => import('./pages/CustomDomainPage'));
const ReferralsPage          = lazy(() => import('./pages/ReferralsPage'));
const CustomerOutboxPage     = lazy(() => import('./pages/CustomerOutboxPage'));
const SendNotificationPage   = lazy(() => import('./pages/SendNotificationPage'));
const ProductsPage           = lazy(() => import('./pages/ProductsPage'));
const TeamMapPage            = lazy(() => import('./pages/TeamMapPage'));
const ShopVisitsPage         = lazy(() => import('./pages/ShopVisitsPage'));
const RouteHistoryPage       = lazy(() => import('./pages/RouteHistoryPage'));

// Accounting — grouped so they share one HTTP request on first access.
const AccountingDashboardPage = lazy(() => import('./pages/accounting/AccountingDashboardPage'));
const SalesInvoicesPage      = lazy(() => import('./pages/accounting/SalesInvoicesPage'));
const PartiesPage            = lazy(() => import('./pages/accounting/PartiesPage'));
const ReportsPage            = lazy(() => import('./pages/accounting/ReportsPage'));
const GstPage                = lazy(() => import('./pages/accounting/GstPage'));
const PurchasesPage          = lazy(() => import('./pages/accounting/PurchasesPage'));
const AccountingItemsPage    = lazy(() => import('./pages/accounting/ItemsPage'));
const EntriesPage            = lazy(() => import('./pages/accounting/EntriesPage'));
const DayBookPage            = lazy(() => import('./pages/accounting/DayBookPage'));
const ProfitPage             = lazy(() => import('./pages/accounting/ProfitPage'));
const YearEndPage            = lazy(() => import('./pages/accounting/YearEndPage'));
const JobProfitPage          = lazy(() => import('./pages/accounting/JobProfitPage'));
const CashBankPage           = lazy(() => import('./pages/accounting/CashBankPage'));
const ReconPage              = lazy(() => import('./pages/accounting/ReconPage'));
const TdsPage                = lazy(() => import('./pages/accounting/TdsPage'));
const InventoryPage          = lazy(() => import('./pages/accounting/InventoryPage'));
const ExpensesPage           = lazy(() => import('./pages/accounting/ExpensesPage'));
const PurchaseOrdersPage     = lazy(() => import('./pages/accounting/PurchaseOrdersPage'));
const ClientLedgerPage       = lazy(() => import('./pages/accounting/ClientLedgerPage'));
const CreditNotesPage        = lazy(() => import('./pages/accounting/CreditNotesPage'));
const DebitNotesPage         = lazy(() => import('./pages/accounting/DebitNotesPage'));
const DeliveryChallansPage   = lazy(() => import('./pages/accounting/DeliveryChallansPage'));
const RecurringInvoicesPage  = lazy(() => import('./pages/accounting/RecurringInvoicesPage'));
const BranchesPage           = lazy(() => import('./pages/accounting/BranchesPage'));
const SearchPage             = lazy(() => import('./pages/accounting/SearchPage'));
const QuotationsPage         = lazy(() => import('./pages/accounting/QuotationsPage'));
const RecordPaymentPage      = lazy(() => import('./pages/accounting/RecordPaymentPage'));
const PaymentViewPage        = lazy(() => import('./pages/accounting/PaymentViewPage'));
// Named exports from a shared module — wrap them in a default-exporting thunk.
const PaymentInPage  = lazy(() => import('./pages/accounting/PaymentsPage').then(m => ({ default: m.PaymentInPage })));
const PaymentOutPage = lazy(() => import('./pages/accounting/PaymentsPage').then(m => ({ default: m.PaymentOutPage })));

// Reports / GST
const ReportsHubPage         = lazy(() => import('./pages/reports/ReportsHubPage'));
const Gstr3bPage             = lazy(() => import('./pages/reports/Gstr3bPage'));
const HsnSalesSummaryPage    = lazy(() => import('./pages/reports/HsnSalesSummaryPage'));
const Gstr1Page  = lazy(() => import('./pages/reports/GstRegisterPage').then(m => ({ default: m.Gstr1Page })));
const Gstr2Page  = lazy(() => import('./pages/reports/GstRegisterPage').then(m => ({ default: m.Gstr2Page })));
const GstSalesHsnPage    = lazy(() => import('./pages/reports/GstHsnPage').then(m => ({ default: m.GstSalesHsnPage })));
const GstPurchaseHsnPage = lazy(() => import('./pages/reports/GstHsnPage').then(m => ({ default: m.GstPurchaseHsnPage })));

// ── Page-load fallback ─────────────────────────────────────────────────────
// Shown while a lazy chunk is downloading. Matches the app's spinner class so
// the transition is seamless. Intentionally stateless — it must render without
// any context provider data.
function PageLoader() {
  return (
    <div className="center-screen">
      <div>
        <div className="spinner" />
      </div>
    </div>
  );
}

// Explicit page components for routes that have a finished React component.
// Preferred over the ResourcePage/PageStub fallback in the route table below.
const CUSTOM_PAGES = {
  'my-salary': MySalaryPage,
  'my-leaves': MyLeavesPage,
  'my-attendance': MyAttendancePage,
  'profile': ProfilePage,
  'analytics': AnalyticsPage,
  'hr-dashboard': HrDashboardPage,
  'hr-leaves': HrLeavesPage,
  'hr-payroll': HrPayrollPage,
  'hr-attendance': HrAttendancePage,
  'productivity': ProductivityPage,
  'cust-dashboard': CustDashboardPage,
  'permissions': PermissionsPage,
  'hierarchy': HierarchyPage,
  'invoice-view': InvoiceViewPage,
  'purchase-view': PurchaseViewPage,
  'job-detail': JobDetailPage,
  'job-view': JobViewPage,
  'review': ReviewPage,
  'company-settings': CompanySettingsPage,
  'superadmin': SuperAdminPage,
  'designers-view': DesignersViewPage,
  'designer': DesignerPanelPage,
  'designers': DesignersPage,
  'production': ProductionPage,
  'qc': QCPage,
  'dispatch': DispatchPage,
  'accounting': AccountingDashboardPage,
  'accounting/sales': SalesInvoicesPage,
  'accounting/parties': PartiesPage,
  'accounting/reports': ReportsPage,
  'accounting/gst': GstPage,
  'accounting/purchases': PurchasesPage,
  'accounting/items': AccountingItemsPage,
  'tracking': TeamMapPage,
  'visits': ShopVisitsPage,
  'tracking/route': RouteHistoryPage,
  'accounting/entries': EntriesPage,
  'accounting/daybook': DayBookPage,
  'accounting/profit': ProfitPage,
  'accounting/year-end': YearEndPage,
  'accounting/job-profit': JobProfitPage,
  'accounting/cash': CashBankPage,
  'accounting/recon': ReconPage,
  'accounting/tds': TdsPage,
  'accounting/inventory': InventoryPage,
  'expenses': ExpensesPage,
  'purchase-orders': PurchaseOrdersPage,
  'client-ledger': ClientLedgerPage,
  'accounting/credit-notes': CreditNotesPage,
  'accounting/debit-notes': DebitNotesPage,
  'accounting/challans': DeliveryChallansPage,
  'accounting/recurring': RecurringInvoicesPage,
  'accounting/branches': BranchesPage,
  'accounting/search': SearchPage,
  'stock': StockPage,
  'broadcast': BroadcastPage,
  'assign-prod': AssignProdPage,
  'jobsetter': JobSetterPage,
  'prod-steps': ProdStepsPage,
  'production-types': ManageProductionTypesPage,
  quotations: QuotationsPage,
  'payments/in': PaymentInPage,
  'payment-view': PaymentViewPage,
  'payments/out': PaymentOutPage,
  // The Reports hub and the registers that hang off it.
  'reports': ReportsHubPage,
  'reports/gstr1': Gstr1Page,
  'reports/gstr2': Gstr2Page,
  'reports/gstr3b': Gstr3bPage,
  'reports/hsn-sales-summary': HsnSalesSummaryPage,
  'reports/gst-sales-hsn': GstSalesHsnPage,
  'reports/gst-purchase-hsn': GstPurchaseHsnPage,
  'sales-admin': SalesAdminPage,
  'sales-panel': SalesPage,
  'audit-log': AuditLogPage,
  'api-keys': ApiKeysPage,
  'webhooks': WebhooksPage,
  'custom-domain': CustomDomainPage,
  'referrals': ReferralsPage,
  'customer-outbox': CustomerOutboxPage,
  'send-notification': SendNotificationPage,
  'products': ProductsPage,
};

// Routes that reuse another route's resource config.
const RESOURCE_ALIASES = { 'manage-depts': 'dept-mgmt' };

import './components/common/toast';
import './styles/global.css';

/**
 * Route table — each entry corresponds to one legacy `<div id="page-*">`.
 * Pages with a finished React component use that component; everything else
 * uses <PageStub /> which renders the page title, the original ID for
 * grep-ability, and a live preview of the relevant Firebase path.
 */
const STUB_ROUTES = [
  ['analytics',       '📊 Analytics',         'page-analytics',       null],
  ['designers',       '🎨 Designers',         'page-designers',       'mpw/designers'],
  ['designer',        '🖌  My Designer Panel', 'page-designer',        'mpw/designers'],
  ['designers-view',  '👀 Designers View',     'page-designers-view',  'mpw/designers'],
  ['jobsetter',       '🛠  Job Setter',        'page-jobsetter',       'mpw/jobs'],
  ['completed',       '✅ Completed',          'page-completed',       'mpw/jobs'],
  ['hold',            '⏸ Hold Jobs',          'page-hold',            'mpw/jobs'],
  ['assign-prod',     '📥 Assign Production', 'page-assign-prod',     'mpw/production'],
  ['production',      '🏭 Production',         'page-production',      'mpw/production'],
  ['prod-steps',      '📋 Production Steps',  'page-prod-steps',      'mpw/production'],
  ['production-types','🏭 Production Types',  'page-production-types','mpw/productionTypes'],
  ['qc',              '🔍 QC',                'page-qc',              'mpw/qc'],
  ['dispatch',        '🚚 Dispatch',          'page-dispatch',        'mpw/dispatch'],
  ['machines',        '⚙️  Machines',          'page-machines',        'mpw/machines'],
  ['machine-history', '🕐 Machine History',   'page-machine-history', 'mpw/machineHistory'],

  // Field tracking. Both are real pages (CUSTOM_PAGES above); they are listed
  // here so SectionGuard gates them by the 'tracking' module like every other
  // route, rather than being reachable by typing the URL.
  ['tracking',        '📍 Team Map',          'page-tracking',        null],
  ['visits',          '🏪 Shop Visits',       'page-visits',          null],
  ['tracking/route',  '🛣 Route History',     'page-tracking-route',  null],

  ['leads-crm',       '📞 Leads CRM',         'page-leads-crm',       'mpw/leads'],
  ['sales-panel',     '💼 Sales Panel',       'page-sales-panel',     'mpw/sales'],
  ['quotations',      '📄 Quotation / Estimate', 'page-quotations',   'mpw/invoices'],
  ['sales-admin',     '👔 Sales Admin',       'page-sales-admin',     'mpw/sales'],
  ['enquiry',         '❓ Enquiry',           'page-enquiry',         'mpw/enquiries'],
  ['sample-dm',       '📦 Sample DM',         'page-sample-dm',       'mpw/samples'],
  ['bulk-orders',     '📑 Bulk Orders',       'page-bulk-orders',     'mpw/bulkOrders'],
  ['products',        '🛍  Products',         'page-products',        'mpw/products'],
  ['stock',           '📦 Stock',             'page-stock',           'mpw/stock'],
  ['vendors',         '🏪 Vendors',           'page-vendors',         'mpw/vendors'],

  ['accounting',      '💰 Accounting',        'page-accounting',      'mpw/invoices'],
  ['accounting/sales', '🧾 Sales Invoices',   'page-accounting-sales', 'mpw/invoices'],
  ['accounting/items', '📦 Items',            'page-accounting-items', 'mpw/products'],
  ['accounting/parties', '🤝 Parties',        'page-accounting-parties', 'mpw/clients'],
  ['accounting/reports', '📊 Reports',        'page-accounting-reports', null],
  ['accounting/gst',  '🧮 GST',               'page-accounting-gst',  null],
  ['payments/in',     '💲 Payment In',        'page-payment-in',      null],
  ['payment-view',    '💲 Payment',           'page-payment-view',    null],
  ['payments/out',    '💲 Payment Out',       'page-payment-out',     null],
  ['reports',         '📑 Reports',           'page-reports',         null],
  ['reports/gstr1',   '🧾 GSTR-1 (Sales)',    'page-reports-gstr1',   null],
  ['reports/gstr2',   '🧾 GSTR-2 (Purchase)', 'page-reports-gstr2',   null],
  ['reports/hsn-sales-summary', '🧾 HSN Wise Sales Summary', 'page-reports-hsn-sales-summary', null],
  ['reports/gstr3b',  '🧾 GSTR-3B',           'page-reports-gstr3b',  null],
  ['reports/gst-sales-hsn',    '🧾 GST Sales (With HSN)',    'page-reports-gst-sales-hsn',    null],
  ['reports/gst-purchase-hsn', '🧾 GST Purchase (With HSN)', 'page-reports-gst-purchase-hsn', null],
  // Phase 2 — real pages backed by CUSTOM_PAGES components.
  ['accounting/inventory', '📦 Inventory',    'page-accounting-inventory', null],
  ['accounting/purchases', '📦 Purchases',   'page-accounting-purchases', null],
  ['accounting/daybook',   '📓 Day Book',     'page-accounting-daybook',   null],
  ['accounting/profit',    '📈 Profitability', 'page-accounting-profit',   null],
  ['accounting/year-end',  '🗓️ Year-End Close', 'page-accounting-year-end', null],
  ['accounting/job-profit','🏭 Job Profitability','page-accounting-job-profit', null],
  ['accounting/entries',   '📝 Journal',      'page-accounting-entries',   null],
  ['accounting/cash',      '💵 Cash & Bank',  'page-accounting-cash',      null],
  ['accounting/recon',     '🏦 Bank Recon',   'page-accounting-recon',     null],
  ['accounting/tds',       '🧾 TDS',          'page-accounting-tds',       null],
  ['accounting/credit-notes', '📝 Credit Notes', 'page-accounting-credit-notes', null],
  ['accounting/debit-notes',  '📝 Debit Notes',  'page-accounting-debit-notes',  null],
  ['accounting/challans',     '🚚 Delivery Challans', 'page-accounting-challans', null],
  ['accounting/recurring',    '🔁 Recurring Invoices', 'page-accounting-recurring', null],
  ['accounting/branches',     '🏬 Branches',           'page-accounting-branches',  null],
  ['accounting/search',       '🔍 Search',             'page-accounting-search',    null],
  ['invoice-view',    '🧾 Invoice',           'page-invoice-view',    'mpw/invoices'],
  ['purchase-view',   '📦 Purchase',          'page-purchase-view',   'mpw/purchaseOrders'],
  ['expenses',        '🧾 Expenses',          'page-expenses',        'mpw/expenses'],
  ['purchase-orders', '📦 Purchase Orders',   'page-purchase-orders', 'mpw/purchaseOrders'],
  ['client-ledger',   '📒 Client Ledger',     'page-client-ledger',   'mpw/clients'],

  ['hr-dashboard',    '👥 HR Dashboard',      'page-hr-dashboard',    'mpw/users'],
  ['hr-staff',        '🧑‍💼 Staff',            'page-hr-staff',        'mpw/users'],
  ['hr-leaves',       '🏖  Leaves',           'page-hr-leaves',       'mpw/leaves'],
  ['hr-payroll',      '💵 Payroll',           'page-hr-payroll',      'mpw/payroll'],
  ['hr-attendance',   '🕒 Team Attendance',   'page-hr-attendance',   null],
  ['attendance',      '🕒 Attendance',        'page-attendance',      'mpw/attendance'],
  ['productivity',    '⚡ Productivity',      'page-productivity',    'mpw/attendance'],
  ['my-leaves',       '🌴 My Leaves',         'page-my-leaves',       'mpw/leaves'],
  ['my-attendance',   '⏱  My Attendance',     'page-my-attendance',   'mpw/attendance'],
  ['my-salary',       '💸 My Salary',         'page-my-salary',       'mpw/payroll'],
  ['dept-mgmt',       '🏢 Departments',       'page-dept-mgmt',       'mpw/departments'],
  ['manage-depts',    '🗂  Manage Depts',     'page-manage-depts',    'mpw/departments'],

  ['cust-dashboard',  '🙂 Customer',          'page-cust-dashboard',  'mpw/clients'],
  ['customer-outbox', '📲 WhatsApp Outbox',   'page-customer-outbox', 'mpw/tenantNotifications'],
  ['review',          '⭐ Review',            'page-review',          null],
  ['job-detail',      '📄 Job Detail',        'page-job-detail',      'mpw/jobs'],
  ['job-view',        '📄 Job View',          'page-job-view',        'mpw/jobs'],
  ['profile',         '👤 My Profile',        'page-profile',         null],

  ['permissions',     '🔐 Permissions',       'page-permissions',     'mpw/users'],
  ['hierarchy',       '🌳 Hierarchy',         'page-hierarchy',       'mpw/users'],
  ['broadcast',       '📣 Broadcast',         'page-broadcast',       'mpw/tenantNotifications'],
  ['superadmin',      '👑 Super Admin',       'page-superadmin',      null],
  ['company-settings','⚙️  Company Settings', 'page-company-settings','mpw/companySettings'],

  ['audit-log',       '📜 Audit Log',         'page-audit-log',       null],
  ['api-keys',        '🔑 API Keys',          'page-api-keys',        null],
  ['webhooks',        '🪝 Webhooks',          'page-webhooks',        null],
  ['custom-domain',   '🌐 Custom Domain',     'page-custom-domain',   null],
  ['referrals',       '🎁 Referrals',         'page-referrals',       null],
  ['send-notification','🔔 Send Notification','page-send-notification', null],
];

function AccessDenied() {
  return (
    <div className="card" style={{ maxWidth: 480, margin: '40px auto', textAlign: 'center' }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>🔒</div>
      <h3 style={{ marginBottom: 6 }}>No access</h3>
      <div style={{ color: 'var(--text2)', fontSize: 14 }}>
        You don’t have permission to view this section. Ask an admin if you need access.
      </div>
    </div>
  );
}

// Blocks a route when the section is hidden for this teammate (deep-link safe),
// independent of which collection the page reads. Admins/owners bypass.
function SectionGuard({ path, children }) {
  const { profile } = useAuth();
  return isSectionHidden(path, profile) ? <AccessDenied /> : children;
}

/**
 * Record Payment carries its side in the URL, so it cannot come from the
 * literal route table above. Guarded against its OWN list's permission —
 * being allowed to see receipts is not being allowed to see what you pay
 * suppliers.
 */
function RecordPaymentRoute() {
  const { direction } = useParams();
  const side = direction === 'out' ? 'out' : 'in';
  return (
    <SectionGuard path={`/payments/${side}`}>
      <RecordPaymentPage />
    </SectionGuard>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route path="/pay/:token" element={<PublicPayPage />} />
              <Route path="/onboarding" element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>} />

              <Route element={<ProtectedRoute><RequireOnboarded><AppLayout /></RequireOnboarded></ProtectedRoute>}>
                <Route index element={<Navigate to="/admin" replace />} />
                <Route path="/admin" element={<RoleDashboard />} />
                <Route path="/tasks" element={<SectionGuard path="/tasks"><TasksPage /></SectionGuard>} />
                <Route path="/job-cards" element={<SectionGuard path="/job-cards"><JobCardsPage /></SectionGuard>} />
                <Route path="/chat" element={<ChatPage />} />
                <Route path="/billing" element={<BillingPage />} />
                <Route path="/platform" element={<PlatformConsolePage />} />
                <Route path="/company/:id" element={<CompanyDetailPage />} />
                <Route path="/platform-broadcast" element={<PlatformBroadcastPage />} />
                <Route path="/payments/:direction/new" element={<RecordPaymentRoute />} />

                {STUB_ROUTES.map(([path, title, legacyId, dbPath]) => {
                  const Comp = CUSTOM_PAGES[path];
                  const cfg = RESOURCES[path] || RESOURCES[RESOURCE_ALIASES[path]];
                  return (
                    <Route
                      key={path}
                      path={`/${path}`}
                      element={(
                        <SectionGuard path={`/${path}`}>
                          {Comp
                            ? <Comp />
                            : cfg
                              ? <ResourcePage config={cfg} />
                              : <PageStub title={title} legacyId={legacyId} dbPath={dbPath} />}
                        </SectionGuard>
                      )}
                    />
                  );
                })}
              </Route>

              <Route path="*" element={<Navigate to="/admin" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </LanguageProvider>
  );
}
