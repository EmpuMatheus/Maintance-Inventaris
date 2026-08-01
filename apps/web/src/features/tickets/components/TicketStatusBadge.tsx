const STATUS_STYLES: Record<string, string> = {
  OPEN: 'bg-blue-50 text-blue-700 ring-1 ring-blue-600/20',
  ASSIGNED: 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600/20',
  IN_PROGRESS: 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/20',
  ON_HOLD: 'bg-orange-50 text-orange-700 ring-1 ring-orange-600/20',
  RESOLVED: 'bg-green-50 text-green-700 ring-1 ring-green-600/20',
  CLOSED: 'bg-slate-100 text-slate-600 ring-1 ring-slate-400/20',
  CANCELLED: 'bg-slate-100 text-slate-500 ring-1 ring-slate-400/20',
};

export default function TicketStatusBadge({ status, size = 'sm' }: { status?: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = size === 'lg' ? 'px-3 py-1.5 text-sm' : size === 'md' ? 'px-2.5 py-1 text-xs' : 'px-2 py-0.5 text-xs';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-medium ${STATUS_STYLES[status ?? ''] || 'bg-slate-100 text-slate-600 ring-1 ring-slate-400/20'} ${sizeClasses}`}>
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
      {status?.replace(/_/g, ' ') || '-'}
    </span>
  );
}
