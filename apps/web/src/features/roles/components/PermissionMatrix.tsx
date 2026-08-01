import { useMemo } from 'react';
import type { Permission } from '../types';

const GROUP_ORDER = ['Inventory', 'Master Data', 'Maintenance', 'Ticket', 'Report', 'Audit', 'Administration', 'System'];

export default function PermissionMatrix({
  permissions,
  selected,
  onChange,
}: {
  permissions: Permission[];
  selected: string[];
  onChange: (selected: string[]) => void;
}) {
  const groups = useMemo(() => {
    const map = new Map<string, Permission[]>();
    for (const p of permissions) {
      const list = map.get(p.group) ?? [];
      list.push(p);
      map.set(p.group, list);
    }
    return Array.from(map.entries()).sort((a, b) => GROUP_ORDER.indexOf(a[0]) - GROUP_ORDER.indexOf(b[0]) || a[0].localeCompare(b[0]));
  }, [permissions]);

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {groups.map(([group, perms]) => {
        const groupAll = perms.every((p) => selected.includes(p.id));
        return (
          <div key={group} className="rounded-lg border border-slate-200 p-3">
            <label className="mb-2 flex cursor-pointer items-center gap-2">
              <input type="checkbox" checked={groupAll} onChange={() => onChange(groupAll ? selected.filter((x) => !perms.some((p) => p.id === x)) : [...selected, ...perms.map((p) => p.id)])} className="h-4 w-4 rounded border-slate-300 text-indigo-600" />
              <span className="text-sm font-semibold text-slate-700">{group}</span>
              <span className="text-xs text-slate-400">({perms.length})</span>
            </label>
            <div className="space-y-1 pl-6">
              {perms.map((p) => (
                <label key={p.id} className="flex cursor-pointer items-center gap-2">
                  <input type="checkbox" checked={selected.includes(p.id)} onChange={() => toggle(p.id)} className="h-4 w-4 rounded border-slate-300 text-indigo-600" />
                  <span className="font-mono text-xs text-slate-600">{p.code}</span>
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
