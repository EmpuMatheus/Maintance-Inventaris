import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Package, LayoutDashboard, ClipboardList, Database, Wrench, Scan, LogOut, Menu, User,
  ChevronDown, ChevronRight, CalendarClock, CalendarDays, TicketCheck, BarChart3, Settings2,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import NotificationBell from '@/features/notifications/components/NotificationBell';

const MASTER_DATA_ITEMS = [
  { label: 'Categories', section: 'categories' },
  { label: 'Subcategories', section: 'subcategories' },
  { label: 'Brands', section: 'brands' },
  { label: 'Departments', section: 'departments' },
  { label: 'Vendors', section: 'vendors' },
  { label: 'Sites', section: 'sites' },
  { label: 'Buildings', section: 'buildings' },
  { label: 'Floors', section: 'floors' },
  { label: 'Rooms', section: 'rooms' },
  { label: 'Maint. Types', section: 'maintenance-types' },
];

export default function AppLayout() {
  const { user, logout, can } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mdOpen, setMdOpen] = useState(() => location.pathname.startsWith('/master-data'));
  const [reportsOpen, setReportsOpen] = useState(() => location.pathname.startsWith('/reports'));
  const [adminOpen, setAdminOpen] = useState(() => location.pathname.startsWith('/audit') || location.pathname.startsWith('/users') || location.pathname.startsWith('/roles'));

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const getSection = () => {
    const sp = new URLSearchParams(location.search);
    return sp.get('section');
  };

  const currentSection = getSection();
  const mdActive = isActive('/master-data');

  const go = (path: string) => {
    navigate(path);
    setMobileOpen(false);
  };

  const sidebarContent = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 border-b border-slate-200 px-5 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
          <Package className="h-4 w-4 text-white" />
        </div>
        <span className="text-sm font-semibold text-slate-900">Office Inventory</span>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        <button
          onClick={() => go('/')}
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
            isActive('/') ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <LayoutDashboard className="h-4 w-4 shrink-0" /> Dashboard
        </button>

        <button
          onClick={() => go('/inventory')}
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
            isActive('/inventory') || isActive('/assets/') ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <ClipboardList className="h-4 w-4 shrink-0" /> Inventory
        </button>

        <button
          onClick={() => go('/scan')}
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
            isActive('/scan') ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Scan className="h-4 w-4 shrink-0" /> Scan
        </button>

        <button
          onClick={() => go('/maintenance')}
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
            isActive('/maintenance') ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Wrench className="h-4 w-4 shrink-0" /> Maintenance
        </button>

        <button
          onClick={() => go('/maintenance/schedules')}
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
            isActive('/maintenance/schedules') ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <CalendarClock className="h-4 w-4 shrink-0" /> Schedules
        </button>

        <button
          onClick={() => go('/maintenance/calendar')}
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
            isActive('/maintenance/calendar') ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <CalendarDays className="h-4 w-4 shrink-0" /> Calendar
        </button>

        <button
          onClick={() => go('/tickets')}
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
            isActive('/tickets') ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <TicketCheck className="h-4 w-4 shrink-0" /> Tickets
        </button>

        {can('report.read') && (
          <div>
            <button
              onClick={() => { setReportsOpen(!reportsOpen); if (!reportsOpen) go('/reports/inventory'); }}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive('/reports') ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <BarChart3 className="h-4 w-4 shrink-0" />
              <span className="flex-1 text-left">Reports</span>
              {reportsOpen ? <ChevronDown className="h-3.5 w-3.5 text-slate-400" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-400" />}
            </button>
            {reportsOpen && (
              <div className="ml-3 mt-0.5 space-y-0.5 border-l-2 border-slate-200 pl-3">
                <button
                  onClick={() => go('/reports/inventory')}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    isActive('/reports/inventory') ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${isActive('/reports/inventory') ? 'bg-indigo-600' : 'bg-slate-300'}`} />
                  Inventory Report
                </button>
                <button
                  onClick={() => go('/reports/maintenance')}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    isActive('/reports/maintenance') ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${isActive('/reports/maintenance') ? 'bg-indigo-600' : 'bg-slate-300'}`} />
                  Maintenance Report
                </button>
                <button
                  onClick={() => go('/reports/maintenance-cost')}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    isActive('/reports/maintenance-cost') ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${isActive('/reports/maintenance-cost') ? 'bg-indigo-600' : 'bg-slate-300'}`} />
                  Maintenance Cost Report
                </button>
                <button
                  onClick={() => go('/reports/asset-condition')}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    isActive('/reports/asset-condition') ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${isActive('/reports/asset-condition') ? 'bg-indigo-600' : 'bg-slate-300'}`} />
                  Asset Condition Report
                </button>
                <button
                  onClick={() => go('/reports/broken-asset')}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    isActive('/reports/broken-asset') ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${isActive('/reports/broken-asset') ? 'bg-indigo-600' : 'bg-slate-300'}`} />
                  Broken Asset Report
                </button>
                <button
                  onClick={() => go('/reports/movement')}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    isActive('/reports/movement') ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${isActive('/reports/movement') ? 'bg-indigo-600' : 'bg-slate-300'}`} />
                  Movement Report
                </button>
                <button
                  onClick={() => go('/reports/warranty')}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    isActive('/reports/warranty') ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${isActive('/reports/warranty') ? 'bg-indigo-600' : 'bg-slate-300'}`} />
                  Warranty Report
                </button>
                <button
                  onClick={() => go('/reports/asset-aging')}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    isActive('/reports/asset-aging') ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${isActive('/reports/asset-aging') ? 'bg-indigo-600' : 'bg-slate-300'}`} />
                  Asset Aging Report
                </button>
              </div>
            )}
          </div>
        )}

        {can('audit.read') || can('user.read') || can('role.read') ? (
          <div>
            <button
              onClick={() => { setAdminOpen(!adminOpen); if (!adminOpen) go('/audit'); }}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive('/audit') || isActive('/users') || isActive('/roles') ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Settings2 className="h-4 w-4 shrink-0" />
              <span className="flex-1 text-left">Administration</span>
              {adminOpen ? <ChevronDown className="h-3.5 w-3.5 text-slate-400" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-400" />}
            </button>
            {adminOpen && (
              <div className="ml-3 mt-0.5 space-y-0.5 border-l-2 border-slate-200 pl-3">
                {can('audit.read') && (
                  <button
                    onClick={() => go('/audit')}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                      isActive('/audit') ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${isActive('/audit') ? 'bg-indigo-600' : 'bg-slate-300'}`} />
                    Audit Logs
                  </button>
                )}
                {can('user.read') && (
                  <button
                    onClick={() => go('/users')}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                      isActive('/users') ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${isActive('/users') ? 'bg-indigo-600' : 'bg-slate-300'}`} />
                    Users
                  </button>
                )}
                {can('role.read') && (
                  <button
                    onClick={() => go('/roles')}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                      isActive('/roles') ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${isActive('/roles') ? 'bg-indigo-600' : 'bg-slate-300'}`} />
                    Roles
                  </button>
                )}
              </div>
            )}
          </div>
        ) : null}

        <div>
          <button
            onClick={() => { setMdOpen(!mdOpen); if (!mdOpen) go('/master-data'); }}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              mdActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Database className="h-4 w-4 shrink-0" />
            <span className="flex-1 text-left">Master Data</span>
            {mdOpen ? <ChevronDown className="h-3.5 w-3.5 text-slate-400" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-400" />}
          </button>
          {mdOpen && can('master_data.read') && (
            <div className="ml-3 mt-0.5 space-y-0.5 border-l-2 border-slate-200 pl-3">
              {MASTER_DATA_ITEMS.map((item) => {
                const childActive = mdActive && currentSection === item.section;
                return (
                  <button
                    key={item.section}
                    onClick={() => go(`/master-data?section=${item.section}`)}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                      childActive
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${childActive ? 'bg-indigo-600' : 'bg-slate-300'}`} />
                    {item.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </nav>

      <div className="border-t border-slate-200 p-4">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
            <User className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1 text-left">
            <p className="truncate text-sm font-medium text-slate-900">{user?.name}</p>
            <p className="truncate text-xs text-slate-400">@{user?.username}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-700"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white md:block">
        {sidebarContent}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMobileOpen(false)} />
          <aside className="relative h-full w-60 bg-white shadow-xl">
            {sidebarContent}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
          <div className="flex items-center gap-2 md:hidden">
            <button onClick={() => setMobileOpen(true)} className="rounded p-1 text-slate-500 hover:bg-slate-100">
              <Menu className="h-5 w-5" />
            </button>
            <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Package className="h-4 w-4 text-indigo-600" /> Office Inventory
            </span>
          </div>
          <div className="hidden items-center text-sm font-semibold text-slate-900 md:flex">
            <Package className="mr-2 h-4 w-4 text-indigo-600" /> Office Inventory
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <span className="hidden text-sm font-medium text-slate-700 sm:block">{user?.name}</span>
          </div>
        </header>
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
