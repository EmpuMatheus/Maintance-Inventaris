import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Bell, Loader2, Package, RefreshCw, TicketCheck, Wrench } from 'lucide-react';
import { getDashboardMySummary } from '../api/dashboard';

const AUTO_REFRESH_MS = 60_000;

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
      className={`rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm ${onClick ? 'transition-shadow hover:shadow-md' : 'cursor-default'}`}
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

export default function MyDashboard() {
  const navigate = useNavigate();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['dashboard', 'my-summary'],
    queryFn: getDashboardMySummary,
    refetchInterval: AUTO_REFRESH_MS,
  });

  const s = data?.data;
  const recent = s?.recentNotifications ?? [];

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">Your assets, tickets and maintenance at a glance.</p>
        </div>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {isError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Failed to load your dashboard summary.
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4"><KpiSkeleton /><KpiSkeleton /><KpiSkeleton /><KpiSkeleton /></div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard label="My Assets" value={s?.myAssets ?? 0} icon={<Package className="h-4 w-4 text-indigo-600" />} tone="bg-indigo-50" onClick={() => navigate('/inventory')} />
          <KpiCard label="My Open Tickets" value={s?.myOpenTickets ?? 0} icon={<TicketCheck className="h-4 w-4 text-blue-600" />} tone="bg-blue-50" onClick={() => navigate('/tickets')} />
          <KpiCard label="My Maintenance" value={s?.myMaintenance ?? 0} icon={<Wrench className="h-4 w-4 text-amber-600" />} tone="bg-amber-50" />
          <KpiCard label="Notifications" value={s?.notificationsUnread ?? 0} icon={<Bell className="h-4 w-4 text-green-600" />} tone="bg-green-50" onClick={() => navigate('/notifications')} />
        </div>
      )}

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Recent Notifications</h2>
          <button onClick={() => navigate('/notifications')} className="text-xs font-medium text-indigo-600 hover:underline">View all</button>
        </div>
        {isLoading ? (
          <div className="py-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-300" /></div>
        ) : recent.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">No notifications.</p>
        ) : (
          <div className="space-y-3">
            {recent.map((n) => (
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
    </div>
  );
}
