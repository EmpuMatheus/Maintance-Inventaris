const CONDITION_STYLES: Record<string, string> = {
  GOOD: 'bg-green-50 text-green-700 ring-1 ring-green-600/20',
  FAIR: 'bg-yellow-50 text-yellow-700 ring-1 ring-yellow-600/20',
  NEED_ATTENTION: 'bg-orange-50 text-orange-700 ring-1 ring-orange-600/20',
  BROKEN: 'bg-red-50 text-red-700 ring-1 ring-red-600/20',
  CRITICAL: 'bg-red-100 text-red-800 ring-1 ring-red-600/30',
  RETIRED: 'bg-slate-100 text-slate-500 ring-1 ring-slate-400/20',
};

export default function ConditionBadge({ condition, size = 'sm' }: { condition?: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = size === 'lg' ? 'px-3 py-1.5 text-sm' : size === 'md' ? 'px-2.5 py-1 text-xs' : 'px-2 py-0.5 text-xs';
  return (
    <span className={`inline-flex rounded-full font-medium ${CONDITION_STYLES[condition ?? ''] || 'bg-slate-100 text-slate-600 ring-1 ring-slate-400/20'} ${sizeClasses}`}>
      {condition?.replace(/_/g, ' ') || '-'}
    </span>
  );
}
