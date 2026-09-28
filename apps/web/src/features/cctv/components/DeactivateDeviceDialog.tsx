import { AlertTriangle, Loader2 } from 'lucide-react';

/** Confirmation for deactivating a CCTV device. History and channels are preserved. */
export default function DeactivateDeviceDialog({
  open,
  deviceName,
  isSubmitting,
  onClose,
  onConfirm,
}: {
  open: boolean;
  deviceName: string;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 pt-12" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-amber-100 bg-amber-50 px-6 py-4">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          <h3 className="text-lg font-semibold text-amber-800">Nonaktifkan CCTV Device?</h3>
        </div>
        <div className="space-y-4 px-6 py-4">
          <div className="rounded-lg bg-slate-50 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Device</p>
            <p className="text-sm text-slate-700">{deviceName}</p>
          </div>
          <p className="text-sm text-slate-600">
            Device yang dinonaktifkan tidak akan dapat diuji koneksi atau disinkronkan. Data channel
            dan konfigurasi tetap tersimpan.
          </p>
        </div>
        <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />} Nonaktifkan
          </button>
        </div>
      </div>
    </div>
  );
}
