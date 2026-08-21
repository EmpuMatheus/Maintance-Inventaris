import { useState } from 'react';
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';

/**
 * Permanent-delete confirmation for assets (Wrong Registration cleanup).
 * The user must type "DELETE" before the confirmation is enabled.
 */
export default function DeleteDialog({
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
  onConfirm: (data: { notes?: string }) => void;
}) {
  const [typed, setTyped] = useState('');
  const [notes, setNotes] = useState('');
  const confirmed = typed === 'DELETE';

  if (!open) return null;

  const reset = () => {
    setTyped('');
    setNotes('');
  };

  const submit = () => {
    if (!confirmed) return;
    onConfirm({ notes: notes.trim() || undefined });
    reset();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 pt-12" onClick={() => { onClose(); reset(); }}>
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-red-100 bg-red-50 px-6 py-4">
          <AlertTriangle className="h-5 w-5 text-red-600" />
          <h3 className="text-lg font-semibold text-red-700">Delete Asset Permanently</h3>
        </div>
        <div className="space-y-4 px-6 py-4">
          <div className="rounded-lg bg-slate-50 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Asset</p>
            <p className="font-mono text-sm text-slate-700">{assetCode}</p>
            <p className="text-sm text-slate-600">{assetName}</p>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <p className="font-medium">Reason: Wrong Registration</p>
            <p className="mt-1 text-xs">
              This permanently removes the asset and all of its history (assignments, condition changes, documents,
              movements, maintenance and tickets). This action cannot be undone.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Type <span className="font-mono font-bold">DELETE</span> to confirm *</label>
            <input
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="DELETE"
              className={`mt-1 block w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
                typed !== '' && !confirmed ? 'border-red-300' : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-500'
              }`}
            />
            {typed !== '' && !confirmed && <p className="mt-1 text-xs text-red-500">You must type DELETE to confirm.</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" placeholder="Optional notes..." />
          </div>
        </div>
        <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <button onClick={() => { onClose(); reset(); }} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
          <button onClick={submit} disabled={!confirmed || isSubmitting} className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50">
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Delete Permanently
          </button>
        </div>
      </div>
    </div>
  );
}
