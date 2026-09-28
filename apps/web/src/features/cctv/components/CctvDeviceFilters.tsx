import { RotateCcw, Search } from 'lucide-react';
import type { CctvDeviceFilters } from '../types';

const DEVICE_TYPE_OPTIONS = ['DVR', 'NVR', 'RECORDER'];
const STATUS_OPTIONS = ['ONLINE', 'OFFLINE', 'UNKNOWN'];

const inputClass =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500';

export default function CctvDeviceFilters({
  value,
  onChange,
  onReset,
}: {
  value: CctvDeviceFilters;
  onChange: (patch: Partial<CctvDeviceFilters>) => void;
  onReset: () => void;
}) {
  return (
    <div className="mb-4 grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-2 lg:grid-cols-5">
      <div className="relative lg:col-span-2">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search name, IP, brand, model..."
          value={value.search ?? ''}
          onChange={(e) => onChange({ search: e.target.value || undefined, page: 1 })}
          className={`${inputClass} pl-10`}
        />
      </div>
      <select
        value={value.deviceType ?? ''}
        onChange={(e) => onChange({ deviceType: e.target.value || undefined, page: 1 })}
        className={inputClass}
        aria-label="Filter by device type"
      >
        <option value="">All Types</option>
        {DEVICE_TYPE_OPTIONS.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      <select
        value={value.status ?? ''}
        onChange={(e) => onChange({ status: e.target.value || undefined, page: 1 })}
        className={inputClass}
        aria-label="Filter by status"
      >
        <option value="">All Statuses</option>
        {STATUS_OPTIONS.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <select
        value={value.isActive === undefined ? '' : String(value.isActive)}
        onChange={(e) => onChange({ isActive: e.target.value ? e.target.value === 'true' : undefined, page: 1 })}
        className={inputClass}
        aria-label="Filter by active status"
      >
        <option value="">All Active Status</option>
        <option value="true">Active</option>
        <option value="false">Inactive</option>
      </select>
      <button
        onClick={onReset}
        className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 lg:col-span-5"
      >
        <RotateCcw className="h-3.5 w-3.5" /> Reset Filters
      </button>
    </div>
  );
}
