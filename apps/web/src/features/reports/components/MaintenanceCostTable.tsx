import { ChevronLeft, ChevronRight, Loader2, MoreVertical, Wrench } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { MaintenanceCostItem, PaginationMeta } from '../types';

const STATUS_STYLES: Record<string, string> = {
  OPEN: 'bg-blue-50 text-blue-700',
  ASSIGNED: 'bg-indigo-50 text-indigo-700',
  IN_PROGRESS: 'bg-amber-50 text-amber-700',
  WAITING_PART: 'bg-orange-50 text-orange-700',
  TESTING: 'bg-purple-50 text-purple-700',
  COMPLETED: 'bg-green-50 text-green-700',
  CANCELLED: 'bg-slate-100 text-slate-500',
};

const SORTABLE: { key: string; label: string }[] = [
  { key: 'maintenance_code', label: 'Maintenance Code' },
  { key: 'asset_name', label: 'Asset' },
  { key: 'vendor', label: 'Vendor' },
  { key: 'category', label: 'Category' },
  { key: 'total_cost', label: 'Total' },
  { key: 'completed_at', label: 'Completed' },
];

function currency(value: number): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);
}

function formatDate(value?: string | null): string {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

interface MaintenanceCostTableProps {
  items: MaintenanceCostItem[];
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

export default function MaintenanceCostTable({
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
}: MaintenanceCostTableProps) {
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
              <th className="px-4 py-3 font-medium text-slate-600">Labor</th>
              <th className="px-4 py-3 font-medium text-slate-600">Parts</th>
              <th className="px-4 py-3 font-medium text-slate-600">Other</th>
              <th className="px-4 py-3 font-medium text-slate-600">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {renderState(SORTABLE.length + 4)}
            {!isLoading && !isError && items.map((item) => (
              <tr key={item.id} className="cursor-pointer hover:bg-slate-50" onClick={() => openDetail(item.id)}>
                <td className="px-4 py-3 font-mono text-xs text-indigo-600">{item.maintenanceCode}</td>
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-900">{item.asset?.assetName || '-'}</p>
                  <p className="font-mono text-xs text-slate-400">{item.asset?.assetCode}</p>
                </td>
                <td className="px-4 py-3 text-slate-600">{item.vendor || '-'}</td>
                <td className="px-4 py-3 text-slate-600">{item.asset?.category || '-'}</td>
                <td className="px-4 py-3 font-medium text-slate-900">{currency(item.totalCost)}</td>
                <td className="px-4 py-3 text-xs text-slate-400">{formatDate(item.completedDate)}</td>
                <td className="px-4 py-3 text-slate-600">{currency(item.laborCost)}</td>
                <td className="px-4 py-3 text-slate-600">{currency(item.partsCost)}</td>
                <td className="px-4 py-3 text-slate-600">{currency(item.otherCost)}</td>
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
            <p className="mt-1 text-xs text-slate-500">{item.asset?.category || '-'} · {item.vendor || '-'} · {item.maintenanceType || 'General'}</p>
            <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2">
              <span className="text-xs text-slate-500">L {currency(item.laborCost)} · P {currency(item.partsCost)} · O {currency(item.otherCost)}</span>
              <span className="text-sm font-bold text-slate-900">{currency(item.totalCost)}</span>
            </div>
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
