import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Scan, Search, Loader2, Package, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { lookupByAssetCode } from '../api/qr';
import ConditionBadge from '@/components/ui/ConditionBadge';

export default function ScanPage() {
  const navigate = useNavigate();
  const [manualCode, setManualCode] = useState('');
  const [scannerActive, setScannerActive] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const scannerRef = useRef<any>(null);
  const videoRef = useRef<HTMLDivElement>(null);

  const lookupMut = useMutation({
    mutationFn: (code: string) => lookupByAssetCode(code),
    onSuccess: (res) => { setResult(res.data); setError(''); },
    onError: (e: Error) => { setError(e.message); setResult(null); },
  });

  const handleManualLookup = () => {
    const code = manualCode.trim().toUpperCase();
    if (!code) { setError('Please enter an asset code.'); return; }
    lookupMut.mutate(code);
  };

  const startScanner = useCallback(async () => {
    setScannerActive(true);
    setResult(null);
    setError('');
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const scanner = new Html5Qrcode('qr-reader');
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText: string) => {
          scanner.stop().catch(() => {});
          setScannerActive(false);
          lookupMut.mutate(decodedText.trim().toUpperCase());
        },
        () => {},
      );
    } catch {
      setScannerActive(false);
      toast.error('Unable to access camera. Please use manual lookup.');
    }
  }, [lookupMut]);

  const stopScanner = useCallback(() => {
    if (scannerRef.current) {
      scannerRef.current.stop().catch(() => {});
      scannerRef.current = null;
    }
    setScannerActive(false);
  }, []);

  const clearResult = () => { setResult(null); setError(''); setManualCode(''); };

  return (
    <div className="mx-auto max-w-lg p-4 md:p-6">
      <button onClick={() => navigate(-1)} className="mb-4 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <h1 className="mb-6 text-2xl font-bold text-slate-900">Scan Asset</h1>

      {/* Camera scanner */}
      <div className="mb-6 overflow-hidden rounded-xl border border-slate-200 bg-black">
        {scannerActive ? (
          <div>
            <div id="qr-reader" ref={videoRef} className="w-full" />
            <div className="flex justify-center border-t border-slate-800 bg-slate-900 px-4 py-3">
              <button onClick={stopScanner} className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700">Stop Camera</button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
            <div className="mb-4 rounded-full bg-indigo-100 p-4 text-indigo-600">
              <Scan className="h-8 w-8" />
            </div>
            <p className="mb-1 text-sm font-medium text-white">Scan QR Code</p>
            <p className="mb-6 text-xs text-slate-400">Place QR code inside the frame</p>
            <button onClick={startScanner} className="rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-indigo-700">
              Open Camera
            </button>
          </div>
        )}
      </div>

      {/* Manual lookup */}
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Enter Asset Code Manually</h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleManualLookup()}
            placeholder="e.g. AST-IT-COM-0001"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <button onClick={handleManualLookup} disabled={lookupMut.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50">
            {lookupMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Search
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
      )}

      {/* Quick View Result */}
      {result && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-indigo-100">
              <Package className="h-6 w-6 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">{result.assetName}</h2>
              <p className="font-mono text-sm text-slate-400">{result.assetCode}</p>
            </div>
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            <ConditionBadge condition={result.condition} size="md" />
            <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">{result.status?.replace(/_/g, ' ')}</span>
          </div>

          <div className="mb-4 space-y-2 text-sm">
            <div className="flex justify-between border-b border-slate-100 py-1.5">
              <span className="text-slate-500">Location</span>
              <span className="font-medium text-slate-900">{result.location}</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 py-1.5">
              <span className="text-slate-500">PIC</span>
              <span className="font-medium text-slate-900">{result.pic}</span>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button onClick={() => navigate(`/assets/${result.id}`)} className="flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700">
              View Detail
            </button>
            <button onClick={clearResult} className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50">
              Scan Another
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
