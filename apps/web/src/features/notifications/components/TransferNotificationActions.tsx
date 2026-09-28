import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { confirmTransfer, rejectTransfer } from '@/features/inventory/api/inventory';
import type { AppNotification } from '../types';

function notifyData(n: AppNotification): Record<string, unknown> {
  return (n.data ?? {}) as Record<string, unknown>;
}

/**
 * Renders inline Confirm / Reject actions for a transfer-request notification.
 * Confirm needs no extra input; Reject opens a reason prompt (reason required).
 * The actions are only offered while the transfer is still actionable.
 */
export function TransferNotificationActions({ notification, onDone }: { notification: AppNotification; onDone?: () => void }) {
  const qc = useQueryClient();
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState('');

  const data = notifyData(notification);
  const transferId = (data.transferId as string) ?? notification.entityId ?? '';
  const actionsEnabled = data.actionsEnabled === true;
  const status = (data.status as string) ?? 'PENDING';

  const confirmMut = useMutation({
    mutationFn: () => confirmTransfer(transferId),
    onSuccess: (res: any) => {
      toast.success(res?.data?.completed ? 'All parties confirmed — transfer completed' : 'Confirmation recorded');
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['asset'] });
      qc.invalidateQueries({ queryKey: ['asset-active-transfer'] });
      qc.invalidateQueries({ queryKey: ['asset-latest-transfer'] });
      qc.invalidateQueries({ queryKey: ['asset-movements'] });
      onDone?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rejectMut = useMutation({
    mutationFn: () => rejectTransfer(transferId, reason.trim()),
    onSuccess: () => {
      toast.success('Transfer rejected');
      setShowReject(false);
      setReason('');
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['asset'] });
      qc.invalidateQueries({ queryKey: ['asset-active-transfer'] });
      qc.invalidateQueries({ queryKey: ['asset-latest-transfer'] });
      onDone?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!transferId || !actionsEnabled || status !== 'PENDING') {
    return null;
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => confirmMut.mutate()}
        disabled={confirmMut.isPending || rejectMut.isPending}
        className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {confirmMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Confirm
      </button>
      <button
        type="button"
        onClick={() => setShowReject((s) => !s)}
        disabled={confirmMut.isPending || rejectMut.isPending}
        className="inline-flex items-center gap-1 rounded-lg border border-red-300 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
      >
        <X className="h-3 w-3" /> Reject
      </button>

      {showReject && (
        <div className="mt-1 w-full rounded-lg border border-red-200 bg-red-50 p-2">
          <label className="block text-[11px] font-medium text-red-700">Alasan reject *</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            className="mt-1 block w-full rounded border border-red-200 px-2 py-1 text-xs focus:border-red-400 focus:outline-none"
            placeholder="Tulis alasan penolakan..."
          />
          <div className="mt-1 flex justify-end gap-2">
            <button type="button" onClick={() => { setShowReject(false); setReason(''); }} className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50">Batal</button>
            <button
              type="button"
              onClick={() => { if (!reason.trim()) { toast.error('Alasan reject wajib diisi'); return; } rejectMut.mutate(); }}
              disabled={rejectMut.isPending}
              className="inline-flex items-center gap-1 rounded bg-red-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {rejectMut.isPending && <Loader2 className="h-3 w-3 animate-spin" />} Kirim Reject
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
