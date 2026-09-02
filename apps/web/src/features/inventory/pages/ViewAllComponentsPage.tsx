import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Search, Loader2, Eye, ArrowLeft } from 'lucide-react';
import { apiGet } from '@/lib/api-client';

interface Component {
  id: string;
  componentName: string;
  model: string;
  serialNumber: string;
  assetId: string;
  assetCode?: string;
  assetName?: string;
}

interface ComponentsResponse {
  success: boolean;
  data: Component[];
}

export default function ViewAllComponentsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const { data: response, isLoading, isError, error } = useQuery({
    queryKey: ['all-components', { search, page }],
    queryFn: async () => {
      const result = await apiGet<ComponentsResponse>('/assets/components', {
        search: search || undefined,
        page,
        limit: pageSize,
      });
      return result;
    },
  });

  const components = response?.data || [];
  const isSearching = search.trim().length > 0;

  // Client-side filtering if search is provided
  const filteredComponents = isSearching
    ? components.filter(
        (c: Component) =>
          c.componentName.toLowerCase().includes(search.toLowerCase()) ||
          c.model.toLowerCase().includes(search.toLowerCase()) ||
          c.serialNumber.toLowerCase().includes(search.toLowerCase()) ||
          (c.assetCode?.toLowerCase() || '').includes(search.toLowerCase()) ||
          (c.assetName?.toLowerCase() || '').includes(search.toLowerCase())
      )
    : components;

  const handleViewAsset = (assetId: string) => {
    navigate(`/assets/${assetId}`);
  };

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6">
      <button
        onClick={() => navigate('/inventory')}
        className="mb-4 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Inventory
      </button>

      <div className="mb-6">
        <h1 className="mb-4 text-2xl font-bold text-slate-900">All Components</h1>
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, model, serial number, or asset..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-slate-300 pl-10 pr-4 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="flex min-h-96 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      )}

      {isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-600">
          {(error as Error)?.message || 'Failed to load components'}
        </div>
      )}

      {!isLoading && !isError && filteredComponents.length === 0 && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center">
          <p className="text-slate-600">
            {isSearching ? 'No components found matching your search.' : 'No components available.'}
          </p>
        </div>
      )}

      {!isLoading && !isError && filteredComponents.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600">Component Name</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600">Model</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600">Serial Number</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600">Asset</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredComponents.map((comp: Component) => (
                <tr key={comp.id} className="hover:bg-slate-50">
                  <td className="px-6 py-3 text-sm font-medium text-slate-900">{comp.componentName}</td>
                  <td className="px-6 py-3 text-sm text-slate-600">{comp.model}</td>
                  <td className="px-6 py-3 text-sm text-slate-600">{comp.serialNumber}</td>
                  <td className="px-6 py-3 text-sm">
                    <div className="text-slate-900">{comp.assetName || 'Unknown Asset'}</div>
                    <div className="text-xs text-slate-500">{comp.assetCode}</div>
                  </td>
                  <td className="px-6 py-3 text-right">
                    <button
                      onClick={() => handleViewAsset(comp.assetId)}
                      className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-600 hover:bg-indigo-100"
                    >
                      <Eye className="h-4 w-4" />
                      Detail
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!isLoading && !isError && filteredComponents.length > 0 && (
        <div className="mt-4 text-center text-sm text-slate-600">
          Showing {filteredComponents.length} component{filteredComponents.length !== 1 ? 's' : ''}
          {isSearching && ` matching "${search}"`}
        </div>
      )}
    </div>
  );
}
