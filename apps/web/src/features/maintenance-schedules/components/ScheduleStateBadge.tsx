import type { ScheduleState } from '../types';

const STATE_STYLES: Record<string, string> = {
  UPCOMING: 'bg-blue-50 text-blue-700 ring-1 ring-blue-600/20',
  DUE_TODAY: 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/20',
  OVERDUE: 'bg-red-50 text-red-700 ring-1 ring-red-600/20',
  COMPLETED: 'bg-green-50 text-green-700 ring-1 ring-green-600/20',
  INACTIVE: 'bg-slate-100 text-slate-500 ring-1 ring-slate-400/20',
};

export default function ScheduleStateBadge({ state, isActive }: { state?: ScheduleState; isActive?: boolean }) {
  const label = isActive === false ? 'INACTIVE' : (state ?? 'UPCOMING');
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${STATE_STYLES[label] || STATE_STYLES.UPCOMING}`}>
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
      {label.replace(/_/g, ' ')}
    </span>
  );
}
