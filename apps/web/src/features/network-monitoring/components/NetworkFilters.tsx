import { Search, X } from 'lucide-react';
import type { NetworkMonitoringFilters } from '../types';

const STATUS_OPTIONS = ['ONLINE', 'OFFLINE', 'UNKNOWN'];
const TYPE_OPTIONS = ['COMPUTER', 'SWITCH'];

export interface RoomOption {
  id: string;
  name: string;
}

interface NetworkFiltersProps {
  value: NetworkMonitoringFilters;
  rooms: RoomOption[];
  onChange: (patch: Partial<NetworkMonitoringFilters>) => void;
  onReset: () => void;
}

const inputClass =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500';

export default function NetworkFilters({ value, rooms, onChange, onReset }: NetworkFiltersProps) {
  const hasFilters =
    value.search || value.status || value.deviceType || value.roomId || value.from || value.to;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <div className="relative lg:col-span-2">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search device, IP..."
            value={value.search}
            onChange={(e) => onChange({ search: e.target.value })}
            className={`${inputClass} pl-10`}
          />
        </div>
        <select value={value.status} onChange={(e) => onChange({ status: e.target.value })} className={inputClass}>
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select value={value.deviceType} onChange={(e) => onChange({ deviceType: e.target.value })} className={inputClass}>
          <option value="">All Types</option>
          {TYPE_OPTIONS.map((t) => (
            <option key={t} value={t}>
              {t.charAt(0) + t.slice(1).toLowerCase()}
            </option>
          ))}
        </select>
        <select value={value.roomId} onChange={(e) => onChange({ roomId: e.target.value })} className={inputClass}>
          <option value="">All Rooms</option>
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          <input
            type="date"
            aria-label="From date"
            value={value.from ? value.from.slice(0, 10) : ''}
            onChange={(e) => onChange({ from: e.target.value ? new Date(e.target.value).toISOString() : '' })}
            className={inputClass}
          />
          <input
            type="date"
            aria-label="To date"
            value={value.to ? value.to.slice(0, 10) : ''}
            onChange={(e) => {
              if (!e.target.value) {
                onChange({ to: '' });
                return;
              }
              // Iterate the ISO string so `to` covers the whole selected local day.
              const end = new Date(e.target.value);
              end.setHours(23, 59, 59, 999);
              onChange({ to: end.toISOString() });
            }}
            className={inputClass}
          />
        </div>
      </div>

      {hasFilters && (
        <div className="mt-3 flex justify-end">
          <button
            onClick={onReset}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            <X className="h-3.5 w-3.5" /> Clear Filters
          </button>
        </div>
      )}
    </div>
  );
}
