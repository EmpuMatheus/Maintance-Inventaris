import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  Box,
  CalendarClock,
  CheckCircle2,
  Package,
  Ticket,
  Truck,
  Wrench,
} from 'lucide-react';
import { listNotifications, getUnreadCount, markNotificationRead, notificationKeys } from '../api/notifications';
import type { AppNotification } from '../types';

const POLL_INTERVAL = 30_000;

const PRIORITY_DOT: Record<string, string> = {
  INFO: 'bg-slate-400',
  WARNING: 'bg-amber-500',
  CRITICAL: 'bg-red-500',
  SUCCESS: 'bg-green-500',
};

const TYPE_ICON: Record<string, React.ReactNode> = {
  ASSET: <Box className="h-4 w-4" />,
  MAINTENANCE: <Wrench className="h-4 w-4" />,
  SCHEDULE: <CalendarClock className="h-4 w-4" />,
  TICKET: <Ticket className="h-4 w-4" />,
  ASSIGNMENT: <Package className="h-4 w-4" />,
  MOVEMENT: <Truck className="h-4 w-4" />,
  REMINDER: <CalendarClock className="h-4 w-4" />,
  SYSTEM: <CheckCircle2 className="h-4 w-4" />,
};

function groupLabel(date: Date): 'Today' | 'Yesterday' | 'Older' {
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(date)) / 86400000);
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return 'Older';
}

function entityRoute(n: AppNotification): string | null {
  if (n.entityType === 'asset' && n.entityId) return `/assets/${n.entityId}`;
  if (n.entityType === 'maintenance' && n.entityId) return `/maintenance/${n.entityId}`;
  if (n.entityType === 'ticket' && n.entityId) return `/tickets/${n.entityId}`;
  return null;
}

export default function NotificationBell() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: unread } = useQuery({
    queryKey: notificationKeys.unread,
    queryFn: getUnreadCount,
    refetchInterval: POLL_INTERVAL,
  });

  const { data: list } = useQuery({
    queryKey: notificationKeys.list({ limit: 10 }),
    queryFn: () => listNotifications({ limit: 10 }),
    refetchInterval: POLL_INTERVAL,
  });

  const markRead = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });

  const items = list?.data ?? [];
  const count = unread?.data?.count ?? 0;

  const handleClick = (n: AppNotification) => {
    if (!n.isRead) markRead.mutate(n.id);
    setOpen(false);
    const route = entityRoute(n);
    if (route) navigate(route);
  };

  const groups = ['Today', 'Yesterday', 'Older'].map((label) => ({
    label,
    items: items.filter((n) => groupLabel(new Date(n.createdAt)) === label),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
        title="Notifications"
      >
        <Bell className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-30 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl sm:w-96">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <span className="text-sm font-semibold text-slate-800">Notifications</span>
              <button onClick={() => { setOpen(false); navigate('/notifications'); }} className="text-xs font-medium text-indigo-600 hover:underline">
                View all
              </button>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {items.length === 0 ? (
                <p className="py-10 text-center text-sm text-slate-400">No notifications.</p>
              ) : (
                groups.map((group) => (
                  <div key={group.label}>
                    <p className="bg-slate-50 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{group.label}</p>
                    {group.items.map((n) => (
                      <button
                        key={n.id}
                        onClick={() => handleClick(n)}
                        className={`flex w-full items-start gap-3 border-b border-slate-100 px-4 py-3 text-left hover:bg-slate-50 ${n.isRead ? 'opacity-70' : ''}`}
                      >
                        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                          {TYPE_ICON[n.type] ?? <Bell className="h-4 w-4" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="truncate text-sm font-medium text-slate-800">{n.title}</span>
                            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${PRIORITY_DOT[n.priority] ?? 'bg-slate-300'}`} />
                          </span>
                          {n.message && <span className="mt-0.5 block truncate text-xs text-slate-500">{n.message}</span>}
                          <span className="mt-0.5 block text-[10px] text-slate-400">{new Date(n.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                        </span>
                        {!n.isRead && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-indigo-500" />}
                      </button>
                    ))}
                  </div>
                ))
              )}
            </div>

            {list?.data?.length === 10 && (
              <button onClick={() => { setOpen(false); navigate('/notifications'); }} className="block w-full border-t border-slate-200 bg-slate-50 px-4 py-2.5 text-center text-xs font-medium text-indigo-600 hover:bg-slate-100">
                View all notifications
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
