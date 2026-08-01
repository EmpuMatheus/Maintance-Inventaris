import { useState } from 'react';
import { ChevronLeft, ChevronRight, Eye, Loader2, MoreVertical, Pencil } from 'lucide-react';
import type { MaintenanceListItem, PaginationMeta } from '../types';
import StatusBadge from './StatusBadge';
import PriorityBadge from './PriorityBadge';

export interface MoreMenuItem {
  label: string;
  onClick: () => void;
}

interface MaintenanceTableProps {
  data: MaintenanceListItem[];
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  onRetry: () => void;
  page: number;
  meta?: PaginationMeta;
  onPageChange: (page: number) => void;
  onView: (id: string) => void;
  onEdit: (id: string) => void;
  canUpdate: boolean;
  moreActions: (record: MaintenanceListItem) => MoreMenuItem[];
}

function formatDate(value?: string | null): string {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function MaintenanceTable({
  data,
  isLoading,
  isError,
  errorMessage,
  onRetry,
  page,
  meta,
  onPageChange,
  onView,
  onEdit,
  canUpdate,
  moreActions,
}: MaintenanceTableProps) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const renderState = (colSpan: number) => {
    if (isLoading) {
      return (
        <tr><td colSpan={colSpan} className="px-4 py-16 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-400" /></td></tr>
      );
    }
    if (isError) {
      return (
        <tr><td colSpan={colSpan} className="px-4 py-16 text-center">
          <p className="mb-2 text-sm text-red-500">{errorMessage || 'Unable to load maintenance records.'}</p>
          <button onClick={onRetry} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">Try Again</button>
        </td></tr>
      );
    }
    if (data.length === 0) {
      return (
        <tr><td colSpan={colSpan} className="px-4 py-16 text-center">
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <MoreVertical className="h-5 w-5" />
          </div>
          <p className="text-sm font-medium text-slate-500">No maintenance records found.</p>
          <p className="mt-1 text-xs text-slate-400">Try adjusting your search or filters.</p>
        </td></tr>
      );
    }
    return null;
  };

  return (
    <div>
      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-lg border border-slate-200 bg-white md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="px-4 py-3 font-medium text-slate-600">Maintenance Code</th>
              <th className="px-4 py-3 font-medium text-slate-600">Asset</th>
              <th className="px-4 py-3 font-medium text-slate-600">Type</th>
              <th className="px-4 py-3 font-medium text-slate-600">Priority</th>
              <th className="px-4 py-3 font-medium text-slate-600">Technician</th>
              <th className="px-4 py-3 font-medium text-slate-600">Status</th>
              <th className="px-4 py-3 font-medium text-slate-600">Created</th>
              <th className="px-4 py-3 font-medium text-slate-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {renderState(8)}
            {!isLoading && !isError && data.map((m) => (
              <tr key={m.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-mono text-xs text-slate-700">{m.maintenanceCode}</td>
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-900">{m.asset?.assetName || '-'}</p>
                  <p className="font-mono text-xs text-slate-400">{m.asset?.assetCode || ''}</p>
                </td>
                <td className="px-4 py-3 text-slate-600">{m.maintenanceType?.name || m.maintenanceCategory || '-'}</td>
                <td className="px-4 py-3"><PriorityBadge priority={m.priority || undefined} /></td>
                <td className="px-4 py-3 text-slate-600">{m.technician?.name || '—'}</td>
                <td className="px-4 py-3"><StatusBadge status={m.status} /></td>
                <td className="px-4 py-3 text-xs text-slate-400">{formatDate(m.createdAt)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => onView(m.id)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-600" title="View"><Eye className="h-4 w-4" /></button>
                    {canUpdate && (
                      <button onClick={() => onEdit(m.id)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-600" title="Edit"><Pencil className="h-4 w-4" /></button>
                    )}
                    {moreActions(m).length > 0 && (
                      <div className="relative">
                        <button onClick={() => setOpenMenuId(openMenuId === m.id ? null : m.id)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600" title="More actions"><MoreVertical className="h-4 w-4" /></button>
                        {openMenuId === m.id && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
                            <div className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                              {moreActions(m).map((item) => (
                                <button key={item.label} onClick={() => { setOpenMenuId(null); item.onClick(); }} className="block w-full px-3 py-2 text-left text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900">
                                  {item.label}
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
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
            <p className="mb-2 text-sm text-red-500">{errorMessage || 'Unable to load maintenance records.'}</p>
            <button onClick={onRetry} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">Try Again</button>
          </div>
        )}
        {!isLoading && !isError && data.length === 0 && (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
            <p className="text-sm font-medium text-slate-500">No maintenance records found.</p>
            <p className="mt-1 text-xs text-slate-400">Try adjusting your search or filters.</p>
          </div>
        )}
        {!isLoading && !isError && data.map((m) => (
          <div key={m.id} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-mono text-xs text-slate-400">{m.maintenanceCode}</span>
              <StatusBadge status={m.status} />
            </div>
            <button onClick={() => onView(m.id)} className="mb-1 block text-left font-medium text-slate-900">{m.asset?.assetName || '-'}</button>
            <p className="mb-3 font-mono text-xs text-slate-400">{m.asset?.assetCode || ''}</p>
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span>{m.maintenanceType?.name || m.maintenanceCategory || '-'}</span>
              <span className="text-slate-300">•</span>
              <PriorityBadge priority={m.priority || undefined} />
              <span className="text-slate-300">•</span>
              <span>{m.technician?.name || 'Unassigned'}</span>
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 pt-3">
              <span className="text-xs text-slate-400">Created {formatDate(m.createdAt)}</span>
              <button onClick={() => onView(m.id)} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"><Eye className="h-3 w-3" /> View</button>
            </div>
          </div>
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
