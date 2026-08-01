import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Download, ExternalLink, FileText, Loader2, Package, Trash2, Upload, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import {
  getMaintenance,
  listMaintenanceParts,
  addMaintenancePart,
  deleteMaintenancePart,
  listMaintenanceDocuments,
  uploadMaintenanceDocument,
  assignMaintenance,
  startMaintenance,
  waitingPartMaintenance,
  testingMaintenance,
  completeMaintenance,
  cancelMaintenance,
  maintenanceKeys,
} from '../api/maintenance';
import { listMaster } from '@/features/inventory/api/inventory';
import ConditionBadge from '@/components/ui/ConditionBadge';
import StatusBadge from '../components/StatusBadge';
import PriorityBadge from '../components/PriorityBadge';
import MaintenanceTimeline from '../components/MaintenanceTimeline';
import {
  AssignDialog,
  CancelDialog,
  CompleteDialog,
  ConfirmDialog,
  PartDialog,
  WaitingPartDialog,
  type UserOption,
} from '../components/dialogs';
import type { MaintenanceDetail, MaintenanceDocument, MaintenancePart } from '../types';

type DialogKey = 'assign' | 'start' | 'waiting-part' | 'testing' | 'complete' | 'cancel' | 'part' | 'resume' | null;

interface WorkflowAction {
  label: string;
  key: Exclude<DialogKey, null>;
  perm: string;
  tone: 'outline' | 'success' | 'danger';
}

const WORKFLOW_ACTIONS: Record<string, WorkflowAction[]> = {
  OPEN: [
    { label: 'Assign Technician', key: 'assign', perm: 'maintenance.update', tone: 'outline' },
    { label: 'Cancel', key: 'cancel', perm: 'maintenance.cancel', tone: 'danger' },
  ],
  ASSIGNED: [
    { label: 'Start Maintenance', key: 'start', perm: 'maintenance.update', tone: 'outline' },
    { label: 'Cancel', key: 'cancel', perm: 'maintenance.cancel', tone: 'danger' },
  ],
  IN_PROGRESS: [
    { label: 'Waiting Part', key: 'waiting-part', perm: 'maintenance.update', tone: 'outline' },
    { label: 'Testing', key: 'testing', perm: 'maintenance.update', tone: 'outline' },
    { label: 'Cancel', key: 'cancel', perm: 'maintenance.cancel', tone: 'danger' },
  ],
  WAITING_PART: [
    { label: 'Resume', key: 'resume', perm: 'maintenance.update', tone: 'outline' },
    { label: 'Cancel', key: 'cancel', perm: 'maintenance.cancel', tone: 'danger' },
  ],
  TESTING: [
    { label: 'Complete', key: 'complete', perm: 'maintenance.complete', tone: 'success' },
    { label: 'Cancel', key: 'cancel', perm: 'maintenance.cancel', tone: 'danger' },
  ],
  COMPLETED: [],
  CANCELLED: [],
};

const ASSET_STATUS_STYLES: Record<string, string> = {
  AVAILABLE: 'bg-blue-50 text-blue-700',
  ASSIGNED: 'bg-indigo-50 text-indigo-700',
  IN_USE: 'bg-green-50 text-green-700',
  IN_MAINTENANCE: 'bg-amber-50 text-amber-700',
  BROKEN: 'bg-red-50 text-red-700',
  SPARE: 'bg-slate-100 text-slate-500',
  LOST: 'bg-red-100 text-red-800',
  RETIRED: 'bg-slate-200 text-slate-600',
  DISPOSED: 'bg-slate-200 text-slate-600',
};

const BUTTON_TONES: Record<WorkflowAction['tone'], string> = {
  outline: 'border border-slate-300 text-slate-600 hover:bg-slate-50',
  success: 'border border-transparent bg-green-600 text-white hover:bg-green-700',
  danger: 'border border-red-200 text-red-600 hover:bg-red-50',
};

const DOCUMENT_TYPES = ['BEFORE_PHOTO', 'AFTER_PHOTO', 'INVOICE', 'SERVICE_REPORT', 'OTHER'];

function isImage(fileName: string): boolean {
  return /\.(jpe?g|png|webp)$/i.test(fileName);
}

