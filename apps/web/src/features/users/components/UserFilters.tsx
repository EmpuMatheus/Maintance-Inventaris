import { useQuery } from '@tanstack/react-query';
import { RotateCcw, Search } from 'lucide-react';
import { listMaster } from '@/features/inventory/api/inventory';
import type { UserFilters } from '../types';

function selectClass() {
  return 'rounded-lg border border-slate-300 px-3 py-2 text-sm';
}

export default function UserFilters({
  value,
  onChange,
  onReset,
}: {
  value: UserFilters;
  onChange: (patch: Partial<UserFilters>) => void;
  onReset: () => void;
}) {
  const { data: departments } = useQuery({ queryKey: ['master', 'departments'], queryFn: () => listMaster('departments') });
  const depts = ((departments as unknown as { data?: { id: string; name: string; code?: string }[] })?.data ?? []) as { id: string; name: string; code?: string }[];

  return (
    <div className="mb-4 grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search name, username, email..."
          value={value.search ?? ''}
          onChange={(e) => onChange({ search: e.target.value || undefined, page: 1 })}
          className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>
      <select value={value.departmentId ?? ''} onChange={(e) => onChange({ departmentId: e.target.value || undefined, page: 1 })} className={selectClass()}>
        <option value="">All Departments</option>
        {depts.map((d) => <option key={d.id} value={d.id}>{d.code ? `${d.code} - ${d.name}` : d.name}</option>)}
      </select>
      <select value={value.isActive === undefined ? '' : String(value.isActive)} onChange={(e) => onChange({ isActive: e.target.value ? e.target.value === 'true' : undefined, page: 1 })} className={selectClass()}>
        <option value="">All Statuses</option>
        <option value="true">Active</option>
        <option value="false">Inactive</option>
      </select>
      <button onClick={onReset} className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
        <RotateCcw className="h-3.5 w-3.5" /> Reset Filters
      </button>
    </div>
  );
}
