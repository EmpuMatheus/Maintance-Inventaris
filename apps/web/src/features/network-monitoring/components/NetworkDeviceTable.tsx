import { Loader2, Server } from 'lucide-react';
import DeviceTypeBadge from './DeviceTypeBadge';
import NetworkStatusBadge from './NetworkStatusBadge';
import type { NetworkDeviceStatus } from '../types';
import { formatEventDateTime } from '../utils/format';

interface NetworkDeviceTableProps {
  devices: NetworkDeviceStatus[];
  isLoading?: boolean;
}

export default function NetworkDeviceTable({ devices, isLoading }: NetworkDeviceTableProps) {
  if (isLoading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-12 text-center">
        <Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-400" />
      </div>
    );
  }

  if (devices.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-10 text-center">
        <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
          <Server className="h-5 w-5" />
        </div>
        <p className="text-sm font-medium text-slate-500">No devices match the filters.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">Device</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">IP Address</th>
              <th className="px-4 py-3 font-medium">Room</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Last Seen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {devices.map((device) => (
              <tr key={device.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <span className="font-medium text-slate-800">{device.name}</span>
                  {!device.isActive && (
                    <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                      Inactive
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <DeviceTypeBadge deviceType={device.deviceType} />
                </td>
                <td className="px-4 py-3 font-mono text-xs text-slate-600">{device.ipAddress}</td>
                <td className="px-4 py-3 text-xs text-slate-500">{device.location || device.roomName || '-'}</td>
                <td className="px-4 py-3">
                  <NetworkStatusBadge status={device.status} />
                </td>
                <td className="px-4 py-3 text-xs text-slate-400">
                  {device.lastPingAt ? formatEventDateTime(device.lastPingAt) : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
