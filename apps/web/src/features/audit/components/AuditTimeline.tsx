import { Globe, Monitor, Tag, User } from 'lucide-react';
import type { AuditLog } from '../types';

function formatDateTime(value?: string | null): string {
  if (!value) return '-';
  return new Date(value).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function AuditTimeline({ audit }: { audit: AuditLog }) {
  const items = [
    { icon: <Tag className="h-4 w-4" />, label: 'Entity', value: `${audit.entityType}${audit.entityId ? ` · ${audit.entityId}` : ''}` },
    { icon: <User className="h-4 w-4" />, label: 'Performed By', value: audit.performedByName || audit.performedBy || '-' },
    { icon: <Monitor className="h-4 w-4" />, label: 'Request ID', value: audit.requestId || '-' },
    { icon: <Globe className="h-4 w-4" />, label: 'IP Address', value: audit.ipAddress || '-' },
  ];

  return (
    <div>
      <div className="relative flex gap-3 pb-4">
        <span className="mt-1.5 h-3 w-3 shrink-0 rounded-full bg-indigo-500 ring-2 ring-indigo-100" />
        <div>
          <p className="text-sm font-medium text-slate-800">{audit.action}</p>
          <p className="text-xs text-slate-400">{formatDateTime(audit.createdAt)}</p>
        </div>
      </div>
      {items.map((item, i) => (
        <div key={item.label} className="relative flex gap-3 pb-4">
          {i < items.length - 1 && <span className="absolute left-[5px] top-4 h-full w-px bg-slate-200" />}
          <span className="mt-1.5 flex h-3 w-3 shrink-0 items-center justify-center rounded-full bg-slate-300 ring-2 ring-white" />
          <div className="flex-1">
            <p className="text-xs uppercase tracking-wider text-slate-400">{item.label}</p>
            <p className="break-all text-sm text-slate-700">{item.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
