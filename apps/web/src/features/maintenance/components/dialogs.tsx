import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

interface ModalShellProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

function ModalShell({ title, onClose, children }: ModalShellProps) {
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

interface DialogFooterProps {
  onClose: () => void;
  onConfirm: () => void;
  confirmLabel: string;
  isSubmitting: boolean;
  disabled?: boolean;
  tone?: 'primary' | 'success' | 'danger';
}

const TONE_CLASSES: Record<NonNullable<DialogFooterProps['tone']>, string> = {
  primary: 'bg-indigo-600 hover:bg-indigo-700',
  success: 'bg-green-600 hover:bg-green-700',
  danger: 'bg-red-600 hover:bg-red-700',
};

function DialogFooter({ onClose, onConfirm, confirmLabel, isSubmitting, disabled, tone = 'primary' }: DialogFooterProps) {
  return (
    <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
      <button onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
        Cancel
      </button>
      <button
        onClick={onConfirm}
        disabled={isSubmitting || disabled}
        className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${TONE_CLASSES[tone]}`}
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
      <div className="px-6 py-4">
        <p className="text-sm text-slate-600">{description}</p>
      </div>
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
    if (open) {
      setTechnicianId('');
      setNotes('');
    }
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
      <DialogFooter
        onClose={onClose}
        onConfirm={() => onSubmit({ technicianId, notes })}
        confirmLabel="Assign"
        isSubmitting={isSubmitting}
        disabled={!technicianId}
      />
    </ModalShell>
  );
}

export function WaitingPartDialog({
  open,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  open: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (data: { reason: string; notes: string }) => void;
}) {
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  useEffect(() => {
    if (open) {
      setReason('');
      setNotes('');
    }
  }, [open]);
  if (!open) return null;
  return (
    <ModalShell title="Waiting for Part" onClose={onClose}>
      <div className="space-y-4 px-6 py-4">
        <div>
          <label className="block text-sm font-medium text-slate-700">Reason *</label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Replacement part not available"
            className={fieldClass()}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={fieldClass()} />
        </div>
      </div>
      <DialogFooter
        onClose={onClose}
        onConfirm={() => onSubmit({ reason, notes })}
        confirmLabel="Confirm"
        isSubmitting={isSubmitting}
        disabled={!reason.trim()}
      />
    </ModalShell>
  );
}

export function CompleteDialog({
  open,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  open: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (data: { diagnosis: string; actionTaken: string; result: string; condition: string; notes: string }) => void;
}) {
  const [diagnosis, setDiagnosis] = useState('');
  const [actionTaken, setActionTaken] = useState('');
  const [result, setResult] = useState('');
  const [condition, setCondition] = useState('GOOD');
  const [notes, setNotes] = useState('');
  useEffect(() => {
    if (open) {
      setDiagnosis('');
      setActionTaken('');
      setResult('');
      setCondition('GOOD');
      setNotes('');
    }
  }, [open]);
  if (!open) return null;
  const conditions = ['GOOD', 'FAIR', 'NEED_ATTENTION', 'BROKEN', 'CRITICAL'];
  return (
    <ModalShell title="Complete Maintenance" onClose={onClose}>
      <div className="space-y-4 px-6 py-4">
        <div>
          <label className="block text-sm font-medium text-slate-700">Diagnosis</label>
          <textarea value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} rows={2} className={fieldClass()} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Action Taken</label>
          <textarea value={actionTaken} onChange={(e) => setActionTaken(e.target.value)} rows={2} className={fieldClass()} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Resolution *</label>
          <textarea value={result} onChange={(e) => setResult(e.target.value)} rows={2} className={fieldClass()} placeholder="Result / resolution of this maintenance" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Final Condition *</label>
          <select value={condition} onChange={(e) => setCondition(e.target.value)} className={fieldClass()}>
            {conditions.map((c) => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Completion Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={fieldClass()} />
        </div>
      </div>
      <DialogFooter
        onClose={onClose}
        onConfirm={() => onSubmit({ diagnosis, actionTaken, result, condition, notes })}
        confirmLabel="Complete"
        tone="success"
        isSubmitting={isSubmitting}
        disabled={!result.trim()}
      />
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
  onSubmit: (data: { reason: string; notes: string }) => void;
}) {
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  useEffect(() => {
    if (open) {
      setReason('');
      setNotes('');
    }
  }, [open]);
  if (!open) return null;
  return (
    <ModalShell title="Cancel Maintenance" onClose={onClose}>
      <div className="space-y-4 px-6 py-4">
        <div>
          <label className="block text-sm font-medium text-slate-700">Reason *</label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Duplicate request"
            className={fieldClass()}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={fieldClass()} />
        </div>
      </div>
      <DialogFooter
        onClose={onClose}
        onConfirm={() => onSubmit({ reason, notes })}
        confirmLabel="Confirm Cancellation"
        tone="danger"
        isSubmitting={isSubmitting}
        disabled={!reason.trim()}
      />
    </ModalShell>
  );
}

export function PartDialog({
  open,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  open: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (data: { partName: string; partNumber: string; quantity: number; unitPrice: number; notes: string }) => void;
}) {
  const [partName, setPartName] = useState('');
  const [partNumber, setPartNumber] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState(0);
  const [notes, setNotes] = useState('');
  useEffect(() => {
    if (open) {
      setPartName('');
      setPartNumber('');
      setQuantity(1);
      setUnitPrice(0);
      setNotes('');
    }
  }, [open]);
  if (!open) return null;
  return (
    <ModalShell title="Add Part" onClose={onClose}>
      <div className="space-y-4 px-6 py-4">
        <div>
          <label className="block text-sm font-medium text-slate-700">Part Name *</label>
          <input type="text" value={partName} onChange={(e) => setPartName(e.target.value)} className={fieldClass()} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700">Quantity</label>
            <input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
              className={fieldClass()}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Unit Price</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={unitPrice}
              onChange={(e) => setUnitPrice(Math.max(0, Number(e.target.value) || 0))}
              className={fieldClass()}
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Part Number</label>
          <input type="text" value={partNumber} onChange={(e) => setPartNumber(e.target.value)} className={fieldClass()} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Notes</label>
          <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className={fieldClass()} />
        </div>
      </div>
      <DialogFooter
        onClose={onClose}
        onConfirm={() => onSubmit({ partName, partNumber, quantity, unitPrice, notes })}
        confirmLabel="Add Part"
        isSubmitting={isSubmitting}
        disabled={!partName.trim()}
      />
    </ModalShell>
  );
}
