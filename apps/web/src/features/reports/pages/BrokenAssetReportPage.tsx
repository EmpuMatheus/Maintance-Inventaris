import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CircleAlert, Clock, Package, Wrench, XCircle } from 'lucide-react';
import { getBrokenAssetReport, reportKeys } from '../api/reports';
import ReportLayout from '../components/ReportLayout';
import ReportFilters from '../components/ReportFilters';
import ReportSummaryCards from '../components/ReportSummaryCards';
import ReportTable from '../components/ReportTable';
import { BarChartCard, PieChartCard } from '../components/ReportCharts';
import ExportButton from '../components/ExportButton';
import type { BrokenAssetFilters, BrokenAssetItem } from '../types';

const INITIAL: BrokenAssetFilters = { page: 1, limit: 25 };

const FIELDS = [
  { key: 'keyword', label: 'Search code, name, serial...', type: 'search' as const },
  { key: 'categoryId', label: 'All Categories', type: 'master' as const, resource: 'categories' },
  { key: 'departmentId', label: 'All Departments', type: 'master' as const, resource: 'departments' },
  { key: 'location', label: 'Location', type: 'location' as const },
  { key: 'condition', label: 'Condition', type: 'condition' as const },
  { key: 'status', label: 'Status', type: 'status' as const },
  { key: 'assignedTo', label: 'All PIC', type: 'master' as const, resource: 'users' },
];

const CONDITION_STYLES: Record<string, string> = {
  NEED_ATTENTION: 'bg-orange-50 text-orange-700',
  BROKEN: 'bg-red-50 text-red-700',
  CRITICAL: 'bg-red-100 text-red-800',
};

function currency(v: number): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v);
}

export default function BrokenAssetReportPage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<BrokenAssetFilters>(INITIAL);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: reportKeys.brokenAsset(filters),
    queryFn: () => getBrokenAssetReport(filters),
  });

  const onFiltersChange = (patch: Record<string, string | undefined>) => setFilters((f) => ({ ...f, ...patch, page: 1 }));
  const onPageChange = (p: number) => setFilters((f) => ({ ...f, page: p }));
  const onSort = (sortBy: string, sortOrder: 'asc' | 'desc') => setFilters((f) => ({ ...f, sortBy, sortOrder, page: 1 }));
  const onReset = () => setFilters(INITIAL);
  const s = data?.summary;

  const cards = [
    { key: 'total', label: 'Total', value: s?.total ?? 0, icon: <Package className="h-4 w-4" />, tone: 'bg-indigo-50 text-indigo-600' },
    { key: 'broken', label: 'Broken', value: s?.broken ?? 0, icon: <XCircle className="h-4 w-4" />, tone: 'bg-red-50 text-red-600' },
    { key: 'critical', label: 'Critical', value: s?.critical ?? 0, icon: <AlertTriangle className="h-4 w-4" />, tone: 'bg-red-100 text-red-700' },
    { key: 'needAttention', label: 'Need Attention', value: s?.needAttention ?? 0, icon: <CircleAlert className="h-4 w-4" />, tone: 'bg-orange-50 text-orange-600' },
    { key: 'repairCost', label: 'Repair Cost', value: currency(s?.totalRepairCost ?? 0), icon: <Wrench className="h-4 w-4" />, tone: 'bg-amber-50 text-amber-600' },
    { key: 'avgCost', label: 'Avg Repair Cost', value: currency(s?.averageRepairCost ?? 0), icon: <Clock className="h-4 w-4" />, tone: 'bg-violet-50 text-violet-600' },
  ];

  const pieData = [
    { name: 'Broken', value: s?.broken ?? 0, color: '#ef4444' },
    { name: 'Critical', value: s?.critical ?? 0, color: '#b91c1c' },
    { name: 'Need Attention', value: s?.needAttention ?? 0, color: '#f97316' },
  ].filter((d) => d.value > 0);

  const columns = [
    { key: 'assetCode', label: 'Asset Code', sortable: true, render: (i: BrokenAssetItem) => <span className="font-mono text-xs text-indigo-600">{i.assetCode}</span> },
    { key: 'assetName', label: 'Asset Name', sortable: true, render: (i: BrokenAssetItem) => <span className="font-medium text-slate-900">{i.assetName}</span> },
    { key: 'category', label: 'Category', render: (i: BrokenAssetItem) => i.category || '-' },
    { key: 'condition', label: 'Condition', sortable: true, render: (i: BrokenAssetItem) => <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${CONDITION_STYLES[i.condition] || 'bg-slate-100 text-slate-600'}`}>{i.condition.replace(/_/g, ' ')}</span> },
    { key: 'status', label: 'Status', sortable: true, render: (i: BrokenAssetItem) => i.status.replace(/_/g, ' ') },
    { key: 'maintenanceCount', label: 'Maint', render: (i: BrokenAssetItem) => i.maintenanceCount },
    { key: 'repairCost', label: 'Repair Cost', render: (i: BrokenAssetItem) => currency(i.repairCost) },
    { key: 'downtimeHours', label: 'Downtime (h)', render: (i: BrokenAssetItem) => i.downtimeHours },
    { key: 'recommendation', label: 'Recommendation', render: (i: BrokenAssetItem) => <span className={`text-xs font-medium ${i.recommendation === 'Replace' ? 'text-red-600' : i.recommendation === 'Repair' ? 'text-amber-600' : 'text-slate-500'}`}>{i.recommendation}</span> },
  ];

  return (
    <ReportLayout
      title="Broken Asset Report"
      description="Damaged, critical and poor assets with repair cost, downtime and replacement recommendation."
      actions={<ExportButton report="broken-asset" filters={filters as Record<string, unknown>} />}
    >
      <ReportFilters fields={FIELDS} value={filters as unknown as Record<string, string | undefined>} onChange={onFiltersChange} onReset={onReset} />

      {isLoading && !data ? (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />)}
        </div>
      ) : (
        <ReportSummaryCards cards={cards} cols="lg:grid-cols-6" />
      )}

      {isLoading && !data ? (
        <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-56 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />)}
        </div>
      ) : (
        <div className="mb-4 grid gap-4 lg:grid-cols-3">
          <PieChartCard title="Condition Distribution" data={pieData} colors={{} as Record<string, string>} empty={pieData.length === 0} />
          <div className="lg:col-span-2">
            <BarChartCard title="Broken Assets by Category" data={(data?.analytics.byCategory ?? []).map((b) => ({ name: b.name, value: b.value }))} color="#ef4444" />
          </div>
        </div>
      )}

      <ReportTable
        columns={columns}
        items={data?.items ?? []}
        rowKey={(i) => i.id}
        isLoading={isLoading}
        isError={isError}
        errorMessage={(error as Error)?.message}
        onRetry={() => refetch()}
        page={filters.page ?? 1}
        meta={data?.meta}
        onPageChange={onPageChange}
        onSort={onSort}
        onRowClick={(i) => navigate(`/assets/${i.id}`)}
      />
    </ReportLayout>
  );
}
