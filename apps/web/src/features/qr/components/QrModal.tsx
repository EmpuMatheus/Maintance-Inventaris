import { useState, useEffect } from 'react';
import { X, Download, Printer } from 'lucide-react';

interface QrModalProps {
  assetCode: string;
  assetName: string;
  onClose: () => void;
}

export default function QrModal({ assetCode, assetName, onClose }: QrModalProps) {
  const [qrDataUrl, setQrDataUrl] = useState('');

  useEffect(() => {
    import('qrcode').then((QRCode) => {
      QRCode.toDataURL(assetCode, { width: 300, margin: 2, color: { dark: '#0f172a', light: '#ffffff' } }, (err, url) => {
        if (!err) setQrDataUrl(url);
      });
    });
  }, [assetCode]);

  const handlePrint = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`
      <html><head><title>QR - ${assetCode}</title></head>
      <body style="text-align:center;padding:40px;font-family:sans-serif">
        <img src="${qrDataUrl}" style="width:300px;height:300px" />
        <p style="font-size:18px;font-weight:600;margin-top:12px">${assetCode}</p>
        <p style="font-size:14px;color:#666">${assetName}</p>
        <script>
          window.onload = function() { window.print(); window.close(); }
        <` + `/script>
      </body></html>
    `);
    w.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">QR Code</h3>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex justify-center">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt={`QR ${assetCode}`} className="h-60 w-60" />
          ) : (
            <div className="flex h-60 w-60 items-center justify-center text-slate-300">Generating...</div>
          )}
        </div>
        <p className="mt-3 text-center font-mono text-sm font-medium text-slate-900">{assetCode}</p>
        <p className="text-center text-xs text-slate-500">{assetName}</p>
        <div className="mt-4 flex gap-3">
          <button onClick={() => { const a = document.createElement('a'); a.href = qrDataUrl; a.download = `${assetCode}.png`; a.click(); }} disabled={!qrDataUrl}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-30">
            <Download className="h-4 w-4" /> Download
          </button>
          <button onClick={handlePrint} disabled={!qrDataUrl}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-30">
            <Printer className="h-4 w-4" /> Print
          </button>
        </div>
      </div>
    </div>
  );
}
