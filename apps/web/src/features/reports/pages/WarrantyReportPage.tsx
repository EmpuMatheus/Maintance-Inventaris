import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Clock, Package, ShieldAlert, ShieldCheck } from 'lucide-react';
import { getWarrantyReport, reportKeys } from '../api/reports';
import ReportLayout from '../components/ReportLayout';
import ReportFilters from '../components/ReportFilters';
import ReportSummaryCards from '../components/ReportSummaryCards';
import ReportTable from '../components/ReportTable';
import { BarChartCard, PieChartCard } from '../components/ReportCharts';
import ExportButton from '../components/ExportButton';
import type { WarrantyFilters, WarrantyItem } from '../types';

const INITIAL: WarrantyFilters = { page: 1, limit: 25, daysThreshold: 90 };

const FIELDS = [
  { key: 'keyword', label: 'Search code, name, serial...', type: 'search' as const },
  { key: 'categoryId', label: 'All Categories', type: 'master' as const, resource: 'categories' },
  { key: 'vendorId', label: 'All Vendors', type: 'master' as const, resource: 'vendors' },
  { key: 'departmentId', label: 'All Departments', type: 'master' as const, resource: 'departments' },
  { key: 'location', label: 'Location', type: 'location' as const },
  { key: 'warrantyStatus', label: 'Warranty Status', type: 'select' as const, options: [
    { value: 'ACTIVE', label: 'Active' },
    { value: 'EXPIRING_SOON', label: 'Expiring Soon' },
    { value: 'EXPIRED', label: 'Expired' },
  ] },
];

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'bg-green-50 text-green-700',
  EXPIRING_SOON: 'bg-amber-50 text-amber-700',
  EXPIRED: 'bg-red-50 text-red-700',
};

function formatDate(value?: string | null): string {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function WarrantyReportPage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<WarrantyFilters>(INITIAL);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: reportKeys.warranty(filters),
    queryFn: () => getWarrantyReport(filters),
  });

  const onFiltersChange = (patch: Record<string, string | undefined>) => setFilters((f) => ({ ...f, ...patch, page: 1 }));
  const onPageChange = (p: number) => setFilters((f) => ({ ...f, page: p }));
  const onSort = (sortBy: string, sortOrder: 'asc' | 'desc') => setFilters((f) => ({ ...f, sortBy, sortOrder, page: 1 }));
  const onReset = () => setFilters(INITIAL);
  const s = data?.summary;

  const cards = [
    { key: 'total', label: 'Total', value: s?.total ?? 0, icon: <Package className="h-4 w-4" />, tone: 'bg-indigo-50 text-indigo-600' },
    { key: 'active', label: 'Active', value: s?.active ?? 0, icon: <ShieldCheck className="h-4 w-4" />, tone: 'bg-green-50 text-green-600' },
    { key: 'expiringSoon', label: 'Expiring Soon', value: s?.expiringSoon ?? 0, icon: <Clock className="h-4 w-4" />, tone: 'bg-amber-50 text-amber-600' },
    { key: 'expired', label: 'Expired', value: s?.expired ?? 0, icon: <ShieldAlert className="h-4 w-4" />, tone: 'bg-red-50 text-red-600' },
    { key: 'avgDays', label: 'Avg Days Left', value: s?.avgDaysRemaining ?? 0, icon: <CheckCircle2 className="h-4 w-4" />, tone: 'bg-violet-50 text-violet-600' },
  ];

  const pieData = [
    { name: 'Active', value: s?.active ?? 0, color: '#22c55e' },
    { name: 'Expiring Soon', value: s?.expiringSoon ?? 0, color: '#f59e0b' },
    { name: 'Expired', value: s?.expired ?? 0, color: '#ef4444' },
  ].filter((d) => d.value > 0);

  const columns = [
    { key: 'assetCode', label: 'Asset Code', sortable: true, render: (i: WarrantyItem) => <span className="font-mono text-xs text-indigo-600">{i.assetCode}</span> },
    { key: 'assetName', label: 'Asset Name', sortable: true, render: (i: WarrantyItem) => <span className="font-medium text-slate-900">{i.assetName}</span> },
    { key: 'category', label: 'Category', render: (i: WarrantyItem) => i.category || '-' },
    { key: 'vendor', label: 'Vendor', render: (i: WarrantyItem) => i.vendor || '-' },
    { key: 'warrantyEnd', label: 'Warranty End', sortable: true, render: (i: WarrantyItem) => formatDate(i.warrantyEnd) },
    { key: 'daysRemaining', label: 'Days Left', sortable: true, render: (i: WarrantyItem) => <span className={i.daysRemaining < 0 ? 'text-red-600' : i.daysRemaining <= 90 ? 'text-amber-600' : 'text-slate-600'}>{i.daysRemaining}</span> },
    { key: 'status', label: 'Status', sortable: true, render: (i: WarrantyItem) => <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[i.status] || 'bg-slate-100 text-slate-600'}`}>{i.status.replace(/_/g, ' ')}</span> },
  ];

  return (
    <ReportLayout
      title="Warranty Report"
      description="Warranty coverage: active, expiring soon and expired assets with vendor summary."
      actions={<ExportButton report="warranty" filters={filters as Record<string, unknown>} />}
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
          {Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-56 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />)}
        </div>
      ) : (
        <div className="mb-4 grid gap-4 lg:grid-cols-3">
          <PieChartCard title="Warranty Status" data={pieData} empty={pieData.length === 0} />
          <div className="lg:col-span-2">
            <BarChartCard title="Warranty by Vendor" data={(data?.analytics.byVendor ?? []).map((v) => ({ name: v.name, value: v.total }))} color="#6366f1" />
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
        emptyMessage="No warranty data found."
      />
    </ReportLayout>
  );
}
