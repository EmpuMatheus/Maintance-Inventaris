import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  Loader2,
  Package,
  Plus,
  QrCode,
  RefreshCw,
  TicketCheck,
  TrendingUp,
  Wrench,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  dashboardKeys,
  getDashboardSummary,
  getDashboardMaintenanceStats,
  getDashboardUpcomingSchedules,
  getDashboardCriticalAssets,
  getDashboardAssetStats,
  getDashboardConditionAnalytics,
  getDashboardAssetAge,
  getDashboardDepartmentAnalytics,
  getDashboardVendorAnalytics,
  getDashboardRecentActivity,
} from '../api/dashboard';
import { overdueSchedules } from '@/features/maintenance-schedules/api/schedules';
import { listNotifications } from '@/features/notifications/api/notifications';

const AUTO_REFRESH_MS = 60_000;

const STATUS_COLORS: Record<string, string> = {
  OPEN: '#6366f1',
  ASSIGNED: '#8b5cf6',
  IN_PROGRESS: '#f59e0b',
  WAITING_PART: '#f97316',
  TESTING: '#a855f7',
  COMPLETED: '#22c55e',
  CANCELLED: '#64748b',
};

const CONDITION_COLORS: Record<string, string> = {
  GOOD: '#22c55e',
  FAIR: '#eab308',
  NEED_ATTENTION: '#f97316',
  BROKEN: '#ef4444',
  CRITICAL: '#b91c1c',
  RETIRED: '#94a3b8',
};

const PALETTE = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6', '#f97316', '#3b82f6', '#64748b'];

