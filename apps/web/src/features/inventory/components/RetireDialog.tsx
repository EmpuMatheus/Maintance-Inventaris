import { useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export const RETIRE_REASONS = [
  'BROKEN',
  'LOST',
  'SOLD',
  'DISPOSED',
];

export default function RetireDialog({
  open,
  assetCode,
  assetName,
  isSubmitting,
  onClose,
  onConfirm,
}: {
  open: boolean;
  assetCode: string;
  assetName: string;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: (data: { reason: string; notes?: string }) => void;
}) {
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');

  if (!open) return null;

  const submit = () => {
    if (!reason) {
      toast.error('Please select a retire reason.');
      return;
    }
    onConfirm({ reason, notes: notes.trim() || undefined });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 pt-12" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-slate-200 px-6 py-4">
          <Trash2 className="h-4 w-4 text-red-600" />
          <h3 className="text-lg font-semibold text-slate-900">Retire Asset</h3>
        </div>
        <div className="space-y-4 px-6 py-4">
          <div className="rounded-lg bg-slate-50 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Asset</p>
            <p className="font-mono text-sm text-slate-700">{assetCode}</p>
            <p className="text-sm text-slate-600">{assetName}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Reason *</label>
            <select value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none">
              <option value="">Select reason...</option>
              {RETIRE_REASONS.map((r) => (
                <option key={r} value={r}>{r.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" placeholder="Optional notes..." />
          </div>
        </div>
        <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <button onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
          <button onClick={submit} disabled={isSubmitting} className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Retire Asset
          </button>
        </div>
      </div>
    </div>
  );
}
