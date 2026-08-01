import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, Bell, CheckCheck, ChevronLeft, ChevronRight, Loader2, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  listNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  archiveNotification,
  deleteNotification,
  getNotificationSettings,
  updateNotificationSettings,
  notificationKeys,
} from '../api/notifications';
import { NOTIFICATION_TYPES, NOTIFICATION_PRIORITIES } from '../constants';
import type { AppNotification, NotificationFilters, NotificationSettings } from '../types';

const PRIORITY_COLORS: Record<string, string> = {
  INFO: 'bg-slate-400',
  WARNING: 'bg-amber-500',
  CRITICAL: 'bg-red-500',
  SUCCESS: 'bg-green-500',
};

function formatDateTime(value: string): string {
  const d = new Date(value);
  return `${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} · ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
}

const SETTING_LABELS: Record<keyof NotificationSettings, string> = {
  asset: 'Asset',
  maintenance: 'Maintenance',
  schedule: 'Schedule',
  ticket: 'Ticket',
  assignment: 'Assignment',
  movement: 'Movement',
  reminder: 'Reminder',
  system: 'System',
};

export default function NotificationsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [priority, setPriority] = useState('');
  const [view, setView] = useState<'all' | 'unread' | 'archived'>('all');

  const filters: NotificationFilters = {
    page,
    search: search || undefined,
    type: type || undefined,
    priority: priority || undefined,
    unread: view === 'unread' ? true : undefined,
    archived: view === 'archived' ? true : undefined,
  };

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: notificationKeys.list(filters),
    queryFn: () => listNotifications(filters),
  });

  const { data: unread } = useQuery({ queryKey: notificationKeys.unread, queryFn: getUnreadCount });

  const { data: settingsData } = useQuery({ queryKey: notificationKeys.settings, queryFn: getNotificationSettings });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: notificationKeys.all });
  };

  const markRead = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });
  const markAll = useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: () => { toast.success('All notifications marked as read.'); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const archive = useMutation({
    mutationFn: (id: string) => archiveNotification(id),
    onSuccess: () => { toast.success('Notification archived.'); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteNotification(id),
    onSuccess: () => { toast.success('Notification deleted.'); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const saveSettings = useMutation({
    mutationFn: (patch: Partial<NotificationSettings>) => updateNotificationSettings(patch),
    onSuccess: () => { toast.success('Notification preferences saved.'); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const settings = settingsData?.data;
  const items = data?.data ?? [];

  const toggleSetting = (key: keyof NotificationSettings) => {
    if (settings) saveSettings.mutate({ [key]: !settings[key] });
  };

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
          <p className="mt-1 text-sm text-slate-500">
            {unread?.data?.count ?? 0} unread · {data?.meta.total ?? 0} total
          </p>
        </div>
        <button
          onClick={() => markAll.mutate()}
          disabled={markAll.isPending || (unread?.data?.count ?? 0) === 0}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
        >
          <CheckCheck className="h-4 w-4" /> Mark All Read
        </button>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search notifications..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="">All Types</option>
          {NOTIFICATION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={priority} onChange={(e) => { setPriority(e.target.value); setPage(1); }} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="">All Priorities</option>
          {NOTIFICATION_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={view} onChange={(e) => { setView(e.target.value as typeof view); setPage(1); }} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="all">All</option>
          <option value="unread">Unread only</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* List */}
        <div className="lg:col-span-2">
          {isLoading ? (
            <div className="rounded-lg border border-slate-200 bg-white p-12 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-400" /></div>
          ) : isError ? (
            <div className="rounded-lg border border-slate-200 bg-white p-12 text-center">
              <p className="mb-2 text-sm text-red-500">{(error as Error)?.message || 'Unable to load notifications.'}</p>
              <button onClick={() => refetch()} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">Try Again</button>
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-white p-12 text-center">
              <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400"><Bell className="h-5 w-5" /></div>
              <p className="text-sm font-medium text-slate-500">No notifications found.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              {items.map((n: AppNotification) => (
                <div key={n.id} className={`flex items-start gap-3 border-b border-slate-100 px-4 py-3 last:border-0 ${n.isRead ? '' : 'bg-indigo-50/40'}`}>
                  <span className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${PRIORITY_COLORS[n.priority] ?? 'bg-slate-300'}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-slate-800">{n.title}</p>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">{n.type}</span>
                    </div>
                    {n.message && <p className="mt-0.5 text-sm text-slate-600">{n.message}</p>}
                    <p className="mt-0.5 text-xs text-slate-400">{formatDateTime(n.createdAt)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {!n.isRead && (
                      <button onClick={() => markRead.mutate(n.id)} className="rounded p-1.5 text-slate-400 hover:text-indigo-600" title="Mark read"><CheckCheck className="h-4 w-4" /></button>
                    )}
                    {view !== 'archived' && (
                      <button onClick={() => archive.mutate(n.id)} className="rounded p-1.5 text-slate-400 hover:text-amber-600" title="Archive"><Archive className="h-4 w-4" /></button>
                    )}
                    <button onClick={() => remove.mutate(n.id)} className="rounded p-1.5 text-slate-400 hover:text-red-600" title="Delete"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {data?.meta && data.meta.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
              <span>Page {data.meta.page} of {data.meta.totalPages}</span>
              <div className="flex items-center gap-2">
                <button disabled={!data.meta.hasPreviousPage} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-slate-300 p-2 disabled:opacity-30 hover:bg-slate-50"><ChevronLeft className="h-4 w-4" /></button>
                <button disabled={!data.meta.hasNextPage} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-slate-300 p-2 disabled:opacity-30 hover:bg-slate-50"><ChevronRight className="h-4 w-4" /></button>
              </div>
            </div>
          )}
        </div>

        {/* Settings */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">Notification Preferences</h2>
          {!settings ? (
            <div className="py-6 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-300" /></div>
          ) : (
            <div className="space-y-3">
              {(Object.keys(SETTING_LABELS) as (keyof NotificationSettings)[]).map((key) => (
                <label key={key} className="flex cursor-pointer items-center justify-between rounded-lg border border-slate-100 px-3 py-2.5">
                  <span className="text-sm font-medium text-slate-700">{SETTING_LABELS[key]}</span>
                  <button
                    type="button"
                    onClick={() => toggleSetting(key)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${settings[key] ? 'bg-indigo-600' : 'bg-slate-300'}`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${settings[key] ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </label>
              ))}
            </div>
          )}
          <p className="mt-4 text-xs text-slate-400">Disabled categories will not produce in-app notifications. No email or WhatsApp yet.</p>
        </div>
      </div>
    </div>
  );
}
