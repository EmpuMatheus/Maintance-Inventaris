import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ExternalLink, Loader2, Pencil, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import {
  getTicket,
  assignTicket,
  startTicket,
  holdTicket,
  resumeTicket,
  resolveTicket,
  closeTicket,
  cancelTicket,
  addTicketComment,
  createTicketMaintenance,
  ticketKeys,
} from '../api/tickets';
import { listMaster } from '@/features/inventory/api/inventory';
import PriorityBadge from '@/features/maintenance/components/PriorityBadge';
import TicketStatusBadge from '../components/TicketStatusBadge';
import CommentsPanel from '../components/CommentsPanel';
import { AssignDialog, CancelDialog, ConfirmDialog, CreateMaintenanceDialog, ResolveDialog, type UserOption } from '../components/dialogs';
import type { Ticket, TicketComment, TicketAssignment } from '../types';

type DialogKey = 'assign' | 'start' | 'hold' | 'resume' | 'resolve' | 'close' | 'cancel' | 'maintenance' | null;

interface WorkflowAction {
  label: string;
  key: Exclude<DialogKey, null>;
  perm: string;
  tone: 'outline' | 'success' | 'danger';
}

const WORKFLOW_ACTIONS: Record<string, WorkflowAction[]> = {
  OPEN: [
    { label: 'Assign Technician', key: 'assign', perm: 'ticket.update', tone: 'outline' },
    { label: 'Cancel', key: 'cancel', perm: 'ticket.update', tone: 'danger' },
  ],
  ASSIGNED: [
    { label: 'Start Work', key: 'start', perm: 'ticket.update', tone: 'outline' },
    { label: 'Reassign', key: 'assign', perm: 'ticket.update', tone: 'outline' },
    { label: 'Cancel', key: 'cancel', perm: 'ticket.update', tone: 'danger' },
  ],
  IN_PROGRESS: [
    { label: 'Put on Hold', key: 'hold', perm: 'ticket.update', tone: 'outline' },
    { label: 'Resolve', key: 'resolve', perm: 'ticket.resolve', tone: 'success' },
    { label: 'Reassign', key: 'assign', perm: 'ticket.update', tone: 'outline' },
    { label: 'Cancel', key: 'cancel', perm: 'ticket.update', tone: 'danger' },
  ],
  ON_HOLD: [
    { label: 'Resume', key: 'resume', perm: 'ticket.update', tone: 'outline' },
    { label: 'Resolve', key: 'resolve', perm: 'ticket.resolve', tone: 'success' },
    { label: 'Reassign', key: 'assign', perm: 'ticket.update', tone: 'outline' },
    { label: 'Cancel', key: 'cancel', perm: 'ticket.update', tone: 'danger' },
  ],
  RESOLVED: [
    { label: 'Close Ticket', key: 'close', perm: 'ticket.update', tone: 'success' },
  ],
  CLOSED: [],
  CANCELLED: [],
};

const BUTTON_TONES: Record<WorkflowAction['tone'], string> = {
  outline: 'border border-slate-300 text-slate-600 hover:bg-slate-50',
  success: 'border border-transparent bg-green-600 text-white hover:bg-green-700',
  danger: 'border border-red-200 text-red-600 hover:bg-red-50',
};

