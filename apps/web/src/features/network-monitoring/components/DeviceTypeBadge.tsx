const TYPE_LABELS: Record<string, string> = {
  COMPUTER: 'Computer',
  SWITCH: 'Switch',
};

const TYPE_STYLES: Record<string, string> = {
  COMPUTER: 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600/20',
  SWITCH: 'bg-cyan-50 text-cyan-700 ring-1 ring-cyan-600/20',
};

export default function DeviceTypeBadge({ deviceType }: { deviceType?: string }) {
  const label = TYPE_LABELS[deviceType ?? ''] ?? deviceType ?? '-';
  const style = TYPE_STYLES[deviceType ?? ''] ?? 'bg-slate-100 text-slate-600 ring-1 ring-slate-400/20';
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${style}`}>{label}</span>
  );
}
