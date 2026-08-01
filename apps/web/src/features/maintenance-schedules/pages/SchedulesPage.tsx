import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { CalendarDays, Loader2, Plus, Search } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { listSchedules, setScheduleStatus, scheduleKeys } from '../api/schedules';
import { SCHEDULE_FREQUENCY_LABELS } from '../components/schedule-constants';
import ScheduleStateBadge from '../components/ScheduleStateBadge';
import ScheduleFormModal from '../components/ScheduleFormModal';
import type { MaintenanceSchedule } from '../types';

function formatDate(value?: string | null): string {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function SchedulesPage() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: scheduleKeys.list({ page, search: search || undefined }),
    queryFn: () => listSchedules({ page, search: search || undefined }),
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => setScheduleStatus(id, isActive),
    onSuccess: () => {
      toast.success('Schedule updated.');
      queryClient.invalidateQueries({ queryKey: scheduleKeys.all });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Maintenance Schedules</h1>
          <p className="mt-1 text-sm text-slate-500">Preventive maintenance schedules for company assets.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/maintenance/calendar')}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <CalendarDays className="h-4 w-4" /> Calendar
          </button>
          {can('maintenance.create') && (
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" /> New Schedule
            </button>
          )}
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by asset code or name..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      <div className="hidden overflow-x-auto rounded-lg border border-slate-200 bg-white md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="px-4 py-3 font-medium text-slate-600">Asset</th>
              <th className="px-4 py-3 font-medium text-slate-600">Type</th>
              <th className="px-4 py-3 font-medium text-slate-600">Frequency</th>
              <th className="px-4 py-3 font-medium text-slate-600">Next Due</th>
              <th className="px-4 py-3 font-medium text-slate-600">Last Maintenance</th>
              <th className="px-4 py-3 font-medium text-slate-600">Status</th>
              <th className="px-4 py-3 font-medium text-slate-600">Active</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && <tr><td colSpan={7} className="px-4 py-16 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-400" /></td></tr>}
            {isError && (
              <tr><td colSpan={7} className="px-4 py-16 text-center">
                <p className="mb-2 text-sm text-red-500">{(error as Error)?.message || 'Unable to load schedules.'}</p>
                <button onClick={() => refetch()} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">Try Again</button>
              </td></tr>
            )}
            {!isLoading && !isError && (!data?.data || data.data.length === 0) && (
              <tr><td colSpan={7} className="px-4 py-16 text-center">
                <p className="text-sm font-medium text-slate-500">No maintenance schedules found.</p>
                <p className="mt-1 text-xs text-slate-400">Create a schedule to start preventive maintenance.</p>
              </td></tr>
            )}
            {!isLoading && !isError && data?.data?.map((s: MaintenanceSchedule) => (
              <tr key={s.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-900">{s.asset?.assetName || '-'}</p>
                  <p className="font-mono text-xs text-slate-400">{s.asset?.assetCode || ''}</p>
                </td>
                <td className="px-4 py-3 text-slate-600">{s.maintenanceType?.name || '-'}</td>
                <td className="px-4 py-3 text-slate-600">
                  {SCHEDULE_FREQUENCY_LABELS[s.frequencyType as keyof typeof SCHEDULE_FREQUENCY_LABELS] || s.frequencyType}
                  {s.frequencyValue > 1 ? ` × ${s.frequencyValue}` : ''}
                </td>
                <td className="px-4 py-3 text-slate-700">{formatDate(s.nextMaintenanceDate)}</td>
                <td className="px-4 py-3 text-slate-500">{formatDate(s.lastMaintenanceDate)}</td>
                <td className="px-4 py-3"><ScheduleStateBadge state={s.state} isActive={s.isActive} /></td>
                <td className="px-4 py-3">
                  {can('maintenance.update') ? (
                    <button
                      onClick={() => toggleActive.mutate({ id: s.id, isActive: !s.isActive })}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${s.isActive ? 'bg-green-500' : 'bg-slate-300'}`}
                      title={s.isActive ? 'Deactivate' : 'Activate'}
                    >
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${s.isActive ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                  ) : (
                    <span className="text-xs text-slate-400">{s.isActive ? 'Active' : 'Inactive'}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {isLoading && <div className="rounded-lg border border-slate-200 bg-white p-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-400" /></div>}
        {isError && (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
            <p className="mb-2 text-sm text-red-500">{(error as Error)?.message || 'Unable to load schedules.'}</p>
            <button onClick={() => refetch()} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">Try Again</button>
          </div>
        )}
        {!isLoading && !isError && (!data?.data || data.data.length === 0) && (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
            <p className="text-sm font-medium text-slate-500">No maintenance schedules found.</p>
            <p className="mt-1 text-xs text-slate-400">Create a schedule to start preventive maintenance.</p>
          </div>
        )}
        {!isLoading && !isError && data?.data?.map((s: MaintenanceSchedule) => (
          <div key={s.id} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-1 flex items-center justify-between">
              <span className="font-mono text-xs text-slate-400">{s.asset?.assetCode}</span>
              <ScheduleStateBadge state={s.state} isActive={s.isActive} />
            </div>
            <p className="mb-2 font-medium text-slate-900">{s.asset?.assetName}</p>
            <div className="mb-3 space-y-1 text-xs text-slate-500">
              <p>Type: {s.maintenanceType?.name || '-'} · {SCHEDULE_FREQUENCY_LABELS[s.frequencyType as keyof typeof SCHEDULE_FREQUENCY_LABELS] || s.frequencyType}</p>
              <p>Next due: {formatDate(s.nextMaintenanceDate)} · Last: {formatDate(s.lastMaintenanceDate)}</p>
            </div>
            {can('maintenance.update') && (
              <button
                onClick={() => toggleActive.mutate({ id: s.id, isActive: !s.isActive })}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                {s.isActive ? 'Deactivate' : 'Activate'}
              </button>
            )}
          </div>
        ))}
      </div>

      {showCreate && <ScheduleFormModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}
