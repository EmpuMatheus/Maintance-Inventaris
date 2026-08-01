import { useQuery } from '@tanstack/react-query';
import { RotateCcw, Search } from 'lucide-react';
import { listMaster } from '@/features/inventory/api/inventory';
import DateRangePicker from './DateRangePicker';

export type ReportFilterField =
  | { key: string; label: string; type: 'search' }
  | { key: string; label: string; type: 'select'; options: { value: string; label: string }[] }
  | { key: string; label: string; type: 'master'; resource: string }
  | { key: string; label: string; type: 'condition' }
  | { key: string; label: string; type: 'status' }
  | { key: string; label: string; type: 'priority' }
  | { key: string; label: string; type: 'location' }
  | { key: string; label: string; type: 'date'; key2: string }
  | { key: string; label: string; type: 'dateRange' };

const CONDITIONS = ['GOOD', 'FAIR', 'NEED_ATTENTION', 'BROKEN', 'CRITICAL', 'RETIRED'];
const STATUSES = ['AVAILABLE', 'ASSIGNED', 'IN_USE', 'IN_MAINTENANCE', 'BROKEN', 'SPARE', 'LOST', 'RETIRED', 'DISPOSED'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

function selectClass() {
  return 'rounded-lg border border-slate-300 px-3 py-2 text-sm';
}

interface ReportFiltersProps {
  fields: ReportFilterField[];
  value: Record<string, string | undefined>;
  onChange: (patch: Record<string, string | undefined>) => void;
  onReset: () => void;
}

export default function ReportFilters({ fields, value, onChange, onReset }: ReportFiltersProps) {
  const { data: categories } = useQuery({ queryKey: ['master', 'categories'], queryFn: () => listMaster('categories') });
  const { data: departments } = useQuery({ queryKey: ['master', 'departments'], queryFn: () => listMaster('departments') });
  const { data: vendors } = useQuery({ queryKey: ['master', 'vendors'], queryFn: () => listMaster('vendors') });
  const { data: types } = useQuery({ queryKey: ['master', 'maintenance-types'], queryFn: () => listMaster('maintenance-types') });
  const { data: users } = useQuery({ queryKey: ['master', 'users'], queryFn: () => listMaster('users', {}) });
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

  const masterOptions = (resource: string): { value: string; label: string }[] => {
    if (resource === 'categories') return rows(categories).map((r) => ({ value: r.id, label: r.code ? `${r.code} - ${r.name}` : r.name }));
    if (resource === 'departments') return rows(departments).map((r) => ({ value: r.id, label: r.code ? `${r.code} - ${r.name}` : r.name }));
    if (resource === 'vendors') return rows(vendors).map((r) => ({ value: r.id, label: r.code ? `${r.code} - ${r.name}` : r.name }));
    if (resource === 'maintenance-types') return rows(types).map((r) => ({ value: r.id, label: r.name }));
    if (resource === 'users') return rows(users).map((r) => ({ value: r.id, label: r.name }));
    return [];
  };

  const set = (patch: Record<string, string | undefined>) => {
    const next = { ...patch };
    if ('siteId' in patch && patch.siteId !== value.siteId) next.buildingId = next.floorId = next.roomId = undefined;
    if ('buildingId' in patch && patch.buildingId !== value.buildingId) next.floorId = next.roomId = undefined;
    if ('floorId' in patch && patch.floorId !== value.floorId) next.roomId = undefined;
    onChange({ ...next, page: undefined });
  };

  const renderField = (field: ReportFilterField) => {
    switch (field.type) {
      case 'search':
        return (
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={field.label}
              value={value[field.key] ?? ''}
              onChange={(e) => set({ [field.key]: e.target.value || undefined })}
              className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        );
      case 'select':
        return (
          <select value={value[field.key] ?? ''} onChange={(e) => set({ [field.key]: e.target.value || undefined })} className={selectClass()}>
            <option value="">{field.label}</option>
            {field.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        );
      case 'master':
        return (
          <select value={value[field.key] ?? ''} onChange={(e) => set({ [field.key]: e.target.value || undefined })} className={selectClass()}>
            <option value="">{field.label}</option>
            {masterOptions(field.resource).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        );
      case 'condition':
        return (
          <select value={value[field.key] ?? ''} onChange={(e) => set({ [field.key]: e.target.value || undefined })} className={selectClass()}>
            <option value="">All Conditions</option>
            {CONDITIONS.map((c) => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
          </select>
        );
      case 'status':
        return (
          <select value={value[field.key] ?? ''} onChange={(e) => set({ [field.key]: e.target.value || undefined })} className={selectClass()}>
            <option value="">All Statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
        );
      case 'priority':
        return (
          <select value={value[field.key] ?? ''} onChange={(e) => set({ [field.key]: e.target.value || undefined })} className={selectClass()}>
            <option value="">All Priorities</option>
            {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        );
      case 'date':
        return (
          <input type="date" value={value[field.key] ?? ''} onChange={(e) => set({ [field.key]: e.target.value || undefined })} className={`${selectClass()} w-full`} title={field.label} />
        );
      case 'dateRange':
        return (
          <DateRangePicker
            from={value.dateFrom}
            to={value.dateTo}
            onFrom={(v) => set({ dateFrom: v })}
            onTo={(v) => set({ dateTo: v })}
          />
        );
      case 'location':
        return (
          <>
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
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div className="mb-4 rounded-lg border border-slate-200 bg-white p-3">
      <div className="grid grid-cols-1 items-center gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {fields.map((field) => (
          <div key={`${field.type}-${field.key}`} className={field.type === 'location' ? 'contents' : undefined}>
            {renderField(field)}
          </div>
        ))}
        <button onClick={onReset} className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
          <RotateCcw className="h-3.5 w-3.5" /> Reset Filters
        </button>
      </div>
    </div>
  );
}
