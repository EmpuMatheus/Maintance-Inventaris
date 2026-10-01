import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import type { TestRtspResult } from '../types';

/**
 * Renders the Test RTSP Connection result: the probed device/channel/stream,
 * the ordered checklist and the specific failure reason. Credentials are never
 * part of the response, so nothing sensitive is displayed here.
 */
export default function TestRtspPanel({ result }: { result: TestRtspResult }) {
  const streamLabel = result.stream === 'main' ? 'Main' : 'Sub';
  return (
    <div className="space-y-3">
      <div
        className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium ${
          result.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
        }`}
      >
        {result.success ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
        {result.success ? 'RTSP stream accessible' : 'RTSP connection failed'}
        <span className="rounded bg-white/60 px-1.5 py-0.5 text-xs font-semibold">
          {result.protocol}
        </span>
        {!result.success && result.errorMessage && (
          <span className="ml-1 font-normal">— {result.errorMessage}</span>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
        <dl className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
          <InfoRow label="Device" value={result.device.name} />
          <InfoRow label="Endpoint" value={`${result.device.ipAddress}:${result.device.rtspPort}`} />
          <InfoRow label="Integration" value={result.protocol} />
          <InfoRow label="Channel" value={String(result.channel)} />
          <InfoRow label="Stream" value={streamLabel} />
          <InfoRow label="RTSP Target" value={<span className="font-mono text-xs">{result.path}</span>} />
          <InfoRow label="Probe" value={result.probe === 'ffmpeg' ? 'FFmpeg decode' : 'RTSP DESCRIBE'} />
          <InfoRow
            label="Decoded Frames"
            value={result.decodedFrames !== null ? String(result.decodedFrames) : '-'}
          />
          <InfoRow
            label="Latency"
            value={result.latencyMs !== null ? `${result.latencyMs} ms` : '-'}
          />
        </dl>
      </div>

      <ul className="space-y-1.5">
        {result.steps.map((step) => (
          <li key={step.key} className="flex items-center gap-2 text-sm">
            {step.ok ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
            ) : (
              <XCircle className="h-4 w-4 shrink-0 text-slate-300" />
            )}
            <span className={step.ok ? 'text-slate-700' : 'text-slate-400'}>{step.label}</span>
            {!step.ok && step.detail && <span className="text-xs text-slate-400">— {step.detail}</span>}
          </li>
        ))}
      </ul>

      {!result.success && result.errorCode && (
        <p className="flex items-center gap-1.5 text-xs text-slate-400">
          <AlertTriangle className="h-3.5 w-3.5" /> Error code: {result.errorCode}
        </p>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-3 border-b border-slate-100 py-1 last:border-0">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-800">{value || '-'}</dd>
    </div>
  );
}
