import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import type { TestConnectionResult } from '../types';

/**
 * Renders the Test Connection result as a protocol-aware checklist
 * (reachable → ISAPI/ONVIF → authentication → device information) plus the
 * specific failure reason.
 */
export default function TestConnectionPanel({ result }: { result: TestConnectionResult }) {
  return (
    <div className="space-y-3">
      <div
        className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium ${
          result.success
            ? 'bg-green-50 text-green-700'
            : 'bg-red-50 text-red-700'
        }`}
      >
        {result.success ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
        {result.success ? 'Connection successful' : 'Connection failed'}
        <span className="rounded bg-white/60 px-1.5 py-0.5 text-xs font-semibold">
          {result.protocol}
        </span>
        {!result.success && result.errorMessage && (
          <span className="ml-1 font-normal">— {result.errorMessage}</span>
        )}
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
          </li>
        ))}
      </ul>

      {result.deviceInformation && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Device Information
          </p>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            <InfoRow label="Manufacturer" value={result.deviceInformation.manufacturer} />
            <InfoRow label="Model" value={result.deviceInformation.model} />
            <InfoRow label="Firmware" value={result.deviceInformation.firmwareVersion} />
            <InfoRow label="Serial Number" value={result.deviceInformation.serialNumber} />
            <InfoRow label="Hardware ID" value={result.deviceInformation.hardwareId} />
          </dl>
        </div>
      )}

      {!result.success && result.errorCode && (
        <p className="flex items-center gap-1.5 text-xs text-slate-400">
          <AlertTriangle className="h-3.5 w-3.5" /> Error code: {result.errorCode}
        </p>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-3 border-b border-slate-100 py-1 last:border-0">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-800">{value || '-'}</dd>
    </div>
  );
}
