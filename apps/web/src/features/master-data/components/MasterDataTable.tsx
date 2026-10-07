import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, ChevronLeft, ChevronRight, Plus, Pencil, Trash2, Loader2, Power, PowerOff } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { listResource, deleteResourcePermanently, setResourceActive } from '../api/master-data';
import MasterDataForm from './MasterDataForm';
import ActiveStatusBadge from './ActiveStatusBadge';
import DeactivateDialog from './DeactivateDialog';
import DeletePermanentDialog from './DeletePermanentDialog';
import type { ModuleConfig, MasterDataRecord } from '../types';

interface Props {
  config: ModuleConfig;
}

export default function MasterDataTable({ config }: Props) {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<MasterDataRecord | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [permanentDelete, setPermanentDelete] = useState<MasterDataRecord | null>(null);
  const [deactivating, setDeactivating] = useState<MasterDataRecord | null>(null);
  const canManage = can('master_data.manage');

  const isCategory = config.path === 'categories';

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['master-data', config.path, { page, search }],
    queryFn: () => listResource(config.path, { page, search: search || undefined }),
  });

  const permanentDeleteMut = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      deleteResourcePermanently(config.path, id, { notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['master-data', config.path] });
      toast.success('Category permanently deleted');
      setPermanentDelete(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleStatus = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      setResourceActive(config.path, id, isActive),
    onSuccess: (_res, variables) => {
      queryClient.invalidateQueries({ queryKey: ['master-data', config.path] });
      toast.success(variables.isActive ? `${config.label} diaktifkan` : `${config.label} dinonaktifkan`);
      setDeactivating(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openCreate = () => {
    setEditing(null);
    setShowForm(true);
  };

  const openEdit = (record: MasterDataRecord) => {
    setEditing(record);
    setShowForm(true);
  };

  const onFormClose = useCallback(() => {
    setShowForm(false);
    setEditing(null);
  }, []);

  const onFormSuccess = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['master-data', config.path] });
    setShowForm(false);
    setEditing(null);
  }, [queryClient, config.path]);

  const recordLabel = (row: MasterDataRecord) =>
    [row.code, row.name].filter(Boolean).join(' - ') || String(row.id);

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={`Search ${config.label.toLowerCase()}...`}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        {canManage && (
          <button onClick={openCreate} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            <Plus className="h-4 w-4" />
            Add {config.label}
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              {config.columns.map((col) => (
                <th key={col.key} className="px-4 py-3 font-medium text-slate-600">{col.label}</th>
              ))}
              {canManage && <th className="px-4 py-3 font-medium text-slate-600">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && (
              <tr>
                <td colSpan={config.columns.length + (canManage ? 1 : 0)} className="px-4 py-12 text-center text-slate-400">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </td>
              </tr>
            )}
            {isError && (
              <tr>
                <td colSpan={config.columns.length + (canManage ? 1 : 0)} className="px-4 py-12 text-center text-red-500">
                  {(error as Error)?.message || 'Failed to load data'}
                </td>
              </tr>
            )}
            {!isLoading && !isError && data?.data.length === 0 && (
              <tr>
                <td colSpan={config.columns.length + (canManage ? 1 : 0)} className="px-4 py-12 text-center text-slate-400">
                  No {config.label.toLowerCase()} found.
                </td>
              </tr>
            )}
            {!isLoading && !isError && data?.data?.map((row: MasterDataRecord) => (
              <tr key={row.id} className={`hover:bg-slate-50 ${row.isActive === false ? 'bg-slate-50/60' : ''}`}>
                {config.columns.map((col) => (
                  <td key={col.key} className="px-4 py-3 text-slate-700">
                    {col.key === 'isActive' ? (
                      <ActiveStatusBadge isActive={row.isActive !== false} />
                    ) : col.key === 'isNetworkDevice' ? (
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        row.isNetworkDevice
                          ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600/20'
                          : 'bg-slate-100 text-slate-500 ring-1 ring-slate-400/20'
                      }`}>
                        {row.isNetworkDevice ? 'YES' : 'NO'}
                      </span>
                    ) : (
                      String(row[col.key as keyof MasterDataRecord] ?? (col.key === 'building' ? '-' : ''))
                    )}
                  </td>
                ))}
                {canManage && (
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(row)} className="rounded p-1 text-slate-400 hover:text-indigo-600" title="Edit">
                        <Pencil className="h-4 w-4" />
                      </button>
                      {isCategory && row.isActive === false ? (
                        <>
                          <button
                            onClick={() => toggleStatus.mutate({ id: row.id, isActive: true })}
                            disabled={toggleStatus.isPending}
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                            title="Activate"
                          >
                            <Power className="h-3.5 w-3.5" /> Aktifkan
                          </button>
                          <button
                            onClick={() => setPermanentDelete(row)}
                            className="rounded p-1 text-slate-400 hover:text-red-600"
                            title="Delete Permanently"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      ) : isCategory ? (
                        <>
                          <button
                            onClick={() => setDeactivating(row)}
                            className="inline-flex items-center gap-1 rounded-lg border border-amber-200 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50"
                            title="Deactivate"
                          >
                            <PowerOff className="h-3.5 w-3.5" /> Nonaktifkan
                          </button>
                          <button
                            onClick={() => setPermanentDelete(row)}
                            className="rounded p-1 text-slate-400 hover:text-red-600"
                            title="Delete Permanently"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      ) : row.isActive === false ? (
                        <button
                          onClick={() => toggleStatus.mutate({ id: row.id, isActive: true })}
                          disabled={toggleStatus.isPending}
                          className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                          title="Activate"
                        >
                          <Power className="h-3.5 w-3.5" /> Aktifkan
                        </button>
                      ) : (
                        <button
                          onClick={() => setDeactivating(row)}
                          className="inline-flex items-center gap-1 rounded-lg border border-amber-200 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50"
                          title="Deactivate"
                        >
                          <PowerOff className="h-3.5 w-3.5" /> Nonaktifkan
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data && data.meta.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
          <span>Page {data.meta.page} of {data.meta.totalPages} ({data.meta.total} total)</span>
          <div className="flex items-center gap-2">
            <button disabled={!data.meta.hasPreviousPage} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-slate-300 p-2 disabled:opacity-30 hover:bg-slate-50">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button disabled={!data.meta.hasNextPage} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-slate-300 p-2 disabled:opacity-30 hover:bg-slate-50">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {showForm && (
        <MasterDataForm
          config={config}
          record={editing}
          onClose={onFormClose}
          onSuccess={onFormSuccess}
        />
      )}

      <DeletePermanentDialog
        open={!!permanentDelete}
        label={isCategory ? 'Category' : config.label}
        recordName={permanentDelete ? recordLabel(permanentDelete) : ''}
        isSubmitting={permanentDeleteMut.isPending}
        onClose={() => setPermanentDelete(null)}
        onConfirm={({ notes }) =>
          permanentDelete && permanentDeleteMut.mutate({ id: permanentDelete.id, notes })
        }
      />

      <DeactivateDialog
        open={!!deactivating}
        label={config.label}
        recordName={deactivating ? recordLabel(deactivating) : ''}
        isSubmitting={toggleStatus.isPending}
        onClose={() => setDeactivating(null)}
        onConfirm={() => deactivating && toggleStatus.mutate({ id: deactivating.id, isActive: false })}
      />
    </div>
  );
}
