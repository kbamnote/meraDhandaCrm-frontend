import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LanguageProvider } from './i18n/LanguageContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import AppLayout from './components/layout/AppLayout';
import { ProtectedRoute, RequireOnboarded } from './components/common/Guards';
import PageStub from './components/common/PageStub';
import ResourcePage from './components/common/ResourcePage';
import { RESOURCES } from './config/resources';
import { isSectionHidden } from './config/access';
import RoleDashboard from './pages/RoleDashboard';
import CompanyDetailPage from './pages/CompanyDetailPage';
import PlatformBroadcastPage from './pages/PlatformBroadcastPage';

import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import OnboardingPage from './pages/OnboardingPage';
import AdminPage from './pages/AdminPage';
import TasksPage from './pages/TasksPage';
import ChatPage from './pages/ChatPage';
import JobCardsPage from './pages/JobCardsPage';
import BillingPage from './pages/BillingPage';
import PlatformConsolePage from './pages/PlatformConsolePage';

import MySalaryPage from './pages/MySalaryPage';
import MyLeavesPage from './pages/MyLeavesPage';
import MyAttendancePage from './pages/MyAttendancePage';
import ProfilePage from './pages/ProfilePage';
import AnalyticsPage from './pages/AnalyticsPage';
import HrDashboardPage from './pages/HrDashboardPage';
import HrLeavesPage from './pages/HrLeavesPage';
import HrPayrollPage from './pages/HrPayrollPage';
import HrAttendancePage from './pages/HrAttendancePage';
import ProductivityPage from './pages/ProductivityPage';
import CustDashboardPage from './pages/CustDashboardPage';
import PermissionsPage from './pages/PermissionsPage';
import HierarchyPage from './pages/HierarchyPage';
import InvoiceViewPage from './pages/InvoiceViewPage';
import JobDetailPage from './pages/JobDetailPage';
import ReviewPage from './pages/ReviewPage';
import CompanySettingsPage from './pages/CompanySettingsPage';
import SuperAdminPage from './pages/SuperAdminPage';
import DesignersViewPage from './pages/DesignersViewPage';
import DesignerPanelPage from './pages/DesignerPanelPage';
import DesignersPage from './pages/DesignersPage';
import ProductionPage from './pages/ProductionPage';
import QCPage from './pages/QCPage';
import DispatchPage from './pages/DispatchPage';
import AccountingPage from './pages/AccountingPage';
import StockPage from './pages/StockPage';
import BroadcastPage from './pages/BroadcastPage';
import AssignProdPage from './pages/AssignProdPage';
import ProdStepsPage from './pages/ProdStepsPage';
import SalesAdminPage from './pages/SalesAdminPage';
import SalesPage from './pages/SalesPage';
import AuditLogPage from './pages/AuditLogPage';
import ApiKeysPage from './pages/ApiKeysPage';
import WebhooksPage from './pages/WebhooksPage';
import CustomDomainPage from './pages/CustomDomainPage';
import ReferralsPage from './pages/ReferralsPage';

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
  'job-detail': JobDetailPage,
  'review': ReviewPage,
  'company-settings': CompanySettingsPage,
  'superadmin': SuperAdminPage,
  'designers-view': DesignersViewPage,
  'designer': DesignerPanelPage,
  'designers': DesignersPage,
  'production': ProductionPage,
  'qc': QCPage,
  'dispatch': DispatchPage,
  'accounting': AccountingPage,
  'stock': StockPage,
  'broadcast': BroadcastPage,
  'assign-prod': AssignProdPage,
  'prod-steps': ProdStepsPage,
  'sales-admin': SalesAdminPage,
  'sales-panel': SalesPage,
  'audit-log': AuditLogPage,
  'api-keys': ApiKeysPage,
  'webhooks': WebhooksPage,
  'custom-domain': CustomDomainPage,
  'referrals': ReferralsPage,
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
  ['assign-prod',     '📥 Assign Production', 'page-assign-prod',     'mpw/production'],
  ['production',      '🏭 Production',         'page-production',      'mpw/production'],
  ['prod-steps',      '📋 Production Steps',  'page-prod-steps',      'mpw/production'],
  ['qc',              '🔍 QC',                'page-qc',              'mpw/qc'],
  ['dispatch',        '🚚 Dispatch',          'page-dispatch',        'mpw/dispatch'],
  ['machines',        '⚙️  Machines',          'page-machines',        'mpw/machines'],
  ['machine-history', '🕐 Machine History',   'page-machine-history', 'mpw/machineHistory'],

  ['leads-crm',       '📞 Leads CRM',         'page-leads-crm',       'mpw/leads'],
  ['sales-panel',     '💼 Sales Panel',       'page-sales-panel',     'mpw/sales'],
  ['sales-admin',     '👔 Sales Admin',       'page-sales-admin',     'mpw/sales'],
  ['enquiry',         '❓ Enquiry',           'page-enquiry',         'mpw/enquiries'],
  ['sample-dm',       '📦 Sample DM',         'page-sample-dm',       'mpw/samples'],
  ['bulk-orders',     '📑 Bulk Orders',       'page-bulk-orders',     'mpw/bulkOrders'],
  ['products',        '🛍  Products',         'page-products',        'mpw/products'],
  ['stock',           '📦 Stock',             'page-stock',           'mpw/stock'],
  ['vendors',         '🏪 Vendors',           'page-vendors',         'mpw/vendors'],

  ['accounting',      '💰 Accounting',        'page-accounting',      'mpw/invoices'],
  ['invoice-view',    '🧾 Invoice',           'page-invoice-view',    'mpw/invoices'],
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
  ['review',          '⭐ Review',            'page-review',          null],
  ['job-detail',      '📄 Job Detail',        'page-job-detail',      'mpw/jobs'],
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

export default function App() {
  return (
    <LanguageProvider>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
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
      </BrowserRouter>
    </AuthProvider>
    </LanguageProvider>
  );
}
