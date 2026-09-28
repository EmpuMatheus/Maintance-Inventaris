const STATUS_STYLES: Record<string, string> = {
  ONLINE: 'bg-green-50 text-green-700 ring-1 ring-green-600/20',
  OFFLINE: 'bg-red-50 text-red-700 ring-1 ring-red-600/20',
  UNKNOWN: 'bg-slate-100 text-slate-500 ring-1 ring-slate-400/20',
  MISSING: 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/20',
};

/** Status badge for a CCTV channel, including the MISSING sync state. */
export default function CctvChannelStatusBadge({ status }: { status?: string }) {
  const style = STATUS_STYLES[status ?? ''] || STATUS_STYLES.UNKNOWN;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${style}`}>
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
      {status || 'UNKNOWN'}
    </span>
  );
}
