import { useQuery } from '@tanstack/react-query';
import { RotateCcw, Search } from 'lucide-react';
import { listMaster } from '@/features/inventory/api/inventory';
import type { MaintenanceCostFilters } from '../types';

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const STATUSES = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_PART', 'TESTING', 'COMPLETED', 'CANCELLED'];

function selectClass() {
  return 'rounded-lg border border-slate-300 px-3 py-2 text-sm';
}

interface MaintenanceCostFiltersProps {
  value: MaintenanceCostFilters;
  onChange: (patch: Partial<MaintenanceCostFilters>) => void;
  onReset: () => void;
}

export default function MaintenanceCostFilters({ value, onChange, onReset }: MaintenanceCostFiltersProps) {
  const { data: categories } = useQuery({ queryKey: ['master', 'categories'], queryFn: () => listMaster('categories') });
  const { data: vendors } = useQuery({ queryKey: ['master', 'vendors'], queryFn: () => listMaster('vendors') });
  const { data: departments } = useQuery({ queryKey: ['master', 'departments'], queryFn: () => listMaster('departments') });
  const { data: types } = useQuery({ queryKey: ['master', 'maintenance-types'], queryFn: () => listMaster('maintenance-types') });
  const { data: sites } = useQuery({ queryKey: ['master', 'sites'], queryFn: () => listMaster('sites') });
  const { data: buildings } = useQuery({
    queryKey: ['master', 'buildings', value.siteId],
    queryFn: () => listMaster('buildings', { siteId: value.siteId }),
    enabled: !!value.siteId,
  });
  const { data: floors } = useQuery({
    queryKey: ['master', 'floors', value.buildingId],
    queryFn: () => listMaster('floors', { buildingId: value.buildingId }),
    enabled: !!value.buildingId,
  });
  const { data: rooms } = useQuery({
    queryKey: ['master', 'rooms', value.floorId],
    queryFn: () => listMaster('rooms', { floorId: value.floorId }),
    enabled: !!value.floorId,
  });

  const rows = (d?: unknown) => ((d as { data?: { id: string; name: string; code?: string }[] })?.data ?? []) as { id: string; name: string; code?: string }[];

  const set = (patch: Partial<MaintenanceCostFilters>) => {
    if ('siteId' in patch && patch.siteId !== value.siteId) patch.buildingId = patch.floorId = patch.roomId = undefined;
    if ('buildingId' in patch && patch.buildingId !== value.buildingId) patch.floorId = patch.roomId = undefined;
    if ('floorId' in patch && patch.floorId !== value.floorId) patch.roomId = undefined;
    onChange({ ...patch, page: 1 });
  };

  return (
    <div className="mb-4 space-y-3 rounded-lg border border-slate-200 bg-white p-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative lg:col-span-2">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search code, asset..."
            value={value.keyword ?? ''}
            onChange={(e) => set({ keyword: e.target.value })}
            className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <select value={value.categoryId ?? ''} onChange={(e) => set({ categoryId: e.target.value || undefined })} className={selectClass()}>
          <option value="">All Categories</option>
          {rows(categories).map((r) => <option key={r.id} value={r.id}>{r.code} - {r.name}</option>)}
        </select>
        <select value={value.vendorId ?? ''} onChange={(e) => set({ vendorId: e.target.value || undefined })} className={selectClass()}>
          <option value="">All Vendors</option>
          {rows(vendors).map((r) => <option key={r.id} value={r.id}>{r.code} - {r.name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <select value={value.departmentId ?? ''} onChange={(e) => set({ departmentId: e.target.value || undefined })} className={selectClass()}>
          <option value="">All Departments</option>
          {rows(departments).map((r) => <option key={r.id} value={r.id}>{r.code} - {r.name}</option>)}
        </select>
        <select value={value.maintenanceTypeId ?? ''} onChange={(e) => set({ maintenanceTypeId: e.target.value || undefined })} className={selectClass()}>
          <option value="">All Types</option>
          {rows(types).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <select value={value.priority ?? ''} onChange={(e) => set({ priority: e.target.value || undefined })} className={selectClass()}>
          <option value="">All Priorities</option>
          {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={value.status ?? ''} onChange={(e) => set({ status: e.target.value || undefined })} className={selectClass()}>
          <option value="">All Statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <select value={value.siteId ?? ''} onChange={(e) => set({ siteId: e.target.value || undefined })} className={selectClass()}>
          <option value="">All Sites</option>
          {rows(sites).map((r) => <option key={r.id} value={r.id}>{r.code} - {r.name}</option>)}
        </select>
        <select value={value.buildingId ?? ''} onChange={(e) => set({ buildingId: e.target.value || undefined })} disabled={!value.siteId} className={`${selectClass()} disabled:bg-slate-50`}>
          <option value="">All Buildings</option>
          {rows(buildings).map((r) => <option key={r.id} value={r.id}>{r.code} - {r.name}</option>)}
        </select>
        <select value={value.floorId ?? ''} onChange={(e) => set({ floorId: e.target.value || undefined })} disabled={!value.buildingId} className={`${selectClass()} disabled:bg-slate-50`}>
          <option value="">All Floors</option>
          {rows(floors).map((r) => <option key={r.id} value={r.id}>{r.code} - {r.name}</option>)}
        </select>
        <select value={value.roomId ?? ''} onChange={(e) => set({ roomId: e.target.value || undefined })} disabled={!value.floorId} className={`${selectClass()} disabled:bg-slate-50`}>
          <option value="">All Rooms</option>
          {rows(rooms).map((r) => <option key={r.id} value={r.id}>{r.code} - {r.name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex items-center gap-2 lg:col-span-2">
          <input
            type="date"
            value={value.startDate ?? ''}
            onChange={(e) => set({ startDate: e.target.value || undefined })}
            className={`${selectClass()} w-full`}
            title="Start date"
          />
          <span className="text-xs text-slate-400">to</span>
          <input
            type="date"
            value={value.endDate ?? ''}
            onChange={(e) => set({ endDate: e.target.value || undefined })}
            className={`${selectClass()} w-full`}
            title="End date"
          />
        </div>
        <div className="sm:col-span-2 lg:col-span-1">
          <button onClick={onReset} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
            <RotateCcw className="h-3.5 w-3.5" /> Reset Filters
          </button>
        </div>
      </div>
    </div>
  );
}
