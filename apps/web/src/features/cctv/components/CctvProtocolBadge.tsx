import type { CctvIntegrationProtocol } from '../types';

const STYLES: Record<CctvIntegrationProtocol, string> = {
  ISAPI: 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/20',
  ONVIF: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20',
};

/** Read-only badge for the derived device integration protocol. */
export default function CctvProtocolBadge({ protocol }: { protocol?: CctvIntegrationProtocol }) {
  const value = protocol ?? 'ONVIF';
  const style = STYLES[value] ?? STYLES.ONVIF;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${style}`}
      title="Integration protocol is derived from vendor/device type."
    >
      {value}
    </span>
  );
}
