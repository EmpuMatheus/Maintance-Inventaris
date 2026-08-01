import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { listMaintenance, maintenanceKeys, type MaintenanceFilters } from '../api/maintenance';
import { listMaster } from '@/features/inventory/api/inventory';
import MaintenanceTable from '../components/MaintenanceTable';
import type { MaintenanceListItem } from '../types';

const STATUS_OPTIONS = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_PART', 'TESTING', 'COMPLETED', 'CANCELLED'];
const PRIORITY_OPTIONS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export default function MaintenanceListPage() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [typeId, setTypeId] = useState('');
  const [technicianId, setTechnicianId] = useState('');

  const filters: MaintenanceFilters = {
    page,
    search: search || undefined,
    status: status || undefined,
    priority: priority || undefined,
    typeId: typeId || undefined,
    technicianId: technicianId || undefined,
  };

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: maintenanceKeys.list(filters),
    queryFn: () => listMaintenance(filters),
  });

  const { data: types } = useQuery({
    queryKey: ['master', 'maintenance-types'],
    queryFn: () => listMaster('maintenance-types'),
  });

  const { data: users } = useQuery({
    queryKey: ['master', 'users'],
    queryFn: () => listMaster('users', {}),
  });

  const resetPage = () => setPage(1);

  const moreActions = (m: MaintenanceListItem) => {
    const items: { label: string; onClick: () => void }[] = [];
    if (m.status === 'OPEN' && can('maintenance.update')) {
      items.push({ label: 'Assign Technician', onClick: () => navigate(`/maintenance/${m.id}`) });
    }
    if (m.status === 'ASSIGNED' && can('maintenance.update')) {
      items.push({ label: 'Start Maintenance', onClick: () => navigate(`/maintenance/${m.id}`) });
    }
    if ((m.status === 'IN_PROGRESS' || m.status === 'TESTING') && can('maintenance.complete')) {
      items.push({ label: 'Complete', onClick: () => navigate(`/maintenance/${m.id}`) });
    }
    if (
      ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_PART', 'TESTING'].includes(m.status) &&
      can('maintenance.cancel')
    ) {
      items.push({ label: 'Cancel', onClick: () => navigate(`/maintenance/${m.id}`) });
    }
    return items;
  };

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Maintenance</h1>
          <p className="mt-1 text-sm text-slate-500">Track maintenance activities and schedules.</p>
        </div>
        {can('maintenance.create') && (
          <button
            onClick={() => navigate('/maintenance/new')}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" /> Create Maintenance
          </button>
        )}
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="relative sm:col-span-2">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search code or problem..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); resetPage(); }}
            className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <select value={status} onChange={(e) => { setStatus(e.target.value); resetPage(); }} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
        <select value={priority} onChange={(e) => { setPriority(e.target.value); resetPage(); }} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="">All Priorities</option>
          {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{p.charAt(0) + p.slice(1).toLowerCase()}</option>)}
        </select>
        <select value={technicianId} onChange={(e) => { setTechnicianId(e.target.value); resetPage(); }} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="">All Technicians</option>
          {users?.data?.map((u: { id: string; name: string }) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Type</span>
        <button
          onClick={() => { setTypeId(''); resetPage(); }}
          className={`rounded-full px-3 py-1 text-xs font-medium ${typeId === '' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
        >
          All
        </button>
        {types?.data?.map((t: { id: string; name: string }) => (
          <button
            key={t.id}
            onClick={() => { setTypeId(t.id); resetPage(); }}
            className={`rounded-full px-3 py-1 text-xs font-medium ${typeId === t.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            {t.name}
          </button>
        ))}
      </div>

      <MaintenanceTable
        data={data?.data ?? []}
        isLoading={isLoading}
        isError={isError}
        errorMessage={(error as Error)?.message}
        onRetry={() => refetch()}
        page={page}
        meta={data?.meta}
        onPageChange={setPage}
        onView={(id) => navigate(`/maintenance/${id}`)}
        onEdit={(id) => navigate(`/maintenance/${id}`)}
        canUpdate={can('maintenance.update')}
        moreActions={moreActions}
      />
    </div>
  );
}
