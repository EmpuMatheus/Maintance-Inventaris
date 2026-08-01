import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Boxes, Package, RefreshCw, Truck, Wrench } from 'lucide-react';
import { getInventoryReport, reportKeys } from '../api/reports';
import ReportLayout from '../components/ReportLayout';
import ExportButton from '../components/ExportButton';
import InventoryReportFiltersComponent from '../components/InventoryReportFilters';
import ReportSummaryCards from '../components/ReportSummaryCards';
import InventoryReportTable from '../components/InventoryReportTable';
import type { InventoryReportFilters } from '../types';

const INITIAL_FILTERS: InventoryReportFilters = { page: 1, limit: 25, sortBy: 'created_at', sortOrder: 'desc' };

export default function InventoryReportPage() {
  const [filters, setFilters] = useState<InventoryReportFilters>(INITIAL_FILTERS);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: reportKeys.inventory(filters),
    queryFn: () => getInventoryReport(filters),
  });

  const onChange = (patch: Partial<InventoryReportFilters>) => setFilters((f) => ({ ...f, ...patch }));
  const onReset = () => setFilters(INITIAL_FILTERS);
  const s = data?.summary;

  const cards = [
    { key: 'total', label: 'Total Assets', value: s?.totalAssets ?? 0, icon: <Boxes className="h-4 w-4" />, tone: 'bg-indigo-50 text-indigo-600' },
    { key: 'available', label: 'Available', value: s?.available ?? 0, icon: <Package className="h-4 w-4" />, tone: 'bg-blue-50 text-blue-600' },
    { key: 'assigned', label: 'Assigned', value: s?.assigned ?? 0, icon: <Truck className="h-4 w-4" />, tone: 'bg-violet-50 text-violet-600' },
    { key: 'maintenance', label: 'Maintenance', value: s?.maintenance ?? 0, icon: <Wrench className="h-4 w-4" />, tone: 'bg-amber-50 text-amber-600' },
    { key: 'retired', label: 'Retired', value: s?.retired ?? 0, icon: <RefreshCw className="h-4 w-4" />, tone: 'bg-slate-100 text-slate-600' },
  ];
  const groups = [
    { label: 'Good', value: s?.good ?? 0, cls: 'bg-green-50 text-green-700' },
    { label: 'Fair', value: s?.fair ?? 0, cls: 'bg-yellow-50 text-yellow-700' },
    { label: 'Poor', value: s?.poor ?? 0, cls: 'bg-orange-50 text-orange-700' },
    { label: 'Critical', value: s?.critical ?? 0, cls: 'bg-red-100 text-red-800' },
    { label: 'Total', value: s?.totalAssets ?? 0, cls: 'bg-indigo-50 text-indigo-700' },
    { label: 'In Maintenance', value: s?.maintenance ?? 0, cls: 'bg-amber-50 text-amber-700' },
  ];

  return (
    <ReportLayout
      title="Inventory Report"
      description="Full inventory overview with filters, summary and server-side pagination."
      actions={<ExportButton report="inventory" filters={filters as Record<string, unknown>} />}
    >
      <InventoryReportFiltersComponent value={filters} onChange={onChange} onReset={onReset} />

      {isLoading && !data ? (
        <div className="mb-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
            ))}
          </div>
        </div>
      ) : (
        <ReportSummaryCards cards={cards} groups={groups} />
      )}

      <InventoryReportTable
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
    </ReportLayout>
  );
}
