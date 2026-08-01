import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 pt-12" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-slate-200 px-6 py-4">
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        </div>
        {children}
      </div>
    </div>
  );
}

function DialogFooter({
  onClose,
  onConfirm,
  confirmLabel,
  isSubmitting,
  disabled,
  tone = 'primary',
}: {
  onClose: () => void;
  onConfirm: () => void;
  confirmLabel: string;
  isSubmitting: boolean;
  disabled?: boolean;
  tone?: 'primary' | 'success' | 'danger';
}) {
  const tones = { primary: 'bg-indigo-600 hover:bg-indigo-700', success: 'bg-green-600 hover:bg-green-700', danger: 'bg-red-600 hover:bg-red-700' };
  return (
    <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
      <button onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
      <button
        onClick={onConfirm}
        disabled={isSubmitting || disabled}
        className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${tones[tone]}`}
      >
        {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
        {confirmLabel}
      </button>
    </div>
  );
}

function fieldClass() {
  return 'mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500';
}

export interface UserOption {
  id: string;
  name: string;
  username?: string;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  tone = 'primary',
  isSubmitting,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  tone?: 'primary' | 'success' | 'danger';
  isSubmitting: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <ModalShell title={title} onClose={onClose}>
      <div className="px-6 py-4"><p className="text-sm text-slate-600">{description}</p></div>
      <DialogFooter onClose={onClose} onConfirm={onConfirm} confirmLabel={confirmLabel} isSubmitting={isSubmitting} tone={tone} />
    </ModalShell>
  );
}

export function AssignDialog({
  open,
  users,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  open: boolean;
  users: UserOption[];
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (data: { technicianId: string; notes: string }) => void;
}) {
  const [technicianId, setTechnicianId] = useState('');
  const [notes, setNotes] = useState('');
  useEffect(() => {
    if (open) { setTechnicianId(''); setNotes(''); }
  }, [open]);
  if (!open) return null;
  return (
    <ModalShell title="Assign Technician" onClose={onClose}>
      <div className="space-y-4 px-6 py-4">
        <div>
          <label className="block text-sm font-medium text-slate-700">Technician *</label>
          <select value={technicianId} onChange={(e) => setTechnicianId(e.target.value)} className={fieldClass()}>
            <option value="">Select technician...</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}{u.username ? ` (${u.username})` : ''}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={fieldClass()} />
        </div>
      </div>
      <DialogFooter onClose={onClose} onConfirm={() => onSubmit({ technicianId, notes })} confirmLabel="Assign" isSubmitting={isSubmitting} disabled={!technicianId} />
    </ModalShell>
  );
}

export function ResolveDialog({
  open,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  open: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (resolution: string) => void;
}) {
  const [resolution, setResolution] = useState('');
  useEffect(() => { if (open) setResolution(''); }, [open]);
  if (!open) return null;
  return (
    <ModalShell title="Resolve Ticket" onClose={onClose}>
      <div className="space-y-4 px-6 py-4">
        <div>
          <label className="block text-sm font-medium text-slate-700">Resolution *</label>
          <textarea value={resolution} onChange={(e) => setResolution(e.target.value)} rows={4} className={fieldClass()} placeholder="Describe how the issue was resolved" />
        </div>
      </div>
      <DialogFooter onClose={onClose} onConfirm={() => onSubmit(resolution)} confirmLabel="Resolve" tone="success" isSubmitting={isSubmitting} disabled={!resolution.trim()} />
    </ModalShell>
  );
}

export function CancelDialog({
  open,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  open: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  useEffect(() => { if (open) setReason(''); }, [open]);
  if (!open) return null;
  return (
    <ModalShell title="Cancel Ticket" onClose={onClose}>
      <div className="space-y-4 px-6 py-4">
        <div>
          <label className="block text-sm font-medium text-slate-700">Reason *</label>
          <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} className={fieldClass()} placeholder="e.g. Duplicate request" />
        </div>
      </div>
      <DialogFooter onClose={onClose} onConfirm={() => onSubmit(reason)} confirmLabel="Confirm Cancellation" tone="danger" isSubmitting={isSubmitting} disabled={!reason.trim()} />
    </ModalShell>
  );
}

export function CreateMaintenanceDialog({
  open,
  types,
  users,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  open: boolean;
  types: { id: string; name: string }[];
  users: UserOption[];
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (data: { maintenanceTypeId: string; technicianId: string; maintenanceCategory: string }) => void;
}) {
  const [maintenanceTypeId, setMaintenanceTypeId] = useState('');
  const [technicianId, setTechnicianId] = useState('');
  const [maintenanceCategory, setMaintenanceCategory] = useState('CORRECTIVE');
  useEffect(() => {
    if (open) { setMaintenanceTypeId(''); setTechnicianId(''); setMaintenanceCategory('CORRECTIVE'); }
  }, [open]);
  if (!open) return null;
  return (
    <ModalShell title="Create Maintenance from Ticket" onClose={onClose}>
      <div className="space-y-4 px-6 py-4">
        <div>
          <label className="block text-sm font-medium text-slate-700">Maintenance Type</label>
          <select value={maintenanceTypeId} onChange={(e) => setMaintenanceTypeId(e.target.value)} className={fieldClass()}>
            <option value="">None</option>
            {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Maintenance Category</label>
          <select value={maintenanceCategory} onChange={(e) => setMaintenanceCategory(e.target.value)} className={fieldClass()}>
            <option value="CORRECTIVE">Corrective</option>
            <option value="PREVENTIVE">Preventive</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Technician</label>
          <select value={technicianId} onChange={(e) => setTechnicianId(e.target.value)} className={fieldClass()}>
            <option value="">Current assignee / none</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}{u.username ? ` (${u.username})` : ''}</option>)}
          </select>
        </div>
      </div>
      <DialogFooter
        onClose={onClose}
        onConfirm={() => onSubmit({ maintenanceTypeId, technicianId, maintenanceCategory })}
        confirmLabel="Create Maintenance"
        isSubmitting={isSubmitting}
      />
    </ModalShell>
  );
}
