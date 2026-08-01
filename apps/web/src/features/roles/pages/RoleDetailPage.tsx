import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { getRole, deleteRole, setRolePermissions, listPermissions, roleKeys } from '../api/roles';
import PermissionMatrix from '../components/PermissionMatrix';
import RoleUsersCard from '../components/RoleUsersCard';

export default function RoleDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string[] | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: roleKeys.detail(id ?? ''),
    queryFn: () => getRole(id!),
    enabled: !!id,
  });

  const { data: allPermissions } = useQuery({ queryKey: ['roles', 'permissions'], queryFn: listPermissions });

  const savePermissions = useMutation({
    mutationFn: (permissions: string[]) => setRolePermissions(id!, permissions),
    onSuccess: () => { toast.success('Permissions saved.'); setSelected(null); qc.invalidateQueries({ queryKey: roleKeys.all }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: () => deleteRole(id!),
    onSuccess: () => { toast.success('Role deactivated.'); qc.invalidateQueries({ queryKey: roleKeys.all }); navigate('/roles'); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>;
  if (isError) return <div className="p-6 text-center text-red-500">{(error as Error)?.message || 'Unable to load role.'}</div>;
  if (!data?.data) return <div className="p-6 text-center text-slate-400">Role not found.</div>;

  const role = data.data;
  const editable = selected !== null;

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-6">
      <button onClick={() => navigate('/roles')} className="mb-4 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" /> Roles
      </button>

      <div className="mb-6 rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">{role.name}</h1>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${role.isActive ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'}`}>{role.isActive ? 'Active' : 'Inactive'}</span>
            </div>
            <p className="mt-1 text-sm text-slate-500">{role.description || 'No description.'}</p>
            <p className="mt-1 text-xs text-slate-400">{role.permissionCount} permissions · {role.userCount} members</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {can('role.update') && (
              <button onClick={() => navigate(`/roles/${role.id}/edit`)} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
                <Pencil className="h-4 w-4" /> Edit
              </button>
            )}
            {can('role.delete') && (
              <button onClick={() => remove.mutate()} className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50">
                <Trash2 className="h-4 w-4" /> Deactivate
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-5 md:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Permissions</h2>
            {can('role.update') && (
              editable ? (
                <div className="flex items-center gap-2">
                  <button onClick={() => setSelected(null)} className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
                  <button onClick={() => savePermissions.mutate(selected)} disabled={savePermissions.isPending} className="rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50">Save</button>
                </div>
              ) : (
                <button onClick={() => setSelected((role.permissions ?? []).map((p) => p.id))} className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50">Edit</button>
              )
            )}
          </div>
          <PermissionMatrix
            permissions={allPermissions?.data ?? []}
            selected={editable ? selected! : (role.permissions ?? []).map((p) => p.id)}
            onChange={editable ? setSelected : () => undefined}
          />
        </div>
        <div>
          <RoleUsersCard roleId={role.id} users={role.users ?? []} />
        </div>
      </div>
    </div>
  );
}
