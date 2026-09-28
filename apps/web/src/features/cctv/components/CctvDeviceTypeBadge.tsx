const STYLES: Record<string, string> = {
  DVR: 'bg-violet-50 text-violet-700 ring-1 ring-violet-600/20',
  NVR: 'bg-blue-50 text-blue-700 ring-1 ring-blue-600/20',
  RECORDER: 'bg-teal-50 text-teal-700 ring-1 ring-teal-600/20',
};

/** Badge for a CCTV device type (DVR/NVR/RECORDER). */
export default function CctvDeviceTypeBadge({ deviceType }: { deviceType?: string }) {
  const type = deviceType ?? 'DVR';
  const style = STYLES[type] || STYLES.DVR;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${style}`}>
      {type}
    </span>
  );
}
