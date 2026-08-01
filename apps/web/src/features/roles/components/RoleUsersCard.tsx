import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import Avatar from '@/features/users/components/Avatar';
import { listUsers } from '@/features/users/api/users';
import { setRoleUsers, roleKeys } from '../api/roles';
import type { RoleUser } from '../types';

export default function RoleUsersCard({ roleId, users }: { roleId: string; users: RoleUser[] }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);

  const { data: userData } = useQuery({ queryKey: ['users', 'all'], queryFn: () => listUsers({ limit: 100 }) });

  const assign = useMutation({
    mutationFn: (userIds: string[]) => setRoleUsers(roleId, userIds),
    onSuccess: () => { toast.success('Members updated.'); setOpen(false); qc.invalidateQueries({ queryKey: roleKeys.all }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const userOptions = userData?.data ?? [];
  const selectedIds = users.map((u) => u.id);

  const toggle = (id: string) => {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Members ({users.length})</h2>
        <button onClick={() => { setSelected([...selectedIds]); setOpen(true); }} className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-indigo-700">
          <UserPlus className="h-3 w-3" /> Manage
        </button>
      </div>
      {users.length === 0 ? (
        <p className="text-sm text-slate-400">No users assigned to this role.</p>
      ) : (
        <div className="space-y-2">
          {users.map((u) => (
            <div key={u.id} className="flex items-center gap-2 rounded-lg border border-slate-100 px-3 py-2">
              <Avatar name={u.name} size="sm" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-800">{u.name}</p>
                <p className="text-xs text-slate-400">@{u.username}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 pt-12" onClick={() => setOpen(false)}>
          <div className="w-full max-w-lg rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-slate-200 px-6 py-4"><h3 className="text-lg font-semibold text-slate-900">Manage Role Members</h3></div>
            <div className="max-h-80 space-y-1 overflow-y-auto px-6 py-4">
              {userOptions.map((u) => (
                <label key={u.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50">
                  <input type="checkbox" checked={selected.includes(u.id)} onChange={() => toggle(u.id)} className="h-4 w-4 rounded border-slate-300 text-indigo-600" />
                  <span className="text-sm text-slate-700">{u.name} <span className="text-xs text-slate-400">@{u.username}</span></span>
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <button onClick={() => setOpen(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={() => assign.mutate(selected)} disabled={assign.isPending} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
