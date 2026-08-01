import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getMaintenanceCostReport, reportKeys } from '../api/reports';
import ExportButton from '../components/ExportButton';
import MaintenanceCostFilters from '../components/MaintenanceCostFilters';
import MaintenanceCostSummaryCards from '../components/MaintenanceCostSummaryCards';
import MaintenanceCostCharts from '../components/MaintenanceCostCharts';
import MaintenanceCostTable from '../components/MaintenanceCostTable';
import type { MaintenanceCostFilters as Filters } from '../types';

const INITIAL_FILTERS: Filters = { page: 1, limit: 25, sortBy: 'total_cost', sortOrder: 'desc' };

export default function MaintenanceCostReportPage() {
  const [filters, setFilters] = useState<Filters>(INITIAL_FILTERS);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: reportKeys.maintenanceCost(filters),
    queryFn: () => getMaintenanceCostReport(filters),
  });

  const onChange = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }));
  const onReset = () => setFilters(INITIAL_FILTERS);

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Maintenance Cost Report</h1>
          <p className="mt-1 text-sm text-slate-500">Maintenance cost analysis by asset, category, department, vendor and time period.</p>
        </div>
        <ExportButton report="maintenance-cost" filters={filters as Record<string, unknown>} />
      </div>

      <MaintenanceCostFilters value={filters} onChange={onChange} onReset={onReset} />

      {isLoading && !data ? (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
          ))}
        </div>
      ) : (
        <MaintenanceCostSummaryCards summary={data?.summary} />
      )}

      {isLoading && !data ? (
        <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-60 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
          ))}
        </div>
      ) : (
        <MaintenanceCostCharts analytics={data?.analytics} summary={data?.summary} />
      )}

      <MaintenanceCostTable
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
