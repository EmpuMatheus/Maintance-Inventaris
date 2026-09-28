export default function ActiveStatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${
        isActive
          ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20'
          : 'bg-slate-100 text-slate-500 ring-1 ring-slate-400/20'
      }`}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
      {isActive ? 'ACTIVE' : 'INACTIVE'}
    </span>
  );
}
