import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getMaintenanceReport, reportKeys } from '../api/reports';
import ExportButton from '../components/ExportButton';
import MaintenanceReportFilters from '../components/MaintenanceReportFilters';
import MaintenanceSummaryCards from '../components/MaintenanceSummaryCards';
import MaintenanceReportTable from '../components/MaintenanceReportTable';
import type { MaintenanceReportFilters as Filters } from '../types';

const INITIAL_FILTERS: Filters = { page: 1, limit: 25, sortBy: 'created_at', sortOrder: 'desc' };

export default function MaintenanceReportPage() {
  const [filters, setFilters] = useState<Filters>(INITIAL_FILTERS);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: reportKeys.maintenance(filters),
    queryFn: () => getMaintenanceReport(filters),
  });

  const onChange = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }));
  const onReset = () => setFilters(INITIAL_FILTERS);

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Maintenance Report</h1>
          <p className="mt-1 text-sm text-slate-500">Corrective and preventive maintenance history with summary and filters.</p>
        </div>
        <ExportButton report="maintenance" filters={filters as Record<string, unknown>} />
      </div>

      <MaintenanceReportFilters value={filters} onChange={onChange} onReset={onReset} />

      {isLoading && !data ? (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
          ))}
        </div>
      ) : (
        <MaintenanceSummaryCards summary={data?.summary} />
      )}

      <MaintenanceReportTable
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