function formatDate(value?: string | null): string {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function TicketDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const qc = useQueryClient();
  const [dialog, setDialog] = useState<DialogKey>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ticketKeys.detail(id ?? ''),
    queryFn: () => getTicket(id!),
    enabled: !!id,
  });

  const { data: users } = useQuery({ queryKey: ['master', 'users'], queryFn: () => listMaster('users', {}) });
  const { data: types } = useQuery({ queryKey: ['master', 'maintenance-types'], queryFn: () => listMaster('maintenance-types') });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ticketKeys.all });
    qc.invalidateQueries({ queryKey: ticketKeys.detail(id ?? '') });
  };
  const closeDialog = () => setDialog(null);

  const mutAssign = useMutation({
    mutationFn: (d: { technicianId: string; notes: string }) => assignTicket(id!, d),
    onSuccess: () => { toast.success('Technician assigned.'); closeDialog(); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const mutStart = useMutation({
    mutationFn: () => startTicket(id!),
    onSuccess: () => { toast.success('Ticket started.'); closeDialog(); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const mutHold = useMutation({
    mutationFn: () => holdTicket(id!),
    onSuccess: () => { toast.success('Ticket on hold.'); closeDialog(); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const mutResume = useMutation({
    mutationFn: () => resumeTicket(id!),
    onSuccess: () => { toast.success('Ticket resumed.'); closeDialog(); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const mutResolve = useMutation({
    mutationFn: (resolution: string) => resolveTicket(id!, { resolution }),
    onSuccess: () => { toast.success('Ticket resolved.'); closeDialog(); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const mutClose = useMutation({
    mutationFn: () => closeTicket(id!),
    onSuccess: () => { toast.success('Ticket closed.'); closeDialog(); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const mutCancel = useMutation({
    mutationFn: (reason: string) => cancelTicket(id!, { reason }),
    onSuccess: () => { toast.success('Ticket cancelled.'); closeDialog(); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const mutComment = useMutation({
    mutationFn: ({ comment, isInternal }: { comment: string; isInternal: boolean }) => addTicketComment(id!, { comment, isInternal }),
    onSuccess: () => { toast.success('Comment added.'); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const mutMaintenance = useMutation({
    mutationFn: (d: { maintenanceTypeId: string; technicianId: string; maintenanceCategory: string }) =>
      createTicketMaintenance(id!, {
        maintenanceTypeId: d.maintenanceTypeId || null,
        technicianId: d.technicianId || null,
        maintenanceCategory: d.maintenanceCategory,
      }),
    onSuccess: (res) => {
      toast.success('Maintenance created from ticket.');
      closeDialog();
      invalidate();
      qc.invalidateQueries({ queryKey: ['maintenance', 'detail', res.data.maintenance.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>;
  if (isError) return <div className="p-6 text-center text-red-500">{(error as Error)?.message || 'Unable to load ticket.'}</div>;
  if (!data?.data) return <div className="p-6 text-center text-slate-400">Ticket not found.</div>;

  const t: Ticket = data.data;
  const status = t.status;
  const actions = (WORKFLOW_ACTIONS[status] ?? []).filter((a) => can(a.perm));
  const comments = (t.comments ?? []) as TicketComment[];
  const assignments = (t.assignments ?? []) as TicketAssignment[];
  const userOptions = (users?.data ?? []) as UserOption[];
  const typeOptions = (types?.data ?? []) as { id: string; name: string }[];
  const maintenance = t.maintenance ?? [];
  const isTerminal = status === 'CLOSED' || status === 'CANCELLED';

  const InfoRow = ({ label, value }: { label: string; value?: string | number | null }) => (
    <div className="flex justify-between gap-4 border-b border-slate-100 py-2 text-sm last:border-0">
      <span className="shrink-0 text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-900">{value != null && value !== '' ? String(value) : '-'}</span>
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6">
      <button onClick={() => navigate('/tickets')} className="mb-4 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" /> Tickets
      </button>

      {/* Header */}
      <div className="mb-6 rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-indigo-100">
              <Wrench className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm text-slate-400">{t.ticketCode}</span>
                <TicketStatusBadge status={status} size="md" />
                <PriorityBadge priority={t.priority} size="md" />
              </div>
              <h1 className="mt-1 text-xl font-bold text-slate-900">{t.title}</h1>
              {t.category && <p className="mt-1 text-sm text-slate-500">{t.category.replace(/_/g, ' ')}</p>}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {can('ticket.update') && (
              <button onClick={() => navigate(`/tickets/${t.id}/edit`)} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
                <Pencil className="h-4 w-4" /> Edit
              </button>
            )}
          </div>
        </div>

        {actions.length > 0 && (
          <div className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:flex-wrap">
            {actions.map((a) => (
              <button key={a.key} onClick={() => setDialog(a.key)} className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium ${BUTTON_TONES[a.tone]}`}>
                {a.label}
              </button>
            ))}
          </div>
        )}
        {isTerminal && (
          <p className="mt-3 text-xs font-medium text-slate-400">This ticket is {status.toLowerCase()}. View only.</p>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-6 md:col-span-1 lg:col-span-2">
          {/* Description */}
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">Description</h2>
            {t.description ? <p className="whitespace-pre-wrap text-sm text-slate-800">{t.description}</p> : <p className="text-sm text-slate-400">No description.</p>}
            {t.resolution && (
              <div className="mt-4 border-t border-slate-100 pt-3">
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">Resolution</h3>
                <p className="text-sm text-slate-700">{t.resolution}</p>
              </div>
            )}
          </div>

          {/* Comments & Timeline */}
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">Activity & Comments</h2>
            <CommentsPanel
              comments={comments}
              canComment={!isTerminal && can('ticket.update')}
              isSubmitting={mutComment.isPending}
              onAddComment={(comment, isInternal) => mutComment.mutate({ comment, isInternal })}
            />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6 md:col-span-1 lg:col-span-1">
          {/* Info */}
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">Ticket</h2>
            <InfoRow label="Requester" value={t.reporter?.name} />
            <InfoRow label="Department" value={t.department?.name} />
            <InfoRow label="Category" value={t.category} />
            <InfoRow label="Reported" value={t.reportedAt ? formatDate(t.reportedAt) : undefined} />
            <InfoRow label="Assigned" value={t.assignedAt ? formatDate(t.assignedAt) : undefined} />
            <InfoRow label="Resolved" value={t.resolvedAt ? formatDate(t.resolvedAt) : undefined} />
            <InfoRow label="Closed" value={t.closedAt ? formatDate(t.closedAt) : undefined} />
          </div>

          {/* Asset */}
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">Related Asset</h2>
            {t.asset ? (
              <>
                <p className="font-medium text-slate-900">{t.asset.assetName}</p>
                <p className="font-mono text-xs text-slate-400">{t.asset.assetCode}</p>
                <button
                  onClick={() => navigate(`/assets/${t.asset!.id}`)}
                  className="mt-3 inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  <ExternalLink className="h-3 w-3" /> Open Asset
                </button>
              </>
            ) : (
              <p className="text-sm text-slate-400">No related asset.</p>
            )}
          </div>

          {/* Maintenance relation */}
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Maintenance</h2>
              {can('ticket.create') && !isTerminal && (
                <button onClick={() => setDialog('maintenance')} className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-indigo-700">
                  <Wrench className="h-3 w-3" /> Create Maintenance
                </button>
              )}
            </div>
            {maintenance.length === 0 ? (
              <p className="text-sm text-slate-400">No maintenance linked to this ticket.</p>
            ) : (
              <div className="space-y-2">
                {maintenance.map((m) => (
                  <button key={m.id} onClick={() => navigate(`/maintenance/${m.id}`)} className="flex w-full items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-left hover:bg-slate-50">
                    <span className="font-mono text-xs text-slate-700">{m.maintenanceCode}</span>
                    <span className="text-xs text-slate-400">{m.status.replace(/_/g, ' ')}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Assignment history */}
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">Assignment History</h2>
            {assignments.length === 0 ? (
              <p className="text-sm text-slate-400">Not assigned yet.</p>
            ) : (
              <div className="space-y-3">
                {assignments.map((a) => (
                  <div key={a.id} className="relative pl-5 before:absolute before:left-1.5 before:top-2 before:h-2 before:w-2 before:rounded-full before:bg-slate-300">
                    <p className="text-sm font-medium text-slate-700">{a.technicianName || 'Unknown'}</p>
                    <p className="text-xs text-slate-400">
                      {a.previousTechnicianName ? `Reassigned from ${a.previousTechnicianName}` : 'Assigned'}
                      {a.assignedByName ? ` by ${a.assignedByName}` : ''}
                    </p>
                    <p className="text-xs text-slate-400">{formatDate(a.assignedAt)}</p>
                    {a.notes && <p className="mt-0.5 text-xs text-slate-500">{a.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <AssignDialog open={dialog === 'assign'} users={userOptions} isSubmitting={mutAssign.isPending} onClose={closeDialog} onSubmit={(d) => mutAssign.mutate(d)} />
      {dialog === 'start' && (
        <ConfirmDialog open title="Start Work" description="Start working on this ticket? It will move to in progress." confirmLabel="Start" isSubmitting={mutStart.isPending} onConfirm={() => mutStart.mutate()} onClose={closeDialog} />
      )}
      {dialog === 'hold' && (
        <ConfirmDialog open title="Put on Hold" description="Put this ticket on hold?" confirmLabel="Hold" isSubmitting={mutHold.isPending} onConfirm={() => mutHold.mutate()} onClose={closeDialog} />
      )}
      {dialog === 'resume' && (
        <ConfirmDialog open title="Resume Ticket" description="Resume work on this ticket?" confirmLabel="Resume" isSubmitting={mutResume.isPending} onConfirm={() => mutResume.mutate()} onClose={closeDialog} />
      )}
      <ResolveDialog open={dialog === 'resolve'} isSubmitting={mutResolve.isPending} onClose={closeDialog} onSubmit={(resolution) => mutResolve.mutate(resolution)} />
      {dialog === 'close' && (
        <ConfirmDialog open title="Close Ticket" description="Close this resolved ticket?" confirmLabel="Close" tone="success" isSubmitting={mutClose.isPending} onConfirm={() => mutClose.mutate()} onClose={closeDialog} />
      )}
      <CancelDialog open={dialog === 'cancel'} isSubmitting={mutCancel.isPending} onClose={closeDialog} onSubmit={(reason) => mutCancel.mutate(reason)} />
      <CreateMaintenanceDialog open={dialog === 'maintenance'} types={typeOptions} users={userOptions} isSubmitting={mutMaintenance.isPending} onClose={closeDialog} onSubmit={(d) => mutMaintenance.mutate(d)} />
    </div>
  );
}
