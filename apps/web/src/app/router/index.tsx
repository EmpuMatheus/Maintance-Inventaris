import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import ProtectedRoute from '@/features/auth/components/ProtectedRoute';
import RequirePermission from '@/features/auth/components/RequirePermission';

const LoginPage = lazy(() => import('@/features/auth/pages/LoginPage'));
const DashboardPage = lazy(() => import('@/features/dashboard/pages/DashboardPage'));
const ProfilePage = lazy(() => import('@/features/profile/pages/ProfilePage'));
const MasterDataPage = lazy(() => import('@/features/master-data/pages/MasterDataPage'));
const InventoryListPage = lazy(() => import('@/features/inventory/pages/InventoryListPage'));
const ViewAllComponentsPage = lazy(() => import('@/features/inventory/pages/ViewAllComponentsPage'));
const AssetFormPage = lazy(() => import('@/features/inventory/pages/AssetFormPage'));
const AssetDetailPage = lazy(() => import('@/features/inventory/pages/AssetDetailPage'));
const MaintenanceListPage = lazy(() => import('@/features/maintenance/pages/MaintenanceListPage'));
const MaintenanceFormPage = lazy(() => import('@/features/maintenance/pages/MaintenanceFormPage'));
const MaintenanceDetailPage = lazy(() => import('@/features/maintenance/pages/MaintenanceDetailPage'));
const SchedulesPage = lazy(() => import('@/features/maintenance-schedules/pages/SchedulesPage'));
const NewSchedulePage = lazy(() => import('@/features/maintenance-schedules/pages/NewSchedulePage'));
const CalendarPage = lazy(() => import('@/features/maintenance-schedules/pages/CalendarPage'));
const TicketListPage = lazy(() => import('@/features/tickets/pages/TicketListPage'));
const TicketFormPage = lazy(() => import('@/features/tickets/pages/TicketFormPage'));
const TicketDetailPage = lazy(() => import('@/features/tickets/pages/TicketDetailPage'));
const NotificationsPage = lazy(() => import('@/features/notifications/pages/NotificationsPage'));
const InventoryReportPage = lazy(() => import('@/features/reports/pages/InventoryReportPage'));
const MaintenanceReportPage = lazy(() => import('@/features/reports/pages/MaintenanceReportPage'));
const MaintenanceCostReportPage = lazy(() => import('@/features/reports/pages/MaintenanceCostReportPage'));
const AssetConditionReportPage = lazy(() => import('@/features/reports/pages/AssetConditionReportPage'));
const BrokenAssetReportPage = lazy(() => import('@/features/reports/pages/BrokenAssetReportPage'));
const MovementReportPage = lazy(() => import('@/features/reports/pages/MovementReportPage'));
const WarrantyReportPage = lazy(() => import('@/features/reports/pages/WarrantyReportPage'));
const AssetAgingReportPage = lazy(() => import('@/features/reports/pages/AssetAgingReportPage'));
const AuditListPage = lazy(() => import('@/features/audit/pages/AuditListPage'));
const AuditDetailPage = lazy(() => import('@/features/audit/pages/AuditDetailPage'));
const UserListPage = lazy(() => import('@/features/users/pages/UserListPage'));
const UserFormPage = lazy(() => import('@/features/users/pages/UserFormPage'));
const UserDetailPage = lazy(() => import('@/features/users/pages/UserDetailPage'));
const RoleListPage = lazy(() => import('@/features/roles/pages/RoleListPage'));
const RoleFormPage = lazy(() => import('@/features/roles/pages/RoleFormPage'));
const RoleDetailPage = lazy(() => import('@/features/roles/pages/RoleDetailPage'));
const AnalyticsDashboardPage = lazy(() => import('@/features/analytics/pages/AnalyticsDashboardPage'));
const NetworkMonitoringPage = lazy(() => import('@/features/network-monitoring/pages/NetworkMonitoringPage'));
const NetworkDeviceListPage = lazy(() => import('@/features/network-devices/pages/NetworkDeviceListPage'));
const NetworkDeviceFormPage = lazy(() => import('@/features/network-devices/pages/NetworkDeviceFormPage'));
const NetworkDeviceDetailPage = lazy(() => import('@/features/network-devices/pages/NetworkDeviceDetailPage'));
const CctvDeviceListPage = lazy(() => import('@/features/cctv/pages/CctvDeviceListPage'));
const CctvDeviceFormPage = lazy(() => import('@/features/cctv/pages/CctvDeviceFormPage'));
const CctvDeviceDetailPage = lazy(() => import('@/features/cctv/pages/CctvDeviceDetailPage'));
const CctvLiveViewPage = lazy(() => import('@/features/cctv/pages/CctvLiveViewPage'));
const CctvMonitorPage = lazy(() => import('@/features/cctv/pages/CctvMonitorPage'));
const NotFoundPage = lazy(() => import('@/features/misc/NotFoundPage'));

const protectedLayout = (
  <ProtectedRoute>
    <AppLayout />
  </ProtectedRoute>
);

