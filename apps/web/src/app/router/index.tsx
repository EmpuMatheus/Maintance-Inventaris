import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import LoginPage from '@/features/auth/pages/LoginPage';
import MasterDataPage from '@/features/master-data/pages/MasterDataPage';
import InventoryListPage from '@/features/inventory/pages/InventoryListPage';
import AssetFormPage from '@/features/inventory/pages/AssetFormPage';
import AssetDetailPage from '@/features/inventory/pages/AssetDetailPage';
import ScanPage from '@/features/qr/pages/ScanPage';
import MaintenanceListPage from '@/features/maintenance/pages/MaintenanceListPage';
import MaintenanceFormPage from '@/features/maintenance/pages/MaintenanceFormPage';
import MaintenanceDetailPage from '@/features/maintenance/pages/MaintenanceDetailPage';
import SchedulesPage from '@/features/maintenance-schedules/pages/SchedulesPage';
import CalendarPage from '@/features/maintenance-schedules/pages/CalendarPage';
import NewSchedulePage from '@/features/maintenance-schedules/pages/NewSchedulePage';
import DashboardPage from '@/features/dashboard/pages/DashboardPage';
import TicketListPage from '@/features/tickets/pages/TicketListPage';
import TicketFormPage from '@/features/tickets/pages/TicketFormPage';
import TicketDetailPage from '@/features/tickets/pages/TicketDetailPage';
import NotificationsPage from '@/features/notifications/pages/NotificationsPage';
import InventoryReportPage from '@/features/reports/pages/InventoryReportPage';
import MaintenanceReportPage from '@/features/reports/pages/MaintenanceReportPage';
import MaintenanceCostReportPage from '@/features/reports/pages/MaintenanceCostReportPage';
import AssetConditionReportPage from '@/features/reports/pages/AssetConditionReportPage';
import BrokenAssetReportPage from '@/features/reports/pages/BrokenAssetReportPage';
import MovementReportPage from '@/features/reports/pages/MovementReportPage';
import WarrantyReportPage from '@/features/reports/pages/WarrantyReportPage';
import AssetAgingReportPage from '@/features/reports/pages/AssetAgingReportPage';
import AuditListPage from '@/features/audit/pages/AuditListPage';
import AuditDetailPage from '@/features/audit/pages/AuditDetailPage';
import UserListPage from '@/features/users/pages/UserListPage';
import UserFormPage from '@/features/users/pages/UserFormPage';
import UserDetailPage from '@/features/users/pages/UserDetailPage';
import RoleListPage from '@/features/roles/pages/RoleListPage';
import RoleFormPage from '@/features/roles/pages/RoleFormPage';
import RoleDetailPage from '@/features/roles/pages/RoleDetailPage';
import AppLayout from '@/components/layout/AppLayout';
import ProtectedRoute from '@/features/auth/components/ProtectedRoute';

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
      { path: 'inventory', element: <InventoryListPage /> },
      { path: 'assets/new', element: <AssetFormPage /> },
      { path: 'assets/:id', element: <AssetDetailPage /> },
      { path: 'assets/:id/edit', element: <AssetFormPage /> },
      { path: 'master-data', element: <MasterDataPage /> },
      { path: 'scan', element: <ScanPage /> },
      { path: 'maintenance', element: <MaintenanceListPage /> },
      { path: 'maintenance/new', element: <MaintenanceFormPage /> },
      { path: 'maintenance/schedules', element: <SchedulesPage /> },
      { path: 'maintenance/schedules/new', element: <NewSchedulePage /> },
      { path: 'maintenance/calendar', element: <CalendarPage /> },
      { path: 'maintenance/:id', element: <MaintenanceDetailPage /> },
      { path: 'tickets', element: <TicketListPage /> },
      { path: 'tickets/new', element: <TicketFormPage /> },
      { path: 'tickets/:id', element: <TicketDetailPage /> },
      { path: 'tickets/:id/edit', element: <TicketFormPage /> },
      { path: 'notifications', element: <NotificationsPage /> },
      { path: 'reports/inventory', element: <InventoryReportPage /> },
      { path: 'reports/maintenance', element: <MaintenanceReportPage /> },
      { path: 'reports/maintenance-cost', element: <MaintenanceCostReportPage /> },
      { path: 'reports/asset-condition', element: <AssetConditionReportPage /> },
      { path: 'reports/broken-asset', element: <BrokenAssetReportPage /> },
      { path: 'reports/movement', element: <MovementReportPage /> },
      { path: 'reports/warranty', element: <WarrantyReportPage /> },
      { path: 'reports/asset-aging', element: <AssetAgingReportPage /> },
      { path: 'audit', element: <AuditListPage /> },
      { path: 'audit/:id', element: <AuditDetailPage /> },
      { path: 'users', element: <UserListPage /> },
      { path: 'users/new', element: <UserFormPage /> },
      { path: 'users/:id', element: <UserDetailPage /> },
      { path: 'users/:id/edit', element: <UserFormPage /> },
      { path: 'roles', element: <RoleListPage /> },
      { path: 'roles/new', element: <RoleFormPage /> },
      { path: 'roles/:id', element: <RoleDetailPage /> },
    ],
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
