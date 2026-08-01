import { useQuery } from '@tanstack/react-query';
import { RotateCcw, Search } from 'lucide-react';
import DateRangePicker from '@/features/reports/components/DateRangePicker';
import { getAuditModules, getAuditActions } from '../api/audit';
import type { AuditFilters } from '../types';

function selectClass() {
  return 'rounded-lg border border-slate-300 px-3 py-2 text-sm';
}

export default function AuditFilters({
  value,
  onChange,
  onReset,
}: {
  value: AuditFilters;
  onChange: (patch: Partial<AuditFilters>) => void;
  onReset: () => void;
}) {
  const { data: modules } = useQuery({ queryKey: ['audit', 'modules'], queryFn: getAuditModules });
  const { data: actions } = useQuery({ queryKey: ['audit', 'actions'], queryFn: getAuditActions });

  return (
    <div className="mb-4 space-y-3 rounded-lg border border-slate-200 bg-white p-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative lg:col-span-2">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search audit code, description, entity..."
            value={value.search ?? ''}
            onChange={(e) => onChange({ search: e.target.value || undefined, page: 1 })}
            className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <select value={value.module ?? ''} onChange={(e) => onChange({ module: e.target.value || undefined, page: 1 })} className={selectClass()}>
          <option value="">All Modules</option>
          {modules?.data?.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={value.action ?? ''} onChange={(e) => onChange({ action: e.target.value || undefined, page: 1 })} className={selectClass()}>
          <option value="">All Actions</option>
          {actions?.data?.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <input
          type="text"
          placeholder="Entity type (asset, user, ...)"
          value={value.entity ?? ''}
          onChange={(e) => onChange({ entity: e.target.value || undefined, page: 1 })}
          className={selectClass()}
        />
        <DateRangePicker
          from={value.dateFrom}
          to={value.dateTo}
          onFrom={(v) => onChange({ dateFrom: v, page: 1 })}
          onTo={(v) => onChange({ dateTo: v, page: 1 })}
        />
        <button onClick={onReset} className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
          <RotateCcw className="h-3.5 w-3.5" /> Reset Filters
        </button>
      </div>
    </div>
  );
}
