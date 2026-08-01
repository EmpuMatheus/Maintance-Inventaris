import { Activity, CalendarClock, Package } from 'lucide-react';
import type { AuditSummary } from '../types';

export default function AuditSummaryCards({ summary }: { summary?: AuditSummary }) {
  return (
    <div className="mb-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Total Events</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600"><Package className="h-4 w-4" /></span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{summary?.total ?? 0}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Today</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><CalendarClock className="h-4 w-4" /></span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{summary?.today ?? 0}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Top Module</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 text-violet-600"><Activity className="h-4 w-4" /></span>
          </div>
          <p className="truncate text-lg font-bold text-slate-900">{summary?.byModule[0]?.name ?? '-'}</p>
          <p className="text-xs text-slate-400">{summary?.byModule[0]?.value ?? 0} events</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Top Action</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600"><Activity className="h-4 w-4" /></span>
          </div>
          <p className="truncate text-lg font-bold text-slate-900">{summary?.byAction[0]?.name ?? '-'}</p>
          <p className="text-xs text-slate-400">{summary?.byAction[0]?.value ?? 0} events</p>
        </div>
      </div>
    </div>
  );
}
