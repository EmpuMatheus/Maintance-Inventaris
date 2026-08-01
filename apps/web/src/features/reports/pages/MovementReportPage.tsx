import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftRight, Package, Undo2, User } from 'lucide-react';
import { getMovementReport, reportKeys } from '../api/reports';
import ReportLayout from '../components/ReportLayout';
import ReportFilters from '../components/ReportFilters';
import ReportSummaryCards from '../components/ReportSummaryCards';
import ReportTable from '../components/ReportTable';
import { PieChartCard } from '../components/ReportCharts';
import ExportButton from '../components/ExportButton';
import type { MovementFilters, MovementItem } from '../types';

const INITIAL: MovementFilters = { page: 1, limit: 25 };

const FIELDS = [
  { key: 'keyword', label: 'Search code, asset...', type: 'search' as const },
  { key: 'location', label: 'Location', type: 'location' as const },
  { key: 'dateRange', label: 'Date Range', type: 'dateRange' as const },
];

const TYPE_STYLES: Record<string, string> = {
  MOVEMENT: 'bg-blue-50 text-blue-700',
  ASSIGNMENT: 'bg-indigo-50 text-indigo-700',
  RETURN: 'bg-green-50 text-green-700',
};

function formatDate(value?: string | null): string {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function MovementReportPage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<MovementFilters>(INITIAL);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: reportKeys.movement(filters),
    queryFn: () => getMovementReport(filters),
  });

  const onFiltersChange = (patch: Record<string, string | undefined>) => setFilters((f) => ({ ...f, ...patch, page: 1 }));
  const onPageChange = (p: number) => setFilters((f) => ({ ...f, page: p }));
  const onSort = (sortBy: string, sortOrder: 'asc' | 'desc') => setFilters((f) => ({ ...f, sortBy, sortOrder, page: 1 }));
  const onReset = () => setFilters(INITIAL);
  const s = data?.summary;

  const cards = [
    { key: 'total', label: 'Total Events', value: s?.total ?? 0, icon: <ArrowLeftRight className="h-4 w-4" />, tone: 'bg-indigo-50 text-indigo-600' },
    { key: 'movements', label: 'Movements', value: s?.totalMovements ?? 0, icon: <Package className="h-4 w-4" />, tone: 'bg-blue-50 text-blue-600' },
    { key: 'assignments', label: 'Assignments', value: s?.totalAssignments ?? 0, icon: <User className="h-4 w-4" />, tone: 'bg-violet-50 text-violet-600' },
    { key: 'returns', label: 'Returns', value: s?.totalReturns ?? 0, icon: <Undo2 className="h-4 w-4" />, tone: 'bg-green-50 text-green-600' },
    { key: 'assets', label: 'Assets Moved', value: s?.assetsMoved ?? 0, icon: <Package className="h-4 w-4" />, tone: 'bg-amber-50 text-amber-600' },
  ];

  const columns = [
    { key: 'type', label: 'Type', sortable: true, render: (i: MovementItem) => <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_STYLES[i.type] || 'bg-slate-100 text-slate-600'}`}>{i.type}</span> },
    { key: 'assetCode', label: 'Asset Code', sortable: true, render: (i: MovementItem) => <span className="font-mono text-xs text-indigo-600">{i.assetCode || '-'}</span> },
    { key: 'assetName', label: 'Asset Name', render: (i: MovementItem) => <span className="font-medium text-slate-900">{i.assetName || '-'}</span> },
    { key: 'fromLabel', label: 'From', render: (i: MovementItem) => i.fromLabel || '—' },
    { key: 'toLabel', label: 'To', render: (i: MovementItem) => i.toLabel || '—' },
    { key: 'eventDate', label: 'Date', sortable: true, render: (i: MovementItem) => formatDate(i.eventDate) },
    { key: 'performedBy', label: 'Performed By', render: (i: MovementItem) => i.performedBy || '—' },
  ];

  return (
    <ReportLayout
      title="Movement Report"
      description="Assignment and transfer history across assets, departments and locations."
      actions={<ExportButton report="movement" filters={filters as Record<string, unknown>} />}
    >
      <ReportFilters fields={FIELDS} value={filters as unknown as Record<string, string | undefined>} onChange={onFiltersChange} onReset={onReset} />

      {isLoading && !data ? (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />)}
        </div>
      ) : (
        <ReportSummaryCards cards={cards} cols="lg:grid-cols-5" />
      )}

      {isLoading && !data ? (
        <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="h-56 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
        </div>
      ) : (
        <div className="mb-4 grid gap-4 lg:grid-cols-3">
          <PieChartCard title="Events by Type" data={(data?.analytics.byType ?? []).filter((d) => d.value > 0)} />
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
        onRowClick={(i) => i.assetId && navigate(`/assets/${i.assetId}`)}
        emptyMessage="No movements or assignments recorded."
      />
    </ReportLayout>
  );
}
