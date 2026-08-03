import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import ProtectedRoute from '@/features/auth/components/ProtectedRoute';

const LoginPage = lazy(() => import('@/features/auth/pages/LoginPage'));
const DashboardPage = lazy(() => import('@/features/dashboard/pages/DashboardPage'));
const MasterDataPage = lazy(() => import('@/features/master-data/pages/MasterDataPage'));
const InventoryListPage = lazy(() => import('@/features/inventory/pages/InventoryListPage'));
const AssetFormPage = lazy(() => import('@/features/inventory/pages/AssetFormPage'));
const AssetDetailPage = lazy(() => import('@/features/inventory/pages/AssetDetailPage'));
const ScanPage = lazy(() => import('@/features/qr/pages/ScanPage'));
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
      { path: 'analytics', element: <AnalyticsDashboardPage /> },
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
