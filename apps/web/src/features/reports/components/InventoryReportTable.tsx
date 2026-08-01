import { ChevronLeft, ChevronRight, Loader2, MoreVertical, Package } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { InventoryReportItem, PaginationMeta } from '../types';

const CONDITION_STYLES: Record<string, string> = {
  GOOD: 'bg-green-50 text-green-700',
  FAIR: 'bg-yellow-50 text-yellow-700',
  NEED_ATTENTION: 'bg-orange-50 text-orange-700',
  BROKEN: 'bg-red-50 text-red-700',
  CRITICAL: 'bg-red-100 text-red-800',
  RETIRED: 'bg-slate-100 text-slate-500',
};

const STATUS_STYLES: Record<string, string> = {
  AVAILABLE: 'bg-blue-50 text-blue-700',
  ASSIGNED: 'bg-indigo-50 text-indigo-700',
  IN_USE: 'bg-green-50 text-green-700',
  IN_MAINTENANCE: 'bg-amber-50 text-amber-700',
  BROKEN: 'bg-red-50 text-red-700',
  SPARE: 'bg-slate-100 text-slate-500',
  LOST: 'bg-red-100 text-red-800',
  RETIRED: 'bg-slate-200 text-slate-600',
  DISPOSED: 'bg-slate-200 text-slate-600',
};

const SORTABLE: { key: string; label: string }[] = [
  { key: 'asset_code', label: 'Asset Code' },
  { key: 'asset_name', label: 'Asset Name' },
  { key: 'created_at', label: 'Created' },
  { key: 'updated_at', label: 'Updated' },
];

function formatDate(value?: string | null): string {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function locationOf(item: InventoryReportItem): string {
  return [item.site, item.building, item.floor, item.room].filter(Boolean).join(' / ') || '-';
}

interface InventoryReportTableProps {
  items: InventoryReportItem[];
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

export default function InventoryReportTable({
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
}: InventoryReportTableProps) {
  const navigate = useNavigate();

  const toggleSort = (key: string) => {
    if (!onSort) return;
    const nextOrder = sortBy === key && sortOrder === 'asc' ? 'desc' : 'asc';
    onSort(key, nextOrder);
  };

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
          <p className="text-sm font-medium text-slate-500">No assets match the current filters.</p>
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
              <th className="px-4 py-3 font-medium text-slate-600">Category</th>
              <th className="px-4 py-3 font-medium text-slate-600">Brand</th>
              <th className="px-4 py-3 font-medium text-slate-600">Department</th>
              <th className="px-4 py-3 font-medium text-slate-600">Location</th>
              <th className="px-4 py-3 font-medium text-slate-600">PIC</th>
              <th className="px-4 py-3 font-medium text-slate-600">Condition</th>
              <th className="px-4 py-3 font-medium text-slate-600">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {renderState(SORTABLE.length + 7)}
            {!isLoading && !isError && items.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <button onClick={() => navigate(`/assets/${item.id}`)} className="font-mono text-xs text-indigo-600 hover:underline">{item.assetCode}</button>
                </td>
                <td className="px-4 py-3 font-medium text-slate-900">{item.assetName}</td>
                <td className="px-4 py-3 text-xs text-slate-400">{formatDate(item.createdAt)}</td>
                <td className="px-4 py-3 text-xs text-slate-400">{formatDate(item.updatedAt)}</td>
                <td className="px-4 py-3 text-slate-600">{item.category || '-'}</td>
                <td className="px-4 py-3 text-slate-600">{item.brand || '-'}</td>
                <td className="px-4 py-3 text-slate-600">{item.department || '-'}</td>
                <td className="max-w-48 px-4 py-3 text-slate-600">{locationOf(item)}</td>
                <td className="px-4 py-3 text-slate-600">{item.pic || '-'}</td>
                <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${CONDITION_STYLES[item.condition] || 'bg-slate-100 text-slate-600'}`}>{item.condition.replace(/_/g, ' ')}</span></td>
                <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[item.status] || 'bg-slate-100 text-slate-600'}`}>{item.status.replace(/_/g, ' ')}</span></td>
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
            <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400"><Package className="h-5 w-5" /></div>
            <p className="text-sm font-medium text-slate-500">No assets match the current filters.</p>
          </div>
        )}
        {!isLoading && !isError && items.map((item) => (
          <button key={item.id} onClick={() => navigate(`/assets/${item.id}`)} className="block w-full rounded-lg border border-slate-200 bg-white p-4 text-left">
            <div className="mb-1 flex items-center justify-between">
              <span className="font-mono text-xs text-indigo-600">{item.assetCode}</span>
              <div className="flex gap-1.5">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${CONDITION_STYLES[item.condition] || 'bg-slate-100 text-slate-600'}`}>{item.condition.replace(/_/g, ' ')}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLES[item.status] || 'bg-slate-100 text-slate-600'}`}>{item.status.replace(/_/g, ' ')}</span>
              </div>
            </div>
            <p className="font-medium text-slate-900">{item.assetName}</p>
            <p className="mt-1 text-xs text-slate-500">{item.category || '-'} · {item.brand || '-'} · {item.department || '-'}</p>
            <p className="text-xs text-slate-400">📍 {locationOf(item)} · 👤 {item.pic || '-'}</p>
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
