import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, Plus, ChevronLeft, ChevronRight, Loader2, Eye, Pencil, Trash2, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { listAssets, retireAsset, deleteAssetPermanently } from '../api/inventory';
import RetireDialog from '../components/RetireDialog';
import DeleteDialog from '../components/DeleteDialog';

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

export default function InventoryListPage() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [condition, setCondition] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('createdAt');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [retireTarget, setRetireTarget] = useState<{ id: string; assetCode: string; assetName: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; assetCode: string; assetName: string } | null>(null);
  const qc = useQueryClient();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['assets', { page, search, condition, status, sort, order }],
    queryFn: () => listAssets({
      page,
      search: search || undefined,
      condition: condition || undefined,
      status: status || undefined,
      sort: sort || undefined,
      order: sort ? order : undefined,
    }),
  });

  const retireMut = useMutation({
    mutationFn: (payload: { reason: string; notes?: string }) => retireAsset(retireTarget!.id, payload),
    onSuccess: () => {
      toast.success('Asset retired.');
      setRetireTarget(null);
      qc.invalidateQueries({ queryKey: ['assets'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (payload: { notes?: string }) => deleteAssetPermanently(deleteTarget!.id, payload),
    onSuccess: () => {
      toast.success('Asset permanently deleted.');
      setDeleteTarget(null);
      qc.invalidateQueries({ queryKey: ['assets'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Inventory</h1>
          <p className="mt-1 text-sm text-slate-500">Manage and monitor company assets.</p>
        </div>
        {can('asset.create') && (
          <button onClick={() => navigate('/assets/new')} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700">
            <Plus className="h-4 w-4" /> Add Asset
          </button>
        )}
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Search assets, serial numbers..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
        </div>
        <select value={condition} onChange={(e) => { setCondition(e.target.value); setPage(1); }} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="">All Conditions</option>
          <option value="GOOD">Good</option>
          <option value="FAIR">Fair</option>
          <option value="NEED_ATTENTION">Need Attention</option>
          <option value="BROKEN">Broken</option>
          <option value="CRITICAL">Critical</option>
        </select>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="">All Statuses</option>
          <option value="AVAILABLE">Available</option>
          <option value="ASSIGNED">Assigned</option>
          <option value="IN_USE">In Use</option>
          <option value="IN_MAINTENANCE">In Maintenance</option>
          <option value="BROKEN">Broken</option>
          <option value="SPARE">Spare</option>
          <option value="RETIRED">Retired</option>
        </select>
        <select value={sort} onChange={(e) => { setSort(e.target.value); setOrder(e.target.value === 'createdAt' ? 'desc' : 'asc'); setPage(1); }} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="createdAt">Newest First</option>
          <option value="assetCode">Asset Code</option>
          <option value="assetName">Asset Name</option>
          <option value="category">Category</option>
          <option value="condition">Condition</option>
          <option value="status">Status</option>
        </select>
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-lg border border-slate-200 md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="px-4 py-3 font-medium text-slate-600">Asset Code</th>
              <th className="px-4 py-3 font-medium text-slate-600">Asset Name</th>
              <th className="px-4 py-3 font-medium text-slate-600">Category</th>
              <th className="px-4 py-3 font-medium text-slate-600">Condition</th>
              <th className="px-4 py-3 font-medium text-slate-600">Status</th>
              <th className="px-4 py-3 font-medium text-slate-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && (
              <tr><td colSpan={6} className="px-4 py-12 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-400" /></td></tr>
            )}
            {isError && (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-red-500">{(error as any)?.message || 'Failed to load'}</td></tr>
            )}
            {!isLoading && !isError && (!data?.data || data.data.length === 0) && (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-400">No assets found.</td></tr>
            )}
            {!isLoading && !isError && data?.data?.map((a: any) => (
              <tr key={a.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-mono text-xs text-slate-700">{a.assetCode}</td>
                <td className="px-4 py-3 font-medium text-slate-900">{a.assetName}</td>
                <td className="px-4 py-3 text-slate-600">{a.categoryName || '-'}</td>
                <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${CONDITION_STYLES[a.condition] || 'bg-slate-100 text-slate-600'}`}>{a.condition?.replace(/_/g, ' ')}</span></td>
                <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[a.status] || 'bg-slate-100 text-slate-600'}`}>{a.status?.replace(/_/g, ' ')}</span></td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => navigate(`/assets/${a.id}`)} className="rounded p-1 text-slate-400 hover:text-indigo-600" title="View"><Eye className="h-4 w-4" /></button>
                    {can('asset.update') && <button onClick={() => navigate(`/assets/${a.id}/edit`)} className="rounded p-1 text-slate-400 hover:text-indigo-600" title="Edit"><Pencil className="h-4 w-4" /></button>}
                    {can('asset.retire') && <button onClick={() => setRetireTarget({ id: a.id, assetCode: a.assetCode, assetName: a.assetName })} className="rounded p-1 text-slate-400 hover:text-amber-600" title="Retire Asset"><Trash2 className="h-4 w-4" /></button>}
                    {can('asset.delete') && <button onClick={() => setDeleteTarget({ id: a.id, assetCode: a.assetCode, assetName: a.assetName })} className="rounded p-1 text-slate-400 hover:text-red-600" title="Delete Permanently"><XCircle className="h-4 w-4" /></button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {isLoading && <div className="py-12 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-400" /></div>}
        {isError && <div className="py-12 text-center text-red-500">{(error as any)?.message || 'Failed to load'}</div>}
        {!isLoading && !isError && (!data?.data || data.data.length === 0) && <div className="py-12 text-center text-slate-400">No assets found.</div>}
        {!isLoading && !isError && data?.data?.map((a: any) => (
          <div key={a.id} className="rounded-lg border border-slate-200 bg-white p-4" onClick={() => navigate(`/assets/${a.id}`)}>
            <div className="mb-2 font-mono text-xs text-slate-400">{a.assetCode}</div>
            <div className="mb-2 font-medium text-slate-900">{a.assetName}</div>
            {a.categoryName && <div className="mb-2 text-xs text-slate-500">{a.categoryName}</div>}
            <div className="flex flex-wrap gap-2">
              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${CONDITION_STYLES[a.condition] || 'bg-slate-100 text-slate-600'}`}>{a.condition?.replace(/_/g, ' ')}</span>
              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[a.status] || 'bg-slate-100 text-slate-600'}`}>{a.status?.replace(/_/g, ' ')}</span>
            </div>
            {can('asset.retire') && (
              <button
                onClick={(e) => { e.stopPropagation(); setRetireTarget({ id: a.id, assetCode: a.assetCode, assetName: a.assetName }); }}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-amber-200 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50"
              >
                <Trash2 className="h-3.5 w-3.5" /> Retire
              </button>
            )}
            {can('asset.delete') && (
              <button
                onClick={(e) => { e.stopPropagation(); setDeleteTarget({ id: a.id, assetCode: a.assetCode, assetName: a.assetName }); }}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
              >
                <XCircle className="h-3.5 w-3.5" /> Delete Permanently
              </button>
            )}
          </div>
        ))}
      </div>

      {data?.meta && data.meta.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
          <span>Page {data.meta.page} of {data.meta.totalPages} ({data.meta.total} total)</span>
          <div className="flex items-center gap-2">
            <button disabled={!data.meta.hasPreviousPage} onClick={() => setPage(p => p - 1)} className="rounded-lg border border-slate-300 p-2 disabled:opacity-30 hover:bg-slate-50"><ChevronLeft className="h-4 w-4" /></button>
            <button disabled={!data.meta.hasNextPage} onClick={() => setPage(p => p + 1)} className="rounded-lg border border-slate-300 p-2 disabled:opacity-30 hover:bg-slate-50"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>
      )}

      <RetireDialog
        open={!!retireTarget}
        assetCode={retireTarget?.assetCode ?? ''}
        assetName={retireTarget?.assetName ?? ''}
        isSubmitting={retireMut.isPending}
        onClose={() => setRetireTarget(null)}
        onConfirm={(payload) => retireMut.mutate(payload)}
      />

      <DeleteDialog
        open={!!deleteTarget}
        assetCode={deleteTarget?.assetCode ?? ''}
        assetName={deleteTarget?.assetName ?? ''}
        isSubmitting={deleteMut.isPending}
        onClose={() => setDeleteTarget(null)}
        onConfirm={(payload) => deleteMut.mutate(payload)}
      />
    </div>
  );
}