function formatDate(value?: string | null): string {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function MaintenanceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const qc = useQueryClient();
  const [dialog, setDialog] = useState<DialogKey>(null);
  const [docType, setDocType] = useState('BEFORE_PHOTO');
  const [uploading, setUploading] = useState(false);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: maintenanceKeys.detail(id ?? ''),
    queryFn: () => getMaintenance(id!),
    enabled: !!id,
  });

  const { data: parts, refetch: refetchParts } = useQuery({
    queryKey: maintenanceKeys.parts(id ?? ''),
    queryFn: () => listMaintenanceParts(id!),
    enabled: !!id,
  });

  const { data: documents, refetch: refetchDocuments } = useQuery({
    queryKey: maintenanceKeys.documents(id ?? ''),
    queryFn: () => listMaintenanceDocuments(id!),
    enabled: !!id,
  });

  const { data: users } = useQuery({
    queryKey: ['master', 'users'],
    queryFn: () => listMaster('users', {}),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: maintenanceKeys.all });
    qc.invalidateQueries({ queryKey: maintenanceKeys.detail(id ?? '') });
    qc.invalidateQueries({ queryKey: maintenanceKeys.parts(id ?? '') });
    qc.invalidateQueries({ queryKey: maintenanceKeys.documents(id ?? '') });
  };

  const closeDialog = () => setDialog(null);

  const mutAssign = useMutation({
    mutationFn: (d: { technicianId: string; notes: string }) => assignMaintenance(id!, { technicianId: d.technicianId, notes: d.notes || null }),
    onSuccess: () => { toast.success('Maintenance assigned to technician.'); closeDialog(); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const mutStart = useMutation({
    mutationFn: () => startMaintenance(id!),
    onSuccess: () => { toast.success('Maintenance started.'); closeDialog(); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const mutWaiting = useMutation({
    mutationFn: (d: { reason: string; notes: string }) => waitingPartMaintenance(id!, { reason: d.reason, notes: d.notes || null }),
    onSuccess: () => { toast.success('Maintenance is now waiting for parts.'); closeDialog(); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const mutTesting = useMutation({
    mutationFn: () => testingMaintenance(id!),
    onSuccess: () => { toast.success('Maintenance moved to testing.'); closeDialog(); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const mutComplete = useMutation({
    mutationFn: (d: { diagnosis: string; actionTaken: string; result: string; condition: string; notes: string }) =>
      completeMaintenance(id!, {
        diagnosis: d.diagnosis || null,
        actionTaken: d.actionTaken || null,
        result: d.result || null,
        condition: d.condition,
        notes: d.notes || null,
      }),
    onSuccess: () => { toast.success('Maintenance completed.'); closeDialog(); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const mutCancel = useMutation({
    mutationFn: (d: { reason: string; notes: string }) => cancelMaintenance(id!, { reason: d.reason, notes: d.notes || null }),
    onSuccess: () => { toast.success('Maintenance cancelled.'); closeDialog(); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const mutAddPart = useMutation({
    mutationFn: (d: { partName: string; partNumber: string; quantity: number; unitPrice: number; notes: string }) =>
      addMaintenancePart(id!, {
        partName: d.partName,
        partNumber: d.partNumber || null,
        quantity: d.quantity,
        unitPrice: d.unitPrice,
        notes: d.notes || null,
      }),
    onSuccess: () => { toast.success('Part added.'); closeDialog(); refetchParts(); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const mutDeletePart = useMutation({
    mutationFn: (partId: string) => deleteMaintenancePart(id!, partId),
    onSuccess: () => { toast.success('Part removed.'); refetchParts(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const mutUploadDoc = useMutation({
    mutationFn: ({ file, type }: { file: File; type: string }) => uploadMaintenanceDocument(id!, file, type),
    onSuccess: () => { toast.success('Document uploaded.'); refetchDocuments(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleDocUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploading(true);
      mutUploadDoc.mutate({ file, type: docType }, { onSettled: () => setUploading(false) });
    }
    e.target.value = '';
  };

  if (isLoading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>;
  if (isError) return <div className="p-6 text-center text-red-500">{(error as Error)?.message || 'Unable to load maintenance.'}</div>;
  if (!data?.data) return <div className="p-6 text-center text-slate-400">Maintenance not found.</div>;

  const m: MaintenanceDetail = data.data;
  const status = m.status;
  const isTerminal = status === 'COMPLETED' || status === 'CANCELLED';
  const actions = (WORKFLOW_ACTIONS[status] ?? []).filter((a) => can(a.perm));
  const userOptions = (users?.data ?? []) as UserOption[];
  const partsList = (parts?.data ?? []) as MaintenancePart[];
  const docList = (documents?.data ?? []) as MaintenanceDocument[];

  const InfoRow = ({ label, value }: { label: string; value?: string | number | null }) => (
    <div className="flex justify-between gap-4 border-b border-slate-100 py-2 text-sm last:border-0">
      <span className="shrink-0 text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-900">{value != null && value !== '' ? String(value) : '-'}</span>
    </div>
  );

  const confirmMeta: Record<string, { title: string; description: string; label: string }> = {
    start: {
      title: 'Start Maintenance',
      description: 'Start work on this maintenance? The asset will be marked as in maintenance.',
      label: 'Start',
    },
    resume: {
      title: 'Resume Maintenance',
      description: 'Resume work on this maintenance? It will move back to in progress.',
      label: 'Resume',
    },
    testing: {
      title: 'Move to Testing',
      description: 'Move this maintenance to testing?',
      label: 'Move to Testing',
    },
  };

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6">
      <button onClick={() => navigate('/maintenance')} className="mb-4 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" /> Maintenance
      </button>

      {/* Header */}
      <div className="mb-6 rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-indigo-100">
              <Wrench className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900">{m.maintenanceCode}</h1>
                <StatusBadge status={status} size="md" />
                <PriorityBadge priority={m.priority || undefined} size="md" />
              </div>
              <p className="mt-1 text-sm text-slate-500">{m.maintenanceType?.name || m.maintenanceCategory}</p>
            </div>
          </div>
          {isTerminal && (
            <span className="self-start rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
              This maintenance is {status.toLowerCase()}. View only.
            </span>
          )}
        </div>

        {actions.length > 0 && (
          <div className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:flex-wrap">
            {actions.map((a) => (
              <button
                key={a.key}
                onClick={() => setDialog(a.key)}
                className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium ${BUTTON_TONES[a.tone]}`}
              >
                {a.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-6 md:col-span-1 lg:col-span-2">
          {/* Problem */}
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">Problem Description</h2>
            {m.problem ? <p className="text-sm text-slate-800">{m.problem}</p> : <p className="text-sm text-slate-400">No problem description.</p>}
            {m.diagnosis && (
              <div className="mt-4">
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">Diagnosis</h3>
                <p className="text-sm text-slate-700">{m.diagnosis}</p>
              </div>
            )}
            {m.actionTaken && (
              <div className="mt-4">
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">Action Taken</h3>
                <p className="text-sm text-slate-700">{m.actionTaken}</p>
              </div>
            )}
            {m.result && (
              <div className="mt-4">
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">Result</h3>
                <p className="text-sm text-slate-700">{m.result}</p>
              </div>
            )}
            {m.notes && (
              <div className="mt-4 border-t border-slate-100 pt-3">
                <p className="text-sm text-slate-500">{m.notes}</p>
              </div>
            )}
          </div>

          {/* Parts */}
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Parts Used</h2>
              {can('maintenance.update') && !isTerminal && (
                <button onClick={() => setDialog('part')} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700">
                  + Add Part
                </button>
              )}
            </div>
            {partsList.length === 0 && <p className="text-sm text-slate-400">No parts used.</p>}
            <div className="space-y-2">
              {partsList.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-slate-700">{p.partName} × {p.quantity}</p>
                    {p.partNumber && <p className="text-xs text-slate-400">{p.partNumber}</p>}
                    {p.notes && <p className="mt-0.5 text-xs text-slate-400">{p.notes}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-medium text-slate-500">{Number(p.totalPrice || 0).toLocaleString()}</span>
                    {can('maintenance.update') && !isTerminal && (
                      <button onClick={() => mutDeletePart.mutate(p.id)} className="rounded p-1 text-slate-400 hover:text-red-600">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Documents */}
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Documents</h2>
              {can('maintenance.update') && !isTerminal && (
                <div className="flex items-center gap-2">
                  <select value={docType} onChange={(e) => setDocType(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs">
                    {DOCUMENT_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                  </select>
                  <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700">
                    {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />} Upload
                    <input type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" className="hidden" onChange={handleDocUpload} />
                  </label>
                </div>
              )}
            </div>
            {docList.length === 0 && <p className="text-sm text-slate-400">No documents uploaded.</p>}
            <div className="grid gap-3 sm:grid-cols-2">
              {docList.map((d) => (
                <div key={d.id} className="rounded-lg border border-slate-100 p-3">
                  {isImage(d.fileName) ? (
                    <a href={d.fileUrl} target="_blank" rel="noreferrer" className="mb-2 block overflow-hidden rounded-lg bg-slate-100">
                      <img src={d.fileUrl} alt={d.fileName} className="h-32 w-full object-cover" />
                    </a>
                  ) : (
                    <div className="mb-2 flex h-32 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                      <FileText className="h-8 w-8" />
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-700">{d.fileName}</p>
                      <p className="text-xs text-slate-400">{d.documentType.replace(/_/g, ' ')}</p>
                    </div>
                    <a href={d.fileUrl} download className="shrink-0 rounded p-1 text-slate-400 hover:text-indigo-600" title="Download">
                      <Download className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Timeline */}
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">Timeline</h2>
            <MaintenanceTimeline record={m} />
          </div>
        </div>

        {/* Sidebar column */}
        <div className="space-y-6 md:col-span-1 lg:col-span-1">
          {/* Asset card */}
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">Asset</h2>
            {m.asset ? (
              <>
                <div className="mb-3 flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                    <Package className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">{m.asset.assetName}</p>
                    <p className="font-mono text-xs text-slate-400">{m.asset.assetCode}</p>
                  </div>
                </div>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <ConditionBadge condition={m.asset.condition || undefined} />
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${ASSET_STATUS_STYLES[m.asset.status ?? ''] || 'bg-slate-100 text-slate-600'}`}>
                    {m.asset.status?.replace(/_/g, ' ') || '-'}
                  </span>
                </div>
                <InfoRow label="Category" value={m.asset.categoryName} />
                <InfoRow label="Location" value={m.asset.location} />
                <InfoRow label="Department" value={m.asset.departmentName} />
                <InfoRow label="Assigned To" value={m.asset.picName} />
                <div className="mt-4">
                  <button
                    onClick={() => navigate(`/assets/${m.asset!.id}`)}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                  >
                    <ExternalLink className="h-4 w-4" /> Open Asset
                  </button>
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-400">Asset not available.</p>
            )}
          </div>

          {/* Maintenance card */}
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">Maintenance</h2>
            <InfoRow label="Type" value={m.maintenanceType?.name || m.maintenanceCategory} />
            <InfoRow label="Priority" value={m.priority} />
            <InfoRow label="Reported" value={m.createdAt ? formatDate(m.createdAt) : undefined} />
            <InfoRow label="Scheduled" value={m.scheduledDate ? formatDate(m.scheduledDate) : undefined} />
            <InfoRow label="Started" value={m.startDate ? formatDate(m.startDate) : undefined} />
            <InfoRow label="Completed" value={m.finishDate ? formatDate(m.finishDate) : undefined} />
            <InfoRow label="Created By" value={m.createdByUser?.name} />
            <InfoRow label="Technician" value={m.technician?.name} />
            <InfoRow label="Vendor" value={m.vendor?.name} />
            {m.ticket && (
              <div className="flex items-center justify-between gap-4 py-2 text-sm">
                <span className="shrink-0 text-slate-500">Origin Ticket</span>
                <button onClick={() => navigate(`/tickets/${m.ticket!.id}`)} className="font-medium text-indigo-600 hover:underline">
                  {m.ticket.ticketCode}
                </button>
              </div>
            )}
            {Number(m.totalCost || 0) > 0 && (
              <InfoRow label="Total Cost" value={Number(m.totalCost).toLocaleString()} />
            )}
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <AssignDialog
        open={dialog === 'assign'}
        users={userOptions}
        isSubmitting={mutAssign.isPending}
        onClose={closeDialog}
        onSubmit={(d) => mutAssign.mutate(d)}
      />
      {dialog === 'start' && (
        <ConfirmDialog
          open
          title={confirmMeta.start.title}
          description={confirmMeta.start.description}
          confirmLabel={confirmMeta.start.label}
          isSubmitting={mutStart.isPending}
          onConfirm={() => mutStart.mutate()}
          onClose={closeDialog}
        />
      )}
      {dialog === 'resume' && (
        <ConfirmDialog
          open
          title={confirmMeta.resume.title}
          description={confirmMeta.resume.description}
          confirmLabel={confirmMeta.resume.label}
          isSubmitting={mutStart.isPending}
          onConfirm={() => mutStart.mutate()}
          onClose={closeDialog}
        />
      )}
      <WaitingPartDialog
        open={dialog === 'waiting-part'}
        isSubmitting={mutWaiting.isPending}
        onClose={closeDialog}
        onSubmit={(d) => mutWaiting.mutate(d)}
      />
      {dialog === 'testing' && (
        <ConfirmDialog
          open
          title={confirmMeta.testing.title}
          description={confirmMeta.testing.description}
          confirmLabel={confirmMeta.testing.label}
          isSubmitting={mutTesting.isPending}
          onConfirm={() => mutTesting.mutate()}
          onClose={closeDialog}
        />
      )}
      <CompleteDialog
        open={dialog === 'complete'}
        isSubmitting={mutComplete.isPending}
        onClose={closeDialog}
        onSubmit={(d) => mutComplete.mutate(d)}
      />
      <CancelDialog
        open={dialog === 'cancel'}
        isSubmitting={mutCancel.isPending}
        onClose={closeDialog}
        onSubmit={(d) => mutCancel.mutate(d)}
      />
      <PartDialog
        open={dialog === 'part'}
        isSubmitting={mutAddPart.isPending}
        onClose={closeDialog}
        onSubmit={(d) => mutAddPart.mutate(d)}
      />
    </div>
  );
}
