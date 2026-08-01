import { ChevronLeft, ChevronRight, Loader2, MoreVertical, Wrench } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { MaintenanceReportItem, PaginationMeta } from '../types';

const STATUS_STYLES: Record<string, string> = {
  OPEN: 'bg-blue-50 text-blue-700',
  ASSIGNED: 'bg-indigo-50 text-indigo-700',
  IN_PROGRESS: 'bg-amber-50 text-amber-700',
  WAITING_PART: 'bg-orange-50 text-orange-700',
  TESTING: 'bg-purple-50 text-purple-700',
  COMPLETED: 'bg-green-50 text-green-700',
  CANCELLED: 'bg-slate-100 text-slate-500',
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'text-slate-500',
  MEDIUM: 'text-blue-600',
  HIGH: 'text-orange-600',
  CRITICAL: 'text-red-600',
};

const SORTABLE: { key: string; label: string }[] = [
  { key: 'maintenance_code', label: 'Maintenance Code' },
  { key: 'scheduled_date', label: 'Scheduled' },
  { key: 'completed_at', label: 'Completed' },
  { key: 'priority', label: 'Priority' },
  { key: 'status', label: 'Status' },
  { key: 'created_at', label: 'Created' },
];

function formatDate(value?: string | null): string {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function durationLabel(hours?: number | null): string {
  if (hours == null) return '-';
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  return `${hours}h`;
}

interface MaintenanceReportTableProps {
  items: MaintenanceReportItem[];
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  onRetry: () => void;
  page: number;
  meta?: PaginationMeta;
  onPageChange: (page: number) => void;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  onSort?: (sortBy: string, sortOrder: 'asc' | 'desc') => void;
}

export default function MaintenanceReportTable({
  items,
  isLoading,
  isError,
  errorMessage,
  onRetry,
  page,
  meta,
  onPageChange,
  sortBy,
  sortOrder,
  onSort,
}: MaintenanceReportTableProps) {
  const navigate = useNavigate();

  const toggleSort = (key: string) => {
    if (!onSort) return;
    const nextOrder = sortBy === key && sortOrder === 'asc' ? 'desc' : 'asc';
    onSort(key, nextOrder);
  };

  const openDetail = (id: string) => navigate(`/maintenance/${id}`);

  const renderState = (colSpan: number) => {
    if (isLoading) {
      return <tr><td colSpan={colSpan} className="px-4 py-16 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-400" /></td></tr>;
    }
    if (isError) {
      return (
        <tr><td colSpan={colSpan} className="px-4 py-16 text-center">
          <p className="mb-2 text-sm text-red-500">{errorMessage || 'Unable to load report.'}</p>
          <button onClick={onRetry} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">Try Again</button>
        </td></tr>
      );
    }
    if (items.length === 0) {
      return (
        <tr><td colSpan={colSpan} className="px-4 py-16 text-center">
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400"><MoreVertical className="h-5 w-5" /></div>
          <p className="text-sm font-medium text-slate-500">No maintenance records match the current filters.</p>
          <p className="mt-1 text-xs text-slate-400">Adjust the filters or try a different search.</p>
        </td></tr>
      );
    }
    return null;
  };

  return (
    <div>
      <div className="hidden overflow-x-auto rounded-lg border border-slate-200 bg-white md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              {SORTABLE.map((col) => (
                <th key={col.key} className={`px-4 py-3 font-medium text-slate-600 ${onSort ? 'cursor-pointer select-none hover:text-indigo-600' : ''}`} onClick={() => toggleSort(col.key)}>
                  {col.label} {sortBy === col.key ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                </th>
              ))}
              <th className="px-4 py-3 font-medium text-slate-600">Asset</th>
              <th className="px-4 py-3 font-medium text-slate-600">Type</th>
              <th className="px-4 py-3 font-medium text-slate-600">Technician</th>
              <th className="px-4 py-3 font-medium text-slate-600">Duration</th>
              <th className="px-4 py-3 font-medium text-slate-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {renderState(SORTABLE.length + 5)}
            {!isLoading && !isError && items.map((item) => (
              <tr key={item.id} className="cursor-pointer hover:bg-slate-50" onClick={() => openDetail(item.id)}>
                <td className="px-4 py-3 font-mono text-xs text-indigo-600">{item.maintenanceCode}</td>
                <td className="px-4 py-3 text-xs text-slate-400">{formatDate(item.scheduledDate)}</td>
                <td className="px-4 py-3 text-xs text-slate-400">{formatDate(item.finishDate)}</td>
                <td className={`px-4 py-3 font-medium ${PRIORITY_COLORS[item.priority] || ''}`}>{item.priority || '-'}</td>
                <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[item.status] || 'bg-slate-100 text-slate-600'}`}>{item.status.replace(/_/g, ' ')}</span></td>
                <td className="px-4 py-3 text-xs text-slate-400">{formatDate(item.createdAt)}</td>
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-900">{item.asset?.assetName || '-'}</p>
                  <p className="font-mono text-xs text-slate-400">{item.asset?.assetCode}</p>
                </td>
                <td className="px-4 py-3 text-slate-600">{item.maintenanceType || item.maintenanceCategory || '-'}</td>
                <td className="px-4 py-3 text-slate-600">{item.technician || '—'}</td>
                <td className={`px-4 py-3 text-xs font-medium ${item.overdue ? 'text-red-600' : 'text-slate-500'}`}>{durationLabel(item.durationHours)}</td>
                <td className="px-4 py-3">
                  <button onClick={(e) => { e.stopPropagation(); openDetail(item.id); }} className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50">
                    Open
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {isLoading && <div className="rounded-lg border border-slate-200 bg-white p-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-400" /></div>}
        {isError && (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
            <p className="mb-2 text-sm text-red-500">{errorMessage || 'Unable to load report.'}</p>
            <button onClick={onRetry} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">Try Again</button>
          </div>
        )}
        {!isLoading && !isError && items.length === 0 && (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
            <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400"><Wrench className="h-5 w-5" /></div>
            <p className="text-sm font-medium text-slate-500">No maintenance records match the current filters.</p>
          </div>
        )}
        {!isLoading && !isError && items.map((item) => (
          <button key={item.id} onClick={() => openDetail(item.id)} className="block w-full rounded-lg border border-slate-200 bg-white p-4 text-left">
            <div className="mb-1 flex items-center justify-between">
              <span className="font-mono text-xs text-indigo-600">{item.maintenanceCode}</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLES[item.status] || 'bg-slate-100 text-slate-600'}`}>{item.status.replace(/_/g, ' ')}</span>
            </div>
            <p className="font-medium text-slate-900">{item.asset?.assetName || '-'}</p>
            <p className="mt-1 text-xs text-slate-500">
              {item.maintenanceType || item.maintenanceCategory || '-'} · <span className={PRIORITY_COLORS[item.priority] || ''}>{item.priority}</span> · {item.technician || 'Unassigned'}
            </p>
            <p className="text-xs text-slate-400">
              Scheduled {formatDate(item.scheduledDate)} · Completed {formatDate(item.finishDate)} · Duration {durationLabel(item.durationHours)}
              {item.overdue && <span className="ml-1 font-medium text-red-600">Overdue</span>}
            </p>
          </button>
        ))}
      </div>

      {meta && meta.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
          <span>Page {meta.page} of {meta.totalPages} ({meta.total} total)</span>
          <div className="flex items-center gap-2">
            <button disabled={!meta.hasPreviousPage} onClick={() => onPageChange(page - 1)} className="rounded-lg border border-slate-300 p-2 disabled:opacity-30 hover:bg-slate-50"><ChevronLeft className="h-4 w-4" /></button>
            <button disabled={!meta.hasNextPage} onClick={() => onPageChange(page + 1)} className="rounded-lg border border-slate-300 p-2 disabled:opacity-30 hover:bg-slate-50"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>
      )}
    </div>
  );
}
