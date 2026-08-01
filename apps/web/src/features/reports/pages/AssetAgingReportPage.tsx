import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { CalendarClock, Hourglass, Package, RefreshCw } from 'lucide-react';
import { getAssetAgingReport, reportKeys } from '../api/reports';
import ReportLayout from '../components/ReportLayout';
import ReportFilters from '../components/ReportFilters';
import ReportSummaryCards from '../components/ReportSummaryCards';
import ReportTable from '../components/ReportTable';
import { BarChartCard } from '../components/ReportCharts';
import ExportButton from '../components/ExportButton';
import type { AgingFilters, AgingItem } from '../types';

const INITIAL: AgingFilters = { page: 1, limit: 25, sortBy: 'purchase_date', sortOrder: 'asc' };

const BUCKET_OPTIONS = ['< 1 year', '1-2 years', '2-3 years', '3-5 years', '5-10 years', '> 10 years', 'Unknown'];

const FIELDS = [
  { key: 'keyword', label: 'Search code, name, serial...', type: 'search' as const },
  { key: 'categoryId', label: 'All Categories', type: 'master' as const, resource: 'categories' },
  { key: 'departmentId', label: 'All Departments', type: 'master' as const, resource: 'departments' },
  { key: 'location', label: 'Location', type: 'location' as const },
  { key: 'condition', label: 'Condition', type: 'condition' as const },
  { key: 'status', label: 'Status', type: 'status' as const },
  { key: 'ageBucket', label: 'Age Bucket', type: 'select' as const, options: BUCKET_OPTIONS.map((b) => ({ value: b, label: b })) },
];

function formatDate(value?: string | null): string {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function AssetAgingReportPage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<AgingFilters>(INITIAL);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: reportKeys.assetAging(filters),
    queryFn: () => getAssetAgingReport(filters),
  });

  const onFiltersChange = (patch: Record<string, string | undefined>) => setFilters((f) => ({ ...f, ...patch, page: 1 }));
  const onPageChange = (p: number) => setFilters((f) => ({ ...f, page: p }));
  const onSort = (sortBy: string, sortOrder: 'asc' | 'desc') => setFilters((f) => ({ ...f, sortBy, sortOrder, page: 1 }));
  const onReset = () => setFilters(INITIAL);
  const s = data?.summary;

  const cards = [
    { key: 'total', label: 'Total Assets', value: s?.total ?? 0, icon: <Package className="h-4 w-4" />, tone: 'bg-indigo-50 text-indigo-600' },
    { key: 'avg', label: 'Avg Age (y)', value: s?.avgAgeYears ?? 0, icon: <CalendarClock className="h-4 w-4" />, tone: 'bg-blue-50 text-blue-600' },
    { key: 'oldest', label: 'Oldest (y)', value: s?.oldestAgeYears ?? 0, icon: <Hourglass className="h-4 w-4" />, tone: 'bg-amber-50 text-amber-600' },
    { key: 'replacements', label: 'Replacement Candidates', value: s?.replacementCandidates ?? 0, icon: <RefreshCw className="h-4 w-4" />, tone: 'bg-red-50 text-red-600' },
  ];

  const groups = [
    { label: '< 1y', value: s?.lt1 ?? 0, cls: 'bg-green-50 text-green-700' },
    { label: '1-2y', value: s?.y1_2 ?? 0, cls: 'bg-emerald-50 text-emerald-700' },
    { label: '2-3y', value: s?.y2_3 ?? 0, cls: 'bg-blue-50 text-blue-700' },
    { label: '3-5y', value: s?.y3_5 ?? 0, cls: 'bg-amber-50 text-amber-700' },
    { label: '5-10y', value: s?.y5_10 ?? 0, cls: 'bg-orange-50 text-orange-700' },
    { label: '> 10y', value: s?.gt10 ?? 0, cls: 'bg-red-100 text-red-800' },
    { label: 'Unknown', value: s?.unknown ?? 0, cls: 'bg-slate-100 text-slate-600' },
  ];

  const columns = [
    { key: 'assetCode', label: 'Asset Code', sortable: true, render: (i: AgingItem) => <span className="font-mono text-xs text-indigo-600">{i.assetCode}</span> },
    { key: 'assetName', label: 'Asset Name', sortable: true, render: (i: AgingItem) => <span className="font-medium text-slate-900">{i.assetName}</span> },
    { key: 'category', label: 'Category', render: (i: AgingItem) => i.category || '-' },
    { key: 'department', label: 'Department', render: (i: AgingItem) => i.department || '-' },
    { key: 'purchaseDate', label: 'Purchase Date', sortable: true, render: (i: AgingItem) => formatDate(i.purchaseDate) },
    { key: 'ageYears', label: 'Age (y)', render: (i: AgingItem) => i.ageYears ?? '-' },
    { key: 'ageBucket', label: 'Bucket', render: (i: AgingItem) => i.ageBucket },
    { key: 'condition', label: 'Condition', sortable: true, render: (i: AgingItem) => i.condition.replace(/_/g, ' ') },
    { key: 'replacementCandidate', label: 'Replace', render: (i: AgingItem) => (i.replacementCandidate ? <span className="text-xs font-medium text-red-600">Yes</span> : <span className="text-xs text-slate-400">No</span>) },
  ];

  return (
    <ReportLayout
      title="Asset Aging Report"
      description="Asset age distribution, depreciation age groups and replacement candidates."
      actions={<ExportButton report="asset-aging" filters={filters as Record<string, unknown>} />}
    >
      <ReportFilters fields={FIELDS} value={filters as unknown as Record<string, string | undefined>} onChange={onFiltersChange} onReset={onReset} />

      {isLoading && !data ? (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />)}
        </div>
      ) : (
        <ReportSummaryCards cards={cards} groups={groups} cols="lg:grid-cols-4" />
      )}

      {isLoading && !data ? (
        <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-56 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />)}
        </div>
      ) : (
        <div className="mb-4 grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <BarChartCard title="Assets by Age" data={(data?.analytics.byAge ?? []).map((b) => ({ name: b.name, value: b.value }))} color="#f59e0b" />
          </div>
          <div className="lg:col-span-2">
            <BarChartCard title="Average Age by Category" data={(data?.analytics.byCategory ?? []).map((c) => ({ name: c.name, value: c.avgAgeYears }))} color="#6366f1" />
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
        emptyMessage="No assets found."
      />
    </ReportLayout>
  );
}
