import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, ChevronLeft, ChevronRight, Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { listResource, deactivateResource } from '../api/master-data';
import MasterDataForm from './MasterDataForm';
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
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const canManage = can('master_data.manage');

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['master-data', config.path, { page, search }],
    queryFn: () => listResource(config.path, { page, search: search || undefined }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deactivateResource(config.path, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['master-data', config.path] });
      toast.success(`${config.label} deactivated`);
      setConfirmDelete(null);
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
              <tr key={row.id} className="hover:bg-slate-50">
                {config.columns.map((col) => (
                  <td key={col.key} className="px-4 py-3 text-slate-700">
                    {col.key === 'isActive' ? (
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${row.isActive ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                        {row.isActive ? 'Active' : 'Inactive'}
                      </span>
                    ) : (
                      String(row[col.key as keyof MasterDataRecord] ?? '')
                    )}
                  </td>
                ))}
                {canManage && (
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(row)} className="rounded p-1 text-slate-400 hover:text-indigo-600" title="Edit">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => setConfirmDelete(row.id)} className="rounded p-1 text-slate-400 hover:text-red-600" title="Deactivate">
                        <Trash2 className="h-4 w-4" />
                      </button>
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

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Deactivate {config.label}?</h3>
            <p className="mt-2 text-sm text-slate-500">This record will no longer be available for new assignments.</p>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setConfirmDelete(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={() => deleteMut.mutate(confirmDelete)} disabled={deleteMut.isPending} className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50">
                {deleteMut.isPending ? 'Deactivating...' : 'Deactivate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