function formatDate(value?: string | null): string {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(value?: string | null): string {
  if (!value) return '-';
  const d = new Date(value);
  return `${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} · ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
}

function KpiCard({
  label,
  value,
  icon,
  tone,
  onClick,
}: {
  label: string;
  value: number;
  icon: ReactNode;
  tone: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm ${onClick ? 'transition-shadow hover:shadow-md' : ''}`}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</span>
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${tone}`}>{icon}</span>
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
    </button>
  );
}

function KpiSkeleton() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 h-3 w-20 animate-pulse rounded bg-slate-100" />
      <div className="h-7 w-12 animate-pulse rounded bg-slate-100" />
    </div>
  );
}

function ChartCard({
  title,
  loading,
  error,
  empty,
  onRetry,
  children,
}: {
  title: string;
  loading?: boolean;
  error?: string;
  empty?: boolean;
  onRetry?: () => void;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">{title}</h2>
      {loading ? (
        <div className="flex h-56 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-slate-300" /></div>
      ) : error ? (
        <div className="flex h-56 flex-col items-center justify-center">
          <p className="mb-2 text-sm text-red-500">{error}</p>
          {onRetry && <button onClick={onRetry} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">Try Again</button>}
        </div>
      ) : empty ? (
        <div className="flex h-56 items-center justify-center">
          <p className="text-sm text-slate-400">No data yet.</p>
        </div>
      ) : (
        children
      )}
    </div>
  );
}

function ActivityIcon({ type }: { type: string }) {
  const cls = 'flex h-8 w-8 shrink-0 items-center justify-center rounded-full';
  if (type === 'MAINTENANCE_COMPLETED') return <span className={`${cls} bg-green-50`}><CheckCircle2 className="h-4 w-4 text-green-600" /></span>;
  if (type === 'MAINTENANCE_CREATED') return <span className={`${cls} bg-indigo-50`}><Wrench className="h-4 w-4 text-indigo-600" /></span>;
  if (type === 'CONDITION_CHANGED') return <span className={`${cls} bg-amber-50`}><CircleAlert className="h-4 w-4 text-amber-600" /></span>;
  if (type === 'ASSET_MOVED') return <span className={`${cls} bg-blue-50`}><Package className="h-4 w-4 text-blue-600" /></span>;
  return <span className={`${cls} bg-slate-50`}><Package className="h-4 w-4 text-slate-500" /></span>;
}

export default function DashboardPage() {
  const navigate = useNavigate();

  const summaryQ = useQuery({ queryKey: dashboardKeys.summary, queryFn: getDashboardSummary, refetchInterval: AUTO_REFRESH_MS });
  const maintenanceQ = useQuery({ queryKey: dashboardKeys.maintenance, queryFn: getDashboardMaintenanceStats, refetchInterval: AUTO_REFRESH_MS });
  const upcomingQ = useQuery({ queryKey: dashboardKeys.upcoming, queryFn: () => getDashboardUpcomingSchedules({ days: 365, limit: 6 }) });
  const criticalQ = useQuery({ queryKey: dashboardKeys.critical, queryFn: getDashboardCriticalAssets });
  const assetStatsQ = useQuery({ queryKey: dashboardKeys.assetStats, queryFn: getDashboardAssetStats });
  const conditionQ = useQuery({ queryKey: dashboardKeys.condition, queryFn: getDashboardConditionAnalytics });
  const ageQ = useQuery({ queryKey: dashboardKeys.age, queryFn: getDashboardAssetAge });
  const departmentQ = useQuery({ queryKey: dashboardKeys.department, queryFn: getDashboardDepartmentAnalytics });
  const vendorQ = useQuery({ queryKey: dashboardKeys.vendor, queryFn: getDashboardVendorAnalytics });
  const activityQ = useQuery({ queryKey: dashboardKeys.activity, queryFn: () => getDashboardRecentActivity({ limit: 12 }), refetchInterval: AUTO_REFRESH_MS });
  const overdueQ = useQuery({ queryKey: ['maintenance-schedules', 'overdue', { limit: 5 }], queryFn: () => overdueSchedules({ limit: 5 }) });
  const alertsQ = useQuery({ queryKey: ['notifications', 'list', { limit: 5 }], queryFn: () => listNotifications({ limit: 5 }), refetchInterval: AUTO_REFRESH_MS });

  const s = summaryQ.data?.data;
  const m = maintenanceQ.data?.data;

  const refreshAll = () => {
    summaryQ.refetch();
    maintenanceQ.refetch();
    upcomingQ.refetch();
    criticalQ.refetch();
    assetStatsQ.refetch();
    conditionQ.refetch();
    ageQ.refetch();
    departmentQ.refetch();
    vendorQ.refetch();
    activityQ.refetch();
    overdueQ.refetch();
    alertsQ.refetch();
  };

  const loadingSummary = summaryQ.isLoading;
  const summaryError = summaryQ.isError ? (summaryQ.error as Error)?.message : undefined;

  const conditionData = (conditionQ.data?.data?.byCondition ?? []).map((x) => ({
    name: x.condition.replace(/_/g, ' '),
    value: x.value,
    color: CONDITION_COLORS[x.condition] ?? '#94a3b8',
  }));
  const statusData = (m?.byStatus ?? []).map((x) => ({
    name: x.status.replace(/_/g, ' '),
    value: x.value,
    color: STATUS_COLORS[x.status] ?? '#94a3b8',
  }));
  const categoryData = (assetStatsQ.data?.data?.byCategory ?? []).map((x) => ({ name: x.category, value: x.value }));
  const departmentData = (departmentQ.data?.data?.byDepartment ?? []).map((x) => ({ name: x.department, value: x.value }));
  const vendorData = (vendorQ.data?.data?.byVendor ?? []).map((x) => ({ name: x.vendor, value: x.value }));
  const ageData = (ageQ.data?.data?.byAge ?? []).map((x) => ({ name: x.bucket, value: x.value }));
  const trendData = m?.monthlyTrend ?? [];

  const quickActions = [
    { label: 'Create Maintenance', icon: <Wrench className="h-4 w-4" />, to: '/maintenance/new' },
    { label: 'Scan QR', icon: <QrCode className="h-4 w-4" />, to: '/scan' },
    { label: 'Add Asset', icon: <Plus className="h-4 w-4" />, to: '/assets/new' },
    { label: 'Open Calendar', icon: <CalendarDays className="h-4 w-4" />, to: '/maintenance/calendar' },
    { label: 'Schedules', icon: <TrendingUp className="h-4 w-4" />, to: '/maintenance/schedules' },
  ];

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">Overview of inventory condition and maintenance.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refreshAll()}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw className={`h-4 w-4 ${summaryQ.isFetching ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button
            onClick={() => navigate('/maintenance/calendar')}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <CalendarDays className="h-4 w-4" /> Open Calendar
          </button>
        </div>
      </div>

      {summaryError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {summaryError}
        </div>
      )}

      {/* KPI cards */}
      {loadingSummary ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-6"><KpiSkeleton /><KpiSkeleton /><KpiSkeleton /><KpiSkeleton /><KpiSkeleton /><KpiSkeleton /></div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
          <KpiCard label="Total Assets" value={s?.assets.total ?? 0} icon={<Package className="h-4 w-4 text-indigo-600" />} tone="bg-indigo-50" onClick={() => navigate('/inventory')} />
          <KpiCard label="Due Today" value={s?.maintenance.dueToday ?? 0} icon={<CircleAlert className="h-4 w-4 text-amber-600" />} tone="bg-amber-50" onClick={() => navigate('/maintenance/schedules')} />
          <KpiCard label="Upcoming" value={s?.maintenance.upcoming ?? 0} icon={<CalendarDays className="h-4 w-4 text-blue-600" />} tone="bg-blue-50" onClick={() => navigate('/maintenance/schedules')} />
          <KpiCard label="Overdue" value={s?.maintenance.overdue ?? 0} icon={<AlertTriangle className="h-4 w-4 text-red-600" />} tone="bg-red-50" onClick={() => navigate('/maintenance/schedules')} />
          <KpiCard label="Completed This Month" value={s?.maintenance.completedThisMonth ?? 0} icon={<CheckCircle2 className="h-4 w-4 text-green-600" />} tone="bg-green-50" onClick={() => navigate('/maintenance')} />
          <KpiCard label="Critical" value={s?.assets.critical ?? 0} icon={<AlertTriangle className="h-4 w-4 text-red-700" />} tone="bg-red-100" onClick={() => navigate('/inventory')} />
        </div>
      )}

      {/* Condition strip */}
      <div className="mt-4 grid grid-cols-2 gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: 'Good', value: s?.assets.good ?? 0, cls: 'text-green-600' },
          { label: 'Fair', value: s?.assets.fair ?? 0, cls: 'text-yellow-600' },
          { label: 'Need Attention', value: s?.assets.needAttention ?? 0, cls: 'text-orange-600' },
          { label: 'Broken', value: s?.assets.broken ?? 0, cls: 'text-red-600' },
          { label: 'In Maintenance', value: s?.assets.inMaintenance ?? 0, cls: 'text-amber-600' },
          { label: 'Total Maintenance', value: m?.byStatus.reduce((acc, x) => acc + x.value, 0) ?? 0, cls: 'text-indigo-600' },
        ].map((x) => (
          <div key={x.label} className="text-center">
            <p className={`text-xl font-bold ${x.cls}`}>{x.value}</p>
            <p className="text-xs text-slate-400">{x.label}</p>
          </div>
        ))}
      </div>

      {/* Ticket summary */}
      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Open Tickets" value={s?.tickets.open ?? 0} icon={<TicketCheck className="h-4 w-4 text-blue-600" />} tone="bg-blue-50" onClick={() => navigate('/tickets')} />
        <KpiCard label="Critical Tickets" value={s?.tickets.critical ?? 0} icon={<AlertTriangle className="h-4 w-4 text-red-600" />} tone="bg-red-50" onClick={() => navigate('/tickets')} />
        <KpiCard label="Resolved Today" value={s?.tickets.resolvedToday ?? 0} icon={<CheckCircle2 className="h-4 w-4 text-green-600" />} tone="bg-green-50" onClick={() => navigate('/tickets')} />
        <KpiCard label="Avg Resolution" value={Math.round((s?.tickets.avgResolutionHours ?? 0) * 10) / 10} icon={<TrendingUp className="h-4 w-4 text-indigo-600" />} tone="bg-indigo-50" onClick={() => navigate('/tickets')} />
      </div>

      {/* Charts */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <ChartCard title="Asset by Category" loading={assetStatsQ.isLoading} error={assetStatsQ.isError ? 'Failed to load' : undefined} onRetry={() => assetStatsQ.refetch()} empty={categoryData.length === 0}>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={categoryData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={50} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {categoryData.map((_e, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Condition Distribution" loading={conditionQ.isLoading} error={conditionQ.isError ? 'Failed to load' : undefined} onRetry={() => conditionQ.refetch()} empty={conditionData.length === 0}>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={conditionData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                {conditionData.map((e) => <Cell key={e.name} fill={e.color} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Maintenance Status" loading={maintenanceQ.isLoading} error={maintenanceQ.isError ? 'Failed to load' : undefined} onRetry={() => maintenanceQ.refetch()} empty={statusData.length === 0}>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                {statusData.map((e) => <Cell key={e.name} fill={e.color} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Asset by Department" loading={departmentQ.isLoading} error={departmentQ.isError ? 'Failed to load' : undefined} onRetry={() => departmentQ.refetch()} empty={departmentData.length === 0}>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={departmentData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={50} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} fill="#0ea5e9" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Asset by Vendor" loading={vendorQ.isLoading} error={vendorQ.isError ? 'Failed to load' : undefined} onRetry={() => vendorQ.refetch()} empty={vendorData.length === 0}>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={vendorData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={50} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Asset by Age" loading={ageQ.isLoading} error={ageQ.isError ? 'Failed to load' : undefined} onRetry={() => ageQ.refetch()} empty={ageData.length === 0}>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={ageData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} height={50} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} fill="#f59e0b" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <div className="lg:col-span-3">
          <ChartCard title="Maintenance Trend" loading={maintenanceQ.isLoading} error={maintenanceQ.isError ? 'Failed to load' : undefined} onRetry={() => maintenanceQ.refetch()} empty={trendData.length === 0}>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={trendData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </div>

      {/* Lists */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Upcoming Schedule */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Upcoming Schedule</h2>
            <button onClick={() => navigate('/maintenance/schedules')} className="text-xs font-medium text-indigo-600 hover:underline">View all</button>
          </div>
          {upcomingQ.isError ? (
            <p className="py-8 text-center text-sm text-red-500">Failed to load.</p>
          ) : upcomingQ.isLoading ? (
            <div className="py-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-300" /></div>
          ) : (!upcomingQ.data?.data || upcomingQ.data.data.length === 0) ? (
            <p className="py-8 text-center text-sm text-slate-400">No upcoming maintenance scheduled.</p>
          ) : (
            <div className="space-y-3">
              {upcomingQ.data.data.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">{s.asset?.assetName}</p>
                    <p className="font-mono text-xs text-slate-400">{s.asset?.assetCode} · {s.maintenanceType?.name || 'Preventive'}</p>
                  </div>
                  <div className="ml-3 shrink-0 text-right">
                    <p className="text-xs font-medium text-slate-600">{formatDate(s.nextMaintenanceDate)}</p>
                    {s.daysUntil != null && <p className="text-xs text-blue-600">in {s.daysUntil}d</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Overdue Maintenance */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Overdue Maintenance</h2>
            <button onClick={() => navigate('/maintenance/schedules')} className="text-xs font-medium text-red-600 hover:underline">View all</button>
          </div>
          {overdueQ.isError ? (
            <p className="py-8 text-center text-sm text-red-500">Failed to load.</p>
          ) : overdueQ.isLoading ? (
            <div className="py-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-300" /></div>
          ) : (!overdueQ.data?.data || overdueQ.data.data.length === 0) ? (
            <p className="py-8 text-center text-sm text-slate-400">Nothing overdue. Well done.</p>
          ) : (
            <div className="space-y-3">
              {overdueQ.data.data.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-lg border border-red-100 bg-red-50/40 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">{s.asset?.assetName}</p>
                    <p className="font-mono text-xs text-slate-400">{s.asset?.assetCode}</p>
                  </div>
                  <div className="ml-3 shrink-0 text-right">
                    <p className="text-xs font-medium text-red-600">{formatDate(s.nextMaintenanceDate)}</p>
                    {s.daysOverdue != null && <p className="text-xs text-red-500">{s.daysOverdue}d overdue</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Critical Assets */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Critical Assets</h2>
            <button onClick={() => navigate('/inventory')} className="text-xs font-medium text-indigo-600 hover:underline">View all</button>
          </div>
          {criticalQ.isError ? (
            <p className="py-8 text-center text-sm text-red-500">Failed to load.</p>
          ) : criticalQ.isLoading ? (
            <div className="py-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-300" /></div>
          ) : (!criticalQ.data?.data || criticalQ.data.data.length === 0) ? (
            <p className="py-8 text-center text-sm text-slate-400">No critical assets.</p>
          ) : (
            <div className="space-y-3">
              {criticalQ.data.data.map((a) => (
                <button key={a.id} onClick={() => navigate(`/assets/${a.id}`)} className="flex w-full items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-left hover:bg-slate-50">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">{a.assetName}</p>
                    <p className="font-mono text-xs text-slate-400">{a.assetCode}</p>
                  </div>
                  <span className={`ml-3 shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                    a.condition === 'CRITICAL' ? 'bg-red-100 text-red-800' : a.condition === 'BROKEN' ? 'bg-red-50 text-red-700' : 'bg-orange-50 text-orange-700'
                  }`}>{a.condition.replace(/_/g, ' ')}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Latest Alerts */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Latest Alerts</h2>
            <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">{s?.notifications.unread ?? 0} unread</span>
          </div>
          {alertsQ.isError ? (
            <p className="py-8 text-center text-sm text-red-500">Failed to load.</p>
          ) : alertsQ.isLoading ? (
            <div className="py-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-300" /></div>
          ) : (!alertsQ.data?.data || alertsQ.data.data.length === 0) ? (
            <p className="py-8 text-center text-sm text-slate-400">No notifications.</p>
          ) : (
            <div className="space-y-3">
              {alertsQ.data.data.map((n) => (
                <button
                  key={n.id}
                  onClick={() => navigate('/notifications')}
                  className={`flex w-full items-start gap-3 rounded-lg border border-slate-100 px-3 py-2 text-left hover:bg-slate-50 ${n.isRead ? 'opacity-70' : ''}`}
                >
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.priority === 'CRITICAL' ? 'bg-red-500' : n.priority === 'WARNING' ? 'bg-amber-500' : n.priority === 'SUCCESS' ? 'bg-green-500' : 'bg-slate-400'}`} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">{n.title}</p>
                    {n.message && <p className="truncate text-xs text-slate-500">{n.message}</p>}
                    <p className="text-[10px] text-slate-400">{new Date(n.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activities */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">Recent Activities</h2>
          {activityQ.isError ? (
            <p className="py-8 text-center text-sm text-red-500">Failed to load.</p>
          ) : activityQ.isLoading ? (
            <div className="py-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-300" /></div>
          ) : (!activityQ.data?.data || activityQ.data.data.length === 0) ? (
            <p className="py-8 text-center text-sm text-slate-400">No recent activity.</p>
          ) : (
            <div className="space-y-3">
              {activityQ.data.data.map((ev, i) => (
                <div key={i} className="flex items-start gap-3">
                  <ActivityIcon type={ev.type} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800">{ev.title}</p>
                    <p className="truncate text-xs text-slate-500">
                      {ev.description}
                      {ev.reference ? ` · ${ev.reference}` : ''}
                    </p>
                    <p className="text-xs text-slate-400">{formatDateTime(ev.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {quickActions.map((qa) => (
              <button
                key={qa.label}
                onClick={() => navigate(qa.to)}
                className="flex flex-col items-center gap-2 rounded-lg border border-slate-200 px-3 py-4 text-sm font-medium text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">{qa.icon}</span>
                {qa.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
