const STYLES: Record<string, string> = {
  MAIN: 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600/20',
  SUB: 'bg-sky-50 text-sky-700 ring-1 ring-sky-600/20',
  OTHER: 'bg-slate-100 text-slate-500 ring-1 ring-slate-400/20',
};

/** Badge for an ONVIF stream profile type (MAIN/SUB/OTHER). */
export default function StreamTypeBadge({ streamType }: { streamType?: string }) {
  const type = streamType ?? 'OTHER';
  const style = STYLES[type] || STYLES.OTHER;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${style}`}>
      {type}
    </span>
  );
}
