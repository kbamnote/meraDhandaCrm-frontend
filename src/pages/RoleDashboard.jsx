/**
 * RoleDashboard — the home screen at /admin. Renders a different dashboard per
 * role so staff never land on the company/admin console. Admin-family roles get
 * the business overview; functional roles get their own dashboard; everyone else
 * gets the personal "My Dashboard".
 */
import { useAuth } from '../context/AuthContext';
import PlatformConsolePage from './PlatformConsolePage';
import AdminDashboard from './dashboards/AdminDashboard';
import SalesDashboard from './dashboards/SalesDashboard';
import HrDashboard from './dashboards/HrDashboard';
import DesignerDashboard from './dashboards/DesignerDashboard';
import ProductionDashboard from './dashboards/ProductionDashboard';
import StaffDashboard from './dashboards/StaffDashboard';

const BY_ROLE = {
  owner: AdminDashboard,
  admin: AdminDashboard,
  superadmin: AdminDashboard,
  manager: AdminDashboard,
  sales: SalesDashboard,
  hr: HrDashboard,
  designer: DesignerDashboard,
  jobsetter: ProductionDashboard,
  floor_manager: ProductionDashboard,
};

export default function RoleDashboard() {
  const { profile, isPlatformAdmin } = useAuth();
  if (isPlatformAdmin) return <PlatformConsolePage />; // MeraDhanda staff → cross-tenant console
  const Comp = BY_ROLE[profile?.role] || StaffDashboard; // staff/pending/unknown → personal dashboard
  return <Comp />;
}