const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: protectedLayout,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'profile', element: <RequirePermission permission="profile.update"><ProfilePage /></RequirePermission> },
      { path: 'inventory', element: <InventoryListPage /> },
      { path: 'components', element: <ViewAllComponentsPage /> },
      { path: 'assets/new', element: <RequirePermission permission="asset.create"><AssetFormPage /></RequirePermission> },
      { path: 'assets/:id', element: <AssetDetailPage /> },
      { path: 'assets/:id/edit', element: <RequirePermission permission="asset.update"><AssetFormPage /></RequirePermission> },
      { path: 'master-data', element: <RequirePermission permission="master_data.read"><MasterDataPage /></RequirePermission> },
      { path: 'maintenance', element: <RequirePermission permission="maintenance.read"><MaintenanceListPage /></RequirePermission> },
      { path: 'maintenance/new', element: <RequirePermission permission="maintenance.create"><MaintenanceFormPage /></RequirePermission> },
      { path: 'maintenance/schedules', element: <RequirePermission permission="maintenance.read"><SchedulesPage /></RequirePermission> },
      { path: 'maintenance/schedules/new', element: <RequirePermission permission="maintenance.create"><NewSchedulePage /></RequirePermission> },
      { path: 'maintenance/calendar', element: <RequirePermission permission="maintenance.read"><CalendarPage /></RequirePermission> },
      { path: 'maintenance/:id', element: <RequirePermission permission="maintenance.read"><MaintenanceDetailPage /></RequirePermission> },
      { path: 'tickets', element: <TicketListPage /> },
      { path: 'tickets/new', element: <TicketFormPage /> },
      { path: 'tickets/:id', element: <TicketDetailPage /> },
      { path: 'tickets/:id/edit', element: <RequirePermission permission="ticket.update"><TicketFormPage /></RequirePermission> },
      { path: 'notifications', element: <NotificationsPage /> },
      { path: 'analytics', element: <RequirePermission permission="analytics.read"><AnalyticsDashboardPage /></RequirePermission> },
      { path: 'network-monitoring', element: <RequirePermission permission="network_device.read"><NetworkMonitoringPage /></RequirePermission> },
      { path: 'network-devices', element: <RequirePermission permission="network_device.read"><NetworkDeviceListPage /></RequirePermission> },
      { path: 'network-devices/new', element: <RequirePermission permission="network_device.manage"><NetworkDeviceFormPage /></RequirePermission> },
      { path: 'network-devices/:id', element: <RequirePermission permission="network_device.read"><NetworkDeviceDetailPage /></RequirePermission> },
      { path: 'network-devices/:id/edit', element: <RequirePermission permission="network_device.manage"><NetworkDeviceFormPage /></RequirePermission> },
      { path: 'cctv/devices', element: <RequirePermission anyOf={['cctv_device.read', 'cctv_device.manage']}><CctvDeviceListPage /></RequirePermission> },
      { path: 'cctv/devices/new', element: <RequirePermission permission="cctv_device.manage"><CctvDeviceFormPage /></RequirePermission> },
      { path: 'cctv/devices/:id', element: <RequirePermission anyOf={['cctv_device.read', 'cctv_device.manage']}><CctvDeviceDetailPage /></RequirePermission> },
      { path: 'cctv/devices/:id/edit', element: <RequirePermission permission="cctv_device.manage"><CctvDeviceFormPage /></RequirePermission> },
      { path: 'cctv/live', element: <RequirePermission anyOf={['cctv_stream.read', 'cctv_stream.manage', 'cctv_device.manage']}><CctvLiveViewPage /></RequirePermission> },
      { path: 'cctv/monitor', element: <RequirePermission anyOf={['cctv_stream.read', 'cctv_stream.manage', 'cctv_device.manage']}><CctvMonitorPage /></RequirePermission> },
      { path: 'reports/inventory', element: <RequirePermission permission="report.read"><InventoryReportPage /></RequirePermission> },
      { path: 'reports/maintenance', element: <RequirePermission permission="report.read"><MaintenanceReportPage /></RequirePermission> },
      { path: 'reports/maintenance-cost', element: <RequirePermission permission="report.read"><MaintenanceCostReportPage /></RequirePermission> },
      { path: 'reports/asset-condition', element: <RequirePermission permission="report.read"><AssetConditionReportPage /></RequirePermission> },
      { path: 'reports/broken-asset', element: <RequirePermission permission="report.read"><BrokenAssetReportPage /></RequirePermission> },
      { path: 'reports/movement', element: <RequirePermission permission="report.read"><MovementReportPage /></RequirePermission> },
      { path: 'reports/warranty', element: <RequirePermission permission="report.read"><WarrantyReportPage /></RequirePermission> },
      { path: 'reports/asset-aging', element: <RequirePermission permission="report.read"><AssetAgingReportPage /></RequirePermission> },
      { path: 'audit', element: <RequirePermission permission="audit.read"><AuditListPage /></RequirePermission> },
      { path: 'audit/:id', element: <RequirePermission permission="audit.read"><AuditDetailPage /></RequirePermission> },
      { path: 'users', element: <RequirePermission permission="user.read"><UserListPage /></RequirePermission> },
      { path: 'users/new', element: <RequirePermission permission="user.create"><UserFormPage /></RequirePermission> },
      { path: 'users/:id', element: <RequirePermission permission="user.read"><UserDetailPage /></RequirePermission> },
      { path: 'users/:id/edit', element: <RequirePermission permission="user.update"><UserFormPage /></RequirePermission> },
      { path: 'roles', element: <RequirePermission permission="role.read"><RoleListPage /></RequirePermission> },
      { path: 'roles/new', element: <RequirePermission permission="role.create"><RoleFormPage /></RequirePermission> },
      { path: 'roles/:id', element: <RequirePermission permission="role.read"><RoleDetailPage /></RequirePermission> },
    ],
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
]);

function PageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
    </div>
  );
}

export function AppRouter() {
  return (
    <Suspense fallback={<PageLoader />}>
      <RouterProvider router={router} />
    </Suspense>
  );
}
