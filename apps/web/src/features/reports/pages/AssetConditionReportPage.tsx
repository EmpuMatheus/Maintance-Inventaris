import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAssetConditionReport, reportKeys } from '../api/reports';
import ExportButton from '../components/ExportButton';
import AssetConditionFilters from '../components/AssetConditionFilters';
import AssetConditionSummaryCards from '../components/AssetConditionSummaryCards';
import AssetConditionCharts from '../components/AssetConditionCharts';
import AssetConditionTable from '../components/AssetConditionTable';
import type { AssetConditionFilters as Filters } from '../types';

const INITIAL_FILTERS: Filters = { page: 1, limit: 25, sortBy: 'created_at', sortOrder: 'desc' };

export default function AssetConditionReportPage() {
  const [filters, setFilters] = useState<Filters>(INITIAL_FILTERS);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: reportKeys.assetCondition(filters),
    queryFn: () => getAssetConditionReport(filters),
  });

  const onChange = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }));
  const onReset = () => setFilters(INITIAL_FILTERS);

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Asset Condition Report</h1>
          <p className="mt-1 text-sm text-slate-500">Current condition of all assets with history and filters.</p>
        </div>
        <ExportButton report="asset-condition" filters={filters as Record<string, unknown>} />
      </div>

      <AssetConditionFilters value={filters} onChange={onChange} onReset={onReset} />

      {isLoading && !data ? (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
          ))}
        </div>
      ) : (
        <AssetConditionSummaryCards summary={data?.summary} />
      )}

      {isLoading && !data ? (
        <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-56 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
          ))}
        </div>
      ) : (
        <AssetConditionCharts analytics={data?.analytics} summary={data?.summary} />
      )}

      <AssetConditionTable
        items={data?.items ?? []}
        isLoading={isLoading}
        isError={isError}
        errorMessage={(error as Error)?.message}
        onRetry={() => refetch()}
        page={filters.page ?? 1}
        meta={data?.meta}
        onPageChange={(p) => onChange({ page: p })}
        sortBy={filters.sortBy}
        sortOrder={filters.sortOrder}
        onSort={(sortBy, sortOrder) => onChange({ sortBy, sortOrder, page: 1 })}
      />
    </div>
  );
}
