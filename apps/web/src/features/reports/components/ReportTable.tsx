import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Loader2, MoreVertical } from 'lucide-react';
import type { PaginationMeta } from '../types';

export interface ReportColumn<T> {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (item: T) => ReactNode;
}

interface ReportTableProps<T> {
  columns: ReportColumn<T>[];
  items: T[];
  rowKey: (item: T) => string;
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
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
}

function cellValue<T>(item: T, col: ReportColumn<T>): ReactNode {
  if (col.render) return col.render(item);
  const v = (item as Record<string, unknown>)[col.key];
  return v == null || v === '' ? '-' : String(v);
}

export default function ReportTable<T>({
  columns,
  items,
  rowKey,
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
  onRowClick,
  emptyMessage = 'No records match the current filters.',
}: ReportTableProps<T>) {
  const toggleSort = (key: string) => {
    if (!onSort) return;
    onSort(key, sortBy === key && sortOrder === 'asc' ? 'desc' : 'asc');
  };

  const stateRow = () => {
    if (isLoading) {
      return <tr><td colSpan={columns.length} className="px-4 py-16 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-400" /></td></tr>;
    }
    if (isError) {
      return (
        <tr><td colSpan={columns.length} className="px-4 py-16 text-center">
          <p className="mb-2 text-sm text-red-500">{errorMessage || 'Unable to load report.'}</p>
          <button onClick={onRetry} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">Try Again</button>
        </td></tr>
      );
    }
    if (items.length === 0) {
      return (
        <tr><td colSpan={columns.length} className="px-4 py-16 text-center">
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400"><MoreVertical className="h-5 w-5" /></div>
          <p className="text-sm font-medium text-slate-500">{emptyMessage}</p>
        </td></tr>
      );
    }
    return null;
  };

  const primary = columns[0];
  const rest = columns.slice(1);

  return (
    <div>
      <div className="hidden overflow-x-auto rounded-lg border border-slate-200 bg-white md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              {columns.map((col) => (
                <th key={col.key} className={`px-4 py-3 font-medium text-slate-600 ${onSort && col.sortable ? 'cursor-pointer select-none hover:text-indigo-600' : ''}`} onClick={() => col.sortable && toggleSort(col.key)}>
                  {col.label} {sortBy === col.key ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {stateRow()}
            {!isLoading && !isError && items.map((item) => (
              <tr key={rowKey(item)} className={`${onRowClick ? 'cursor-pointer hover:bg-slate-50' : ''}`} onClick={onRowClick ? () => onRowClick(item) : undefined}>
                {columns.map((col) => <td key={col.key} className="px-4 py-3">{cellValue(item, col)}</td>)}
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
            <p className="text-sm font-medium text-slate-500">{emptyMessage}</p>
          </div>
        )}
        {!isLoading && !isError && items.map((item) => (
          <button key={rowKey(item)} onClick={onRowClick ? () => onRowClick(item) : undefined} className="block w-full rounded-lg border border-slate-200 bg-white p-4 text-left">
            <p className="mb-1 text-sm font-semibold text-slate-800">{primary ? cellValue(item, primary) : ''}</p>
            {rest.map((col) => (
              <div key={col.key} className="flex items-start justify-between gap-2 border-t border-slate-100 py-1 first:border-t-0">
                <span className="text-xs text-slate-400">{col.label}</span>
                <span className="text-right text-xs font-medium text-slate-700">{cellValue(item, col)}</span>
              </div>
            ))}
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
