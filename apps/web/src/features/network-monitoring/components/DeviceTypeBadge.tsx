const PALETTE = [
  'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600/20',
  'bg-cyan-50 text-cyan-700 ring-1 ring-cyan-600/20',
  'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20',
  'bg-amber-50 text-amber-700 ring-1 ring-amber-600/20',
  'bg-rose-50 text-rose-700 ring-1 ring-rose-600/20',
  'bg-violet-50 text-violet-700 ring-1 ring-violet-600/20',
];

function styleFor(deviceType: string): string {
  let hash = 0;
  for (let i = 0; i < deviceType.length; i += 1) {
    hash = (hash * 31 + deviceType.charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}

/**
 * Device Type is the Asset subcategory name (e.g. "Laptop", "Switch"), so the
 * badge renders whatever name it is given with a stable colour derived from it.
 */
export default function DeviceTypeBadge({ deviceType }: { deviceType?: string }) {
  const label = deviceType?.trim() || '-';
  const style = label === '-' ? 'bg-slate-100 text-slate-600 ring-1 ring-slate-400/20' : styleFor(label);
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${style}`}>{label}</span>
  );
}
