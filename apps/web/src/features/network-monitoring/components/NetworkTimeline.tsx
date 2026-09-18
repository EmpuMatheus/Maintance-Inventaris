import { useMemo } from 'react';
import { Activity, Loader2, RefreshCw, WifiOff, Wifi } from 'lucide-react';
import DeviceTypeBadge from './DeviceTypeBadge';
import NetworkStatusBadge from './NetworkStatusBadge';
import type { TimelineEntry } from '../types';
import { formatDayLabel, formatDuration, formatEventTime } from '../utils/format';

interface NetworkTimelineProps {
  entries: TimelineEntry[];
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
  onRetry?: () => void;
  connected?: boolean;
  onRefresh?: () => void;
}

function EventIcon({ state }: { state: TimelineEntry['state'] }) {
  if (state === 'CONNECTION_LOST') {
    return (
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 text-red-600 ring-4 ring-white">
        <WifiOff className="h-4 w-4" />
      </span>
    );
  }
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-600 ring-4 ring-white">
      <Wifi className="h-4 w-4" />
    </span>
  );
}

function TimelineCard({ entry }: { entry: TimelineEntry }) {
  const lost = entry.state === 'CONNECTION_LOST';
  return (
    <div className="relative flex gap-3 pb-5 last:pb-0">
      <div className="relative z-10 shrink-0">
        <EventIcon state={entry.state} />
      </div>
      <div className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-semibold text-slate-800">{entry.deviceName}</span>
            <DeviceTypeBadge deviceType={entry.deviceType} />
            {entry.live && (
              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-600">
                <span className="h-1 w-1 animate-pulse rounded-full bg-indigo-500" /> LIVE
              </span>
            )}
          </div>
          <span className="text-xs font-medium text-slate-400">{formatEventTime(entry.timestamp)}</span>
        </div>

        <p className={`mt-1 text-sm font-medium ${lost ? 'text-red-600' : 'text-green-600'}`}>
          {lost ? 'Connection Lost' : 'Connection Restored'}
        </p>

        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
          <span className="font-mono">{entry.ipAddress}</span>
          {entry.location && <span>{entry.location}</span>}
          <NetworkStatusBadge status={lost ? 'OFFLINE' : 'ONLINE'} />
        </div>

        {!lost && entry.durationSeconds !== null && (
          <p className="mt-2 inline-flex rounded bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600">
            Downtime: {formatDuration(entry.durationSeconds)}
          </p>
        )}

        {lost && (
          <p className="mt-2 text-xs text-slate-400">Offline since {formatEventTime(entry.startedAt)}</p>
        )}
      </div>
    </div>
  );
}

function TimelineSkeleton() {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-12 text-center">
      <Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-400" />
    </div>
  );
}

export default function NetworkTimeline({
  entries,
  isLoading,
  isError,
  errorMessage,
  onRetry,
  connected,
  onRefresh,
}: NetworkTimelineProps) {
  const grouped = useMemo(() => {
    const groups: { label: string; items: TimelineEntry[] }[] = [];
    for (const entry of entries) {
      const label = formatDayLabel(entry.timestamp);
      const last = groups[groups.length - 1];
      if (last && last.label === label) last.items.push(entry);
      else groups.push({ label, items: [entry] });
    }
    return groups;
  }, [entries]);

  return (
    <div className="flex flex-col rounded-xl border border-slate-200 bg-slate-50">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-indigo-600" />
          <h2 className="text-sm font-semibold text-slate-800">Monitoring Timeline</h2>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
              connected ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${connected ? 'animate-pulse bg-green-500' : 'bg-slate-400'}`} />
            {connected ? 'Realtime' : 'Offline'}
          </span>
        </div>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        )}
      </div>

      <div className="p-4">
        {isLoading ? (
          <TimelineSkeleton />
        ) : isError ? (
          <div className="rounded-lg border border-slate-200 bg-white p-12 text-center">
            <p className="mb-2 text-sm text-red-500">{errorMessage || 'Unable to load monitoring timeline.'}</p>
            {onRetry && (
              <button
                onClick={onRetry}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                Try Again
              </button>
            )}
          </div>
        ) : entries.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-12 text-center">
            <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <Wifi className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium text-slate-500">No connection events yet.</p>
            <p className="mt-1 text-xs text-slate-400">Offline and recovery events will appear here in realtime.</p>
          </div>
        ) : (
          grouped.map((group) => (
            <div key={group.label} className="mb-5 last:mb-0">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">{group.label}</span>
                <span className="h-px flex-1 bg-slate-200" />
              </div>
              <div className="border-l border-slate-200 pl-4">
                {group.items.map((entry) => (
                  <TimelineCard key={entry.id} entry={entry} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
