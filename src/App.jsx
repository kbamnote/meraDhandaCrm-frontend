import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import AppLayout from './components/layout/AppLayout';
import { ProtectedRoute } from './components/common/Guards';
import PageStub from './components/common/PageStub';
import ResourcePage from './components/common/ResourcePage';
import { RESOURCES } from './config/resources';

import LoginPage from './pages/LoginPage';
import AdminPage from './pages/AdminPage';
import TasksPage from './pages/TasksPage';

// Routes that reuse another route's resource config.
const RESOURCE_ALIASES = { 'manage-depts': 'departments' };

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
  ['client-ledger',   '📒 Client Ledger',     'page-client-ledger',   'mpw/clients'],

  ['hr-dashboard',    '👥 HR Dashboard',      'page-hr-dashboard',    'mpw/users'],
  ['hr-staff',        '🧑‍💼 Staff',            'page-hr-staff',        'mpw/users'],
  ['hr-leaves',       '🏖  Leaves',           'page-hr-leaves',       'mpw/leaves'],
  ['hr-payroll',      '💵 Payroll',           'page-hr-payroll',      'mpw/payroll'],
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
];

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/admin" replace />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/tasks" element={<TasksPage />} />

            {STUB_ROUTES.map(([path, title, legacyId, dbPath]) => {
              const cfg = RESOURCES[path] || RESOURCES[RESOURCE_ALIASES[path]];
              return (
                <Route
                  key={path}
                  path={`/${path}`}
                  element={cfg
                    ? <ResourcePage config={cfg} />
                    : <PageStub title={title} legacyId={legacyId} dbPath={dbPath} />}
                />
              );
            })}
          </Route>

          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
