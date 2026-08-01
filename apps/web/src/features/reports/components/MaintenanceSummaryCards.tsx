import { AlertTriangle, CheckCircle2, Clock, ListChecks, Package, Wrench, XCircle } from 'lucide-react';
import type { MaintenanceReportSummary } from '../types';

const CARDS = [
  { key: 'total', label: 'Total Maintenance', icon: <Package className="h-4 w-4" />, tone: 'bg-indigo-50 text-indigo-600' },
  { key: 'scheduled', label: 'Scheduled', icon: <Clock className="h-4 w-4" />, tone: 'bg-blue-50 text-blue-600' },
  { key: 'inProgress', label: 'In Progress', icon: <Wrench className="h-4 w-4" />, tone: 'bg-amber-50 text-amber-600' },
  { key: 'completed', label: 'Completed', icon: <CheckCircle2 className="h-4 w-4" />, tone: 'bg-green-50 text-green-600' },
  { key: 'cancelled', label: 'Cancelled', icon: <XCircle className="h-4 w-4" />, tone: 'bg-slate-100 text-slate-600' },
  { key: 'overdue', label: 'Overdue', icon: <AlertTriangle className="h-4 w-4" />, tone: 'bg-red-50 text-red-600' },
] as const;

function hoursLabel(hours?: number): string {
  if (hours == null) return '0';
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  return `${hours}h`;
}

export default function MaintenanceSummaryCards({ summary }: { summary?: MaintenanceReportSummary }) {
  return (
    <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
      {CARDS.map((card) => (
        <div key={card.key} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">{card.label}</span>
            <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${card.tone}`}>{card.icon}</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{summary?.[card.key] ?? 0}</p>
        </div>
      ))}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Avg Resolution</span>
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 text-violet-600"><ListChecks className="h-4 w-4" /></span>
        </div>
        <p className="text-2xl font-bold text-slate-900">{hoursLabel(summary?.averageResolutionHours)}</p>
      </div>
    </div>
  );
}
