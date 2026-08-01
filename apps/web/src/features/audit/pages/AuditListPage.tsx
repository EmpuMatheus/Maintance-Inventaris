import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { listAudits, getAuditSummary, auditKeys } from '../api/audit';
import AuditFilters from '../components/AuditFilters';
import AuditSummaryCards from '../components/AuditSummaryCards';
import ReportTable from '@/features/reports/components/ReportTable';
import type { AuditFilters as Filters, AuditLog } from '../types';

const INITIAL: Filters = { page: 1, limit: 25 };

const MODULE_STYLES: Record<string, string> = {
  AUTH: 'bg-indigo-50 text-indigo-700',
  USER: 'bg-blue-50 text-blue-700',
  ROLE: 'bg-violet-50 text-violet-700',
  MASTER_DATA: 'bg-teal-50 text-teal-700',
  INVENTORY: 'bg-emerald-50 text-emerald-700',
  ASSIGNMENT: 'bg-cyan-50 text-cyan-700',
  MOVEMENT: 'bg-sky-50 text-sky-700',
  MAINTENANCE: 'bg-amber-50 text-amber-700',
  SCHEDULE: 'bg-orange-50 text-orange-700',
  TICKET: 'bg-pink-50 text-pink-700',
  REPORT: 'bg-lime-50 text-lime-700',
  SYSTEM: 'bg-slate-100 text-slate-600',
};

function formatDateTime(value?: string): string {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function AuditListPage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<Filters>(INITIAL);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: auditKeys.list(filters),
    queryFn: () => listAudits(filters),
  });

  const { data: summary } = useQuery({ queryKey: auditKeys.summary, queryFn: getAuditSummary });

  const onChange = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }));
  const onPageChange = (p: number) => setFilters((f) => ({ ...f, page: p }));
  const onSort = (sortBy: string, sortOrder: 'asc' | 'desc') => setFilters((f) => ({ ...f, sortBy, sortOrder, page: 1 }));

  const columns = [
    { key: 'auditCode', label: 'Audit Code', sortable: true, render: (a: AuditLog) => <span className="font-mono text-xs text-indigo-600">{a.auditCode}</span> },
    { key: 'module', label: 'Module', render: (a: AuditLog) => <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${MODULE_STYLES[a.module] || 'bg-slate-100 text-slate-600'}`}>{a.module}</span> },
    { key: 'action', label: 'Action', sortable: true, render: (a: AuditLog) => <span className="text-xs font-medium text-slate-700">{a.action}</span> },
    { key: 'description', label: 'Description', render: (a: AuditLog) => <span className="line-clamp-1 max-w-72 text-slate-600">{a.description || '-'}</span> },
    { key: 'entityType', label: 'Entity', render: (a: AuditLog) => <span className="text-xs text-slate-500">{a.entityType}</span> },
    { key: 'performedByName', label: 'Performed By', render: (a: AuditLog) => a.performedByName || '—' },
    { key: 'createdAt', label: 'Created', sortable: true, render: (a: AuditLog) => <span className="text-xs text-slate-400">{formatDateTime(a.createdAt)}</span> },
  ];

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Audit Logs</h1>
        <p className="mt-1 text-sm text-slate-500">Immutable record of actions across all modules.</p>
      </div>

      <AuditSummaryCards summary={summary?.data} />

      <AuditFilters value={filters} onChange={onChange} onReset={() => setFilters(INITIAL)} />

      <ReportTable
        columns={columns}
        items={data?.data ?? []}
        rowKey={(a) => a.id}
        isLoading={isLoading}
        isError={isError}
        errorMessage={(error as Error)?.message}
        onRetry={() => refetch()}
        page={filters.page ?? 1}
        meta={data?.meta}
        onPageChange={onPageChange}
        onSort={onSort}
        onRowClick={(a) => navigate(`/audit/${a.id}`)}
        emptyMessage="No audit events found."
      />
    </div>
  );
}
