import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

/**
 * Sidebar — every entry corresponds to one legacy `<div class="page" id="page-*">`.
 * The route paths use the same suffix as the original IDs so a developer
 * porting code from the HTML can grep by ID and find the React route.
 */
const SECTIONS = [
  {
    title: 'Workspace',
    items: [
      { to: '/admin',         label: '🏠 Admin Dashboard',    legacy: 'page-admin' },
      { to: '/tasks',         label: '✅ Tasks',              legacy: 'page-tasks' },
      { to: '/analytics',     label: '📊 Analytics',          legacy: 'page-analytics' },
    ],
  },
  {
    title: 'Designers & Production',
    items: [
      { to: '/designers',         label: '🎨 Designers',         legacy: 'page-designers' },
      { to: '/designer',          label: '🖌  My Designer Panel', legacy: 'page-designer' },
      { to: '/designers-view',    label: '👀 Designers View',    legacy: 'page-designers-view' },
      { to: '/jobsetter',         label: '🛠  Job Setter',        legacy: 'page-jobsetter' },
      { to: '/assign-prod',       label: '📥 Assign Production', legacy: 'page-assign-prod' },
      { to: '/production',        label: '🏭 Production',        legacy: 'page-production' },
      { to: '/prod-steps',        label: '📋 Prod Steps',        legacy: 'page-prod-steps' },
      { to: '/qc',                label: '🔍 QC',                legacy: 'page-qc' },
      { to: '/dispatch',          label: '🚚 Dispatch',          legacy: 'page-dispatch' },
      { to: '/machines',          label: '⚙️  Machines',          legacy: 'page-machines' },
      { to: '/machine-history',   label: '🕐 Machine History',   legacy: 'page-machine-history' },
    ],
  },
  {
    title: 'Sales & Leads',
    items: [
      { to: '/leads-crm',     label: '📞 Leads CRM',         legacy: 'page-leads-crm' },
      { to: '/sales-panel',   label: '💼 Sales Panel',       legacy: 'page-sales-panel' },
      { to: '/sales-admin',   label: '👔 Sales Admin',       legacy: 'page-sales-admin' },
      { to: '/enquiry',       label: '❓ Enquiry',           legacy: 'page-enquiry' },
      { to: '/sample-dm',     label: '📦 Sample DM',         legacy: 'page-sample-dm' },
      { to: '/bulk-orders',   label: '📑 Bulk Orders',       legacy: 'page-bulk-orders' },
      { to: '/products',      label: '🛍  Products',         legacy: 'page-products' },
      { to: '/stock',         label: '📦 Stock',             legacy: 'page-stock' },
      { to: '/vendors',       label: '🏪 Vendors',           legacy: 'page-vendors' },
    ],
  },
  {
    title: 'Accounting',
    items: [
      { to: '/accounting',     label: '💰 Accounting',        legacy: 'page-accounting' },
      { to: '/invoice-view',   label: '🧾 Invoice',           legacy: 'page-invoice-view' },
      { to: '/client-ledger',  label: '📒 Client Ledger',     legacy: 'page-client-ledger' },
    ],
  },
  {
    title: 'HR',
    items: [
      { to: '/hr-dashboard',  label: '👥 HR Dashboard',      legacy: 'page-hr-dashboard' },
      { to: '/hr-staff',      label: '🧑‍💼 Staff',             legacy: 'page-hr-staff' },
      { to: '/hr-leaves',     label: '🏖  Leaves',           legacy: 'page-hr-leaves' },
      { to: '/hr-payroll',    label: '💵 Payroll',           legacy: 'page-hr-payroll' },
      { to: '/attendance',    label: '🕒 Attendance',        legacy: 'page-attendance' },
      { to: '/productivity',  label: '⚡ Productivity',      legacy: 'page-productivity' },
      { to: '/my-leaves',     label: '🌴 My Leaves',         legacy: 'page-my-leaves' },
      { to: '/my-attendance', label: '⏱  My Attendance',     legacy: 'page-my-attendance' },
      { to: '/my-salary',     label: '💸 My Salary',         legacy: 'page-my-salary' },
      { to: '/dept-mgmt',     label: '🏢 Depts',             legacy: 'page-dept-mgmt' },
      { to: '/manage-depts',  label: '🗂  Manage Depts',     legacy: 'page-manage-depts' },
    ],
  },
  {
    title: 'Customer',
    items: [
      { to: '/cust-dashboard', label: '🙂 Customer',          legacy: 'page-cust-dashboard' },
      { to: '/review',         label: '⭐ Review',            legacy: 'page-review' },
      { to: '/job-detail',     label: '📄 Job Detail',        legacy: 'page-job-detail' },
    ],
  },
  {
    title: 'Admin / Settings',
    items: [
      { to: '/permissions',      label: '🔐 Permissions',     legacy: 'page-permissions', roles: ['admin','superadmin','owner'] },
      { to: '/hierarchy',        label: '🌳 Hierarchy',       legacy: 'page-hierarchy',   roles: ['admin','superadmin','owner'] },
      { to: '/broadcast',        label: '📣 Broadcast',       legacy: 'page-broadcast',   roles: ['admin','superadmin','owner'] },
      { to: '/superadmin',       label: '👑 Super Admin',     legacy: 'page-superadmin',  roles: ['superadmin'] },
      { to: '/company-settings', label: '⚙️  Company',         legacy: 'page-company-settings', roles: ['admin','superadmin','owner'] },
      { to: '/profile',          label: '👤 My Profile',      legacy: 'page-profile' },
    ],
  },
];

export default function Sidebar({ open, onClose }) {
  const { profile, signOut } = useAuth();
  const role = profile?.role;
  const custom = profile?.customRole;

  const canSee = (item) => {
    if (!item.roles) return true;
    return item.roles.includes(role) || item.roles.includes(custom);
  };

  return (
    <>
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-logo">🖨 MrPrint World</div>
        <nav>
          {SECTIONS.map(sec => (
            <div key={sec.title}>
              <div className="sidebar-section-title">{sec.title}</div>
              {sec.items.filter(canSee).map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={onClose}
                  data-legacy={item.legacy}
                  className={({ isActive }) => isActive ? 'active' : ''}
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div style={{ marginTop: 'auto', padding: 16, borderTop: '1px solid rgba(255,255,255,.06)' }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.55)', marginBottom: 8 }}>
            {profile?.name || profile?.phone || 'Loading…'} <br/>
            <span style={{ fontSize: 10, opacity: .7 }}>{role || 'no role'} {custom ? `• ${custom}` : ''}</span>
          </div>
          <button className="btn btn-ghost btn-sm w-full" onClick={signOut} style={{ color: 'rgba(255,255,255,.85)' }}>
            Sign out
          </button>
        </div>
      </aside>
      <div className={`sidebar-overlay ${open ? 'open' : ''}`} onClick={onClose} />
    </>
  );
}
