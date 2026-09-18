import { Wifi, WifiOff, HelpCircle, Server } from 'lucide-react';
import type { NetworkMonitoringSummary } from '../types';

const CARDS = [
  { key: 'total', label: 'Total Devices', icon: Server, tone: 'text-slate-600 bg-slate-100' },
  { key: 'online', label: 'Online', icon: Wifi, tone: 'text-green-600 bg-green-100' },
  { key: 'offline', label: 'Offline', icon: WifiOff, tone: 'text-red-600 bg-red-100' },
  { key: 'unknown', label: 'Unknown', icon: HelpCircle, tone: 'text-amber-600 bg-amber-100' },
] as const;

export default function NetworkSummaryCards({ summary }: { summary?: NetworkMonitoringSummary }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {CARDS.map(({ key, label, icon: Icon, tone }) => (
        <div key={key} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${tone}`}>
            <Icon className="h-4 w-4" />
          </span>
          <div>
            <p className="text-xs font-medium text-slate-400">{label}</p>
            <p className="text-lg font-semibold text-slate-800">{summary?.[key] ?? '-'}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
