import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useT } from '../../i18n/LanguageContext';

const SECTION_S = {
  Workspace: { en: 'Workspace', hi: 'वर्कस्पेस', hinglish: 'Workspace', gu: 'વર્કસ્પેસ', mr: 'वर्कस्पेस', mwr: 'वर्कस्पेस' },
  'Designers & Production': { en: 'Designers & Production', hi: 'डिज़ाइन और प्रोडक्शन', hinglish: 'Design & Production', gu: 'ડિઝાઇન અને પ્રોડક્શન', mr: 'डिझाइन व प्रोडक्शन', mwr: 'डिज़ाइन अर प्रोडक्शन' },
  'Sales & Leads': { en: 'Sales & Leads', hi: 'सेल्स और लीड्स', hinglish: 'Sales & Leads', gu: 'સેલ્સ અને લીડ્સ', mr: 'सेल्स व लीड्स', mwr: 'सेल्स अर लीड्स' },
  Accounting: { en: 'Accounting', hi: 'अकाउंटिंग', hinglish: 'Accounting', gu: 'એકાઉન્ટિંગ', mr: 'अकाउंटिंग', mwr: 'अकाउंटिंग' },
  HR: { en: 'HR', hi: 'एचआर', hinglish: 'HR', gu: 'એચઆર', mr: 'एचआर', mwr: 'एचआर' },
  Customer: { en: 'Customer', hi: 'ग्राहक', hinglish: 'Customer', gu: 'ગ્રાહક', mr: 'ग्राहक', mwr: 'ग्राहक' },
  'Admin / Settings': { en: 'Admin / Settings', hi: 'एडमिन / सेटिंग्स', hinglish: 'Admin / Settings', gu: 'એડમિન / સેટિંગ્સ', mr: 'अॅडमिन / सेटिंग्ज', mwr: 'एडमिन / सेटिंग्स' },
  'Sign out': { en: 'Sign out', hi: 'साइन आउट', hinglish: 'Sign out', gu: 'સાઇન આઉટ', mr: 'साइन आउट', mwr: 'साइन आउट' },
};

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
      { to: '/billing',          label: '💳 Billing & Plan',  legacy: 'page-billing',     roles: ['admin','superadmin','owner'] },
      { to: '/profile',          label: '👤 My Profile',      legacy: 'page-profile' },
      { to: '/platform',         label: '👑 Platform Console', legacy: 'page-platform',   platform: true },
    ],
  },
];

// Which onboarding module each sidebar route belongs to. Routes not listed here
// are "core" and always shown. A module is hidden only if the tenant explicitly
// turned it off during onboarding (settings.modules[key] === false).
const MODULE_OF = {
  '/designers': 'designers', '/designer': 'designers', '/designers-view': 'designers', '/jobsetter': 'designers',
  '/machines': 'machines', '/machine-history': 'machines',
  '/qc': 'qcDispatch', '/dispatch': 'qcDispatch',
  '/hr-dashboard': 'hr', '/hr-staff': 'hr', '/hr-leaves': 'hr', '/hr-payroll': 'hr',
  '/attendance': 'hr', '/productivity': 'hr', '/my-leaves': 'hr', '/my-attendance': 'hr',
  '/my-salary': 'hr', '/dept-mgmt': 'hr', '/manage-depts': 'hr',
  '/bulk-orders': 'bulk', '/enquiry': 'bulk', '/sample-dm': 'bulk',
};

export default function Sidebar({ open, onClose }) {
  const { profile, tenant, isPlatformAdmin, signOut } = useAuth();
  const t = useT(SECTION_S);
  const role = profile?.role;
  const custom = profile?.customRole;
  const modules = tenant?.settings?.modules || null;

  const canSee = (item) => {
    if (item.platform) return isPlatformAdmin;
    // Hide a link only if its module was explicitly disabled in onboarding.
    const mod = MODULE_OF[item.to];
    if (mod && modules && modules[mod] === false) return false;
    if (!item.roles) return true;
    return item.roles.includes(role) || item.roles.includes(custom);
  };

  const onTrial = tenant && tenant.plan === 'trial';

  return (
    <>
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-logo" style={{ display: 'block' }}>
          <div style={{ background: '#fff', borderRadius: 8, padding: '6px 10px', display: 'inline-block', marginBottom: 8 }}>
            <img src="/logo.png" alt="MeraDhanda" style={{ height: 24, display: 'block' }} />
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--sidebar-text-active)' }}>
            {tenant?.name || 'MeraDhanda CRM'}
          </div>
          {onTrial && (
            <a href="/billing" style={{ display: 'block', marginTop: 6, fontSize: 11, fontWeight: 500,
              color: tenant.expired ? '#FCA5A5' : '#FCD34D' }}>
              {tenant.expired ? '⛔ Trial ended — upgrade' : `⏳ Trial · ${tenant.trialDaysLeft ?? 0} days left`}
            </a>
          )}
        </div>
        <nav>
          {SECTIONS.map(sec => (
            <div key={sec.title}>
              <div className="sidebar-section-title">{t(sec.title)}</div>
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
            {profile?.name || profile?.email || 'Loading…'} <br/>
            <span style={{ fontSize: 10, opacity: .7 }}>{role || 'no role'} {custom ? `• ${custom}` : ''}</span>
          </div>
          <button className="btn btn-ghost btn-sm w-full" onClick={signOut} style={{ color: 'rgba(255,255,255,.85)' }}>
            {t('Sign out')}
          </button>
        </div>
      </aside>
      <div className={`sidebar-overlay ${open ? 'open' : ''}`} onClick={onClose} />
    </>
  );
}
