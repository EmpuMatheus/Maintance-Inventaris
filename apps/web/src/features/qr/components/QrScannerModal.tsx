import { useCallback, useEffect, useRef, useState } from 'react';
import { X, Loader2, AlertCircle, RefreshCw } from 'lucide-react';

export type QrScanOutcome = { ok: true } | { ok: false; message?: string };

interface QrScannerModalProps {
  open: boolean;
  title?: string;
  onScan: (code: string) => Promise<QrScanOutcome | void> | QrScanOutcome | void;
  onClose: () => void;
}

const READER_ID = 'bbp-qr-scanner-reader';
type Phase = 'loading' | 'scanning' | 'error';

interface ScannerInstance {
  stop: () => Promise<void>;
  clear: () => void;
}

export default function QrScannerModal({ open, title = 'Scan QR Code', onScan, onClose }: QrScannerModalProps) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [error, setError] = useState('');
  const scannerRef = useRef<ScannerInstance | null>(null);
  const decodedHandlerRef = useRef<(text: string) => void>(() => {});
  const busyRef = useRef(false);
  const mountedRef = useRef(true);
  const onScanRef = useRef(onScan);
  const onCloseRef = useRef(onClose);
  onScanRef.current = onScan;
  onCloseRef.current = onClose;

  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (scanner) {
      try {
        await scanner.stop();
        scanner.clear();
      } catch (error) {
        void error;
      }
    }
  }, []);

  const handleDecoded = useCallback(
    async (text: string) => {
      if (busyRef.current) return;
      busyRef.current = true;
      await stopScanner();
      const code = text.trim().toUpperCase();
      if (!code) {
        if (mountedRef.current) {
          setError('QR code is empty or invalid. Please try again.');
          setPhase('error');
        }
        busyRef.current = false;
        return;
      }
      try {
        const outcome = await onScanRef.current(code);
        if (!mountedRef.current) return;
        if (outcome && outcome.ok === false) {
          setError(outcome.message || 'Asset tidak ditemukan.');
          setPhase('error');
          busyRef.current = false;
          return;
        }
        onCloseRef.current();
      } catch (e) {
        if (!mountedRef.current) return;
        setError((e as Error)?.message || 'Asset tidak ditemukan.');
        setPhase('error');
        busyRef.current = false;
      }
    },
    [stopScanner],
  );

  useEffect(() => {
    decodedHandlerRef.current = handleDecoded;
  }, [handleDecoded]);

  const startScanner = useCallback(async () => {
    setError('');
    setPhase('loading');
    busyRef.current = false;
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      if (!mountedRef.current) return;
      await stopScanner();
      const scanner = new Html5Qrcode(READER_ID, { verbose: false });
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText: string) => decodedHandlerRef.current(decodedText),
        () => {},
      );
      if (mountedRef.current) setPhase('scanning');
    } catch {
      if (mountedRef.current) {
        setPhase('error');
        setError('Unable to access camera. Please grant camera permission and try again.');
      }
    }
  }, [stopScanner]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      void stopScanner();
    };
  }, [stopScanner]);

  useEffect(() => {
    if (open) {
      void startScanner();
    } else {
      void stopScanner();
    }
  }, [open, startScanner, stopScanner]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:text-slate-600"
            aria-label="Close scanner"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 py-4">
          <div className="relative overflow-hidden rounded-lg bg-black">
            <div id={READER_ID} className="min-h-[240px] w-full" />
            {phase === 'loading' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 text-center text-white">
                <Loader2 className="h-6 w-6 animate-spin" />
                <p className="text-sm">Opening camera...</p>
              </div>
            )}
            {phase === 'scanning' && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/50 px-3 py-2 text-center">
                <p className="text-xs text-white">Place QR code inside the frame</p>
              </div>
            )}
          </div>

          {phase === 'error' && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-600">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-200 px-5 py-4">
          {phase === 'error' && (
            <button
              type="button"
              onClick={() => void startScanner()}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              <RefreshCw className="h-4 w-4" /> Scan Again
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
