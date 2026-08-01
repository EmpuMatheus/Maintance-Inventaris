import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { getAudit, auditKeys } from '../api/audit';
import AuditTimeline from '../components/AuditTimeline';
import AuditDiffViewer from '../components/AuditDiffViewer';
import type { AuditLog } from '../types';

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

export default function AuditDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: auditKeys.detail(id ?? ''),
    queryFn: () => getAudit(id!),
    enabled: !!id,
  });

  if (isLoading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>;
  if (isError) return <div className="p-6 text-center text-red-500">{(error as Error)?.message || 'Unable to load audit log.'}</div>;
  if (!data?.data) return <div className="p-6 text-center text-slate-400">Audit log not found.</div>;

  const a: AuditLog = data.data;

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-6">
      <button onClick={() => navigate('/audit')} className="mb-4 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" /> Audit Logs
      </button>

      <div className="mb-6 rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-mono text-lg font-bold text-slate-900">{a.auditCode}</h1>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${MODULE_STYLES[a.module] || 'bg-slate-100 text-slate-600'}`}>{a.module}</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{a.action}</span>
        </div>
        {a.description && <p className="mt-2 text-sm text-slate-700">{a.description}</p>}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">Details</h2>
          <AuditTimeline audit={a} />
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-5 md:col-span-2">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">Data Changes</h2>
          <AuditDiffViewer oldData={a.oldData} newData={a.newData} />
        </div>
      </div>
    </div>
  );
}
