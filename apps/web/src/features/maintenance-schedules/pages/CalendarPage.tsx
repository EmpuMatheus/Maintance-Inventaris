import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, ChevronLeft, ChevronRight, Loader2, Plus } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { listSchedules, scheduleKeys } from '../api/schedules';
import { SCHEDULE_FREQUENCY_LABELS } from '../components/schedule-constants';
import ScheduleStateBadge from '../components/ScheduleStateBadge';
import type { MaintenanceSchedule } from '../types';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const STATE_DOT: Record<string, string> = {
  UPCOMING: 'bg-blue-500',
  DUE_TODAY: 'bg-amber-500',
  OVERDUE: 'bg-red-500',
  COMPLETED: 'bg-green-500',
};

function toLocalKey(year: number, month: number, day: number): string {
  const m = String(month + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

function formatDate(value?: string | null): string {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function CalendarPage() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const now = new Date();
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [selectedDay, setSelectedDay] = useState<string | null>(toLocalKey(now.getFullYear(), now.getMonth(), now.getDate()));

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: scheduleKeys.list({ limit: 200 }),
    queryFn: () => listSchedules({ limit: 200 }),
  });

  const byDate = useMemo(() => {
    const map = new Map<string, MaintenanceSchedule[]>();
    for (const s of (data?.data ?? []) as MaintenanceSchedule[]) {
      if (!s.isActive || !s.nextMaintenanceDate) continue;
      const list = map.get(s.nextMaintenanceDate) ?? [];
      list.push(s);
      map.set(s.nextMaintenanceDate, list);
    }
    return map;
  }, [data]);

  const grid = useMemo(() => {
    const { year, month } = cursor;
    const first = new Date(year, month, 1);
    const startPad = first.getDay();
    const days = new Date(year, month + 1, 0).getDate();
    const cells: (string | null)[] = [];
    for (let i = 0; i < startPad; i += 1) cells.push(null);
    for (let d = 1; d <= days; d += 1) cells.push(toLocalKey(year, month, d));
    return cells;
  }, [cursor]);

  const selectedSchedules = selectedDay ? (byDate.get(selectedDay) ?? []) : [];

  const monthLabel = new Date(cursor.year, cursor.month, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  const move = (delta: number) => {
    setCursor((c) => {
      const m = c.month + delta;
      const year = c.year + Math.floor(m / 12);
      const month = ((m % 12) + 12) % 12;
      return { year, month };
    });
  };

  return (
    <div className="p-4 md:p-6">
      {can('maintenance.create') && (
        <button
          onClick={() => navigate('/maintenance/schedules/new')}
          className="mb-4 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" /> New Schedule
        </button>
      )}

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Maintenance Calendar</h1>
          <p className="mt-1 text-sm text-slate-500">Scheduled preventive maintenance by due date.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { const t = new Date(); setCursor({ year: t.getFullYear(), month: t.getMonth() }); setSelectedDay(toLocalKey(t.getFullYear(), t.getMonth(), t.getDate())); }} className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
            Today
          </button>
          <button onClick={() => move(-1)} className="rounded-lg border border-slate-300 p-2 hover:bg-slate-50"><ChevronLeft className="h-4 w-4" /></button>
          <span className="min-w-40 text-center text-sm font-semibold text-slate-800">{monthLabel}</span>
          <button onClick={() => move(1)} className="rounded-lg border border-slate-300 p-2 hover:bg-slate-50"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Calendar grid */}
        <div className="lg:col-span-2">
          {isLoading && <div className="rounded-lg border border-slate-200 bg-white p-12 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-400" /></div>}
          {isError && (
            <div className="rounded-lg border border-slate-200 bg-white p-12 text-center">
              <p className="mb-2 text-sm text-red-500">{(error as Error)?.message || 'Unable to load calendar.'}</p>
              <button onClick={() => refetch()} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">Try Again</button>
            </div>
          )}
          {!isLoading && !isError && (
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
                {WEEKDAYS.map((w) => (
                  <div key={w} className="px-1 py-2 text-center text-xs font-medium uppercase tracking-wider text-slate-500">{w}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-px bg-slate-200">
                {grid.map((key, i) => {
                  if (!key) return <div key={i} className="min-h-20 bg-slate-50" />;
                  const dayItems = byDate.get(key) ?? [];
                  const isSelected = selectedDay === key;
                  const isToday = key === toLocalKey(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
                  return (
                    <button
                      key={key}
                      onClick={() => setSelectedDay(key)}
                      className={`flex min-h-20 flex-col gap-1 bg-white p-1.5 text-left transition-colors hover:bg-indigo-50 ${isSelected ? 'ring-2 ring-inset ring-indigo-500' : ''}`}
                    >
                      <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${isToday ? 'bg-indigo-600 text-white' : 'text-slate-600'}`}>
                        {Number(key.slice(8))}
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {dayItems.slice(0, 3).map((s) => (
                          <span key={s.id} className={`h-2 w-2 rounded-full ${STATE_DOT[s.state ?? 'UPCOMING'] || 'bg-slate-300'}`} title={`${s.asset?.assetName} ${s.nextMaintenanceDate}`} />
                        ))}
                        {dayItems.length > 3 && <span className="text-[10px] leading-2 text-slate-400">+{dayItems.length - 3}</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Selected day detail */}
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-slate-500">Scheduled</h2>
          <p className="mb-4 text-sm font-medium text-slate-800">{selectedDay ? formatDate(selectedDay) : 'Select a date'}</p>
          {selectedSchedules.length === 0 ? (
            <div className="py-8 text-center">
              <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400"><CalendarDays className="h-5 w-5" /></div>
              <p className="text-sm text-slate-500">No maintenance scheduled on this day.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {selectedSchedules.map((s) => (
                <div key={s.id} className="rounded-lg border border-slate-100 p-3">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="font-mono text-xs text-slate-400">{s.asset?.assetCode}</span>
                    <ScheduleStateBadge state={s.state} isActive={s.isActive} />
                  </div>
                  <p className="text-sm font-medium text-slate-900">{s.asset?.assetName}</p>
                  <p className="text-xs text-slate-500">
                    {s.maintenanceType?.name || 'Preventive'} · {SCHEDULE_FREQUENCY_LABELS[s.frequencyType as keyof typeof SCHEDULE_FREQUENCY_LABELS] || s.frequencyType}
                    {s.frequencyValue > 1 ? ` × ${s.frequencyValue}` : ''}
                  </p>
                  {s.state === 'OVERDUE' && s.daysOverdue != null && (
                    <p className="mt-1 text-xs font-medium text-red-600">{s.daysOverdue} days overdue</p>
                  )}
                  {s.state === 'UPCOMING' && s.daysUntil != null && (
                    <p className="mt-1 text-xs font-medium text-blue-600">in {s.daysUntil} days</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
