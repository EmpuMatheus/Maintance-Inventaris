import type { MaintenanceDetail, MaintenanceStatus, MaintenanceStatusHistory } from '../types';

export interface TimelineEvent {
  label: string;
  description: string;
  date: string;
  tone: 'default' | 'success' | 'danger';
}

function formatDateTime(value?: string | null): string {
  if (!value) return '-';
  const d = new Date(value);
  return `${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} · ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
}

const STATUS_LABELS: Record<MaintenanceStatus, string> = {
  OPEN: 'Created',
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In Progress',
  WAITING_PART: 'Waiting Part',
  TESTING: 'Testing',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

const STATUS_TONES: Record<MaintenanceStatus, TimelineEvent['tone']> = {
  OPEN: 'default',
  ASSIGNED: 'default',
  IN_PROGRESS: 'default',
  WAITING_PART: 'default',
  TESTING: 'default',
  COMPLETED: 'success',
  CANCELLED: 'danger',
};

function describeHistoryEvent(m: MaintenanceDetail, h: MaintenanceStatusHistory): string {
  if (h.toStatus === 'OPEN') return `Maintenance ${m.maintenanceCode} was created.`;
  if (h.toStatus === 'ASSIGNED') return m.technician ? `Assigned to ${m.technician.name}.` : 'Assigned to a technician.';
  if (h.toStatus === 'WAITING_PART') return h.reason || 'Waiting for required parts.';
  if (h.toStatus === 'IN_PROGRESS') {
    return h.fromStatus === 'WAITING_PART' ? 'Work resumed.' : 'Maintenance work started.';
  }
  if (h.toStatus === 'TESTING') return 'Maintenance is being tested.';
  if (h.toStatus === 'COMPLETED') return m.result || 'Maintenance completed.';
  return h.reason || m.notes || 'Maintenance cancelled.';
}

/**
 * Persistent timeline from recorded workflow events. Returns null when a record
 * predates status history so the caller can fall back to the inferred timeline.
 */
export function buildTimelineFromHistory(m: MaintenanceDetail): TimelineEvent[] | null {
  const history = m.statusHistory;
  if (!history || history.length === 0) return null;
  return [...history]
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .map((h) => ({
      label: h.toStatus === 'IN_PROGRESS' && h.fromStatus === 'WAITING_PART' ? 'Resumed' : STATUS_LABELS[h.toStatus],
      description: describeHistoryEvent(m, h),
      date: h.createdAt,
      tone: STATUS_TONES[h.toStatus],
    }));
}

export function buildTimeline(m: MaintenanceDetail): TimelineEvent[] {
  const events: TimelineEvent[] = [
    {
      label: 'Created',
      description: `Maintenance ${m.maintenanceCode} was created.`,
      date: m.createdAt,
      tone: 'default',
    },
  ];

  if (m.technician && m.status !== 'OPEN') {
    events.push({
      label: 'Assigned',
      description: `Assigned to ${m.technician.name}.`,
      date: m.updatedAt,
      tone: 'default',
    });
  }

  if (m.startDate) {
    events.push({
      label: 'Started',
      description: 'Maintenance work started.',
      date: m.startDate,
      tone: 'default',
    });
  }

  if (m.status === 'WAITING_PART') {
    events.push({
      label: 'Waiting Part',
      description: m.notes || 'Waiting for required parts.',
      date: m.updatedAt,
      tone: 'default',
    });
  }

  if (m.status === 'TESTING') {
    events.push({
      label: 'Testing',
      description: 'Maintenance is being tested.',
      date: m.updatedAt,
      tone: 'default',
    });
  }

  if (m.status === 'COMPLETED') {
    events.push({
      label: 'Completed',
      description: m.result || 'Maintenance completed.',
      date: m.finishDate || m.updatedAt,
      tone: 'success',
    });
  }

  if (m.status === 'CANCELLED') {
    events.push({
      label: 'Cancelled',
      description: m.notes || 'Maintenance cancelled.',
      date: m.updatedAt,
      tone: 'danger',
    });
  }

  return events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

export default function MaintenanceTimeline({ record }: { record: MaintenanceDetail }) {
  const events = buildTimelineFromHistory(record) ?? buildTimeline(record);
  return (
    <div>
      {events.map((ev, i) => (
        <div key={i} className="relative flex gap-3 pb-6 last:pb-0">
          {i < events.length - 1 && <span className="absolute left-[5px] top-4 h-full w-px bg-slate-200" />}
          <span
            className={`relative mt-1.5 h-3 w-3 shrink-0 rounded-full ring-2 ring-white ${
              ev.tone === 'success' ? 'bg-green-500' : ev.tone === 'danger' ? 'bg-red-500' : 'bg-slate-300'
            }`}
          />
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-800">{ev.label}</p>
            <p className="text-xs text-slate-400">{formatDateTime(ev.date)}</p>
            <p className="mt-0.5 text-xs text-slate-500">{ev.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
