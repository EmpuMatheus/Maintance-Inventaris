const PRIORITY_STYLES: Record<string, string> = {
  LOW: 'bg-slate-50 text-slate-600 ring-1 ring-slate-400/20',
  MEDIUM: 'bg-blue-50 text-blue-700 ring-1 ring-blue-600/20',
  HIGH: 'bg-orange-50 text-orange-700 ring-1 ring-orange-600/20',
  CRITICAL: 'bg-red-100 text-red-800 ring-1 ring-red-600/30',
};

export default function PriorityBadge({ priority, size = 'sm' }: { priority?: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = size === 'lg' ? 'px-3 py-1.5 text-sm' : size === 'md' ? 'px-2.5 py-1 text-xs' : 'px-2 py-0.5 text-xs';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-medium ${PRIORITY_STYLES[priority ?? ''] || 'bg-slate-100 text-slate-600 ring-1 ring-slate-400/20'} ${sizeClasses}`}>
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
      {priority || '-'}
    </span>
  );
}
