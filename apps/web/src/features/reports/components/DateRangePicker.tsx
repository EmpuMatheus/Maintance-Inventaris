function selectClass() {
  return 'rounded-lg border border-slate-300 px-3 py-2 text-sm';
}

export default function DateRangePicker({
  from,
  to,
  onFrom,
  onTo,
}: {
  from?: string;
  to?: string;
  onFrom: (value?: string) => void;
  onTo: (value?: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <input type="date" value={from ?? ''} onChange={(e) => onFrom(e.target.value || undefined)} className={`${selectClass()} w-full`} title="From" />
      <span className="text-xs text-slate-400">to</span>
      <input type="date" value={to ?? ''} onChange={(e) => onTo(e.target.value || undefined)} className={`${selectClass()} w-full`} title="To" />
    </div>
  );
}
