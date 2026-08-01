import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, KeyRound, Loader2, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { getUser, deleteUser, setUserPassword, userKeys } from '../api/users';
import Avatar from '../components/Avatar';
import PasswordResetDialog from '../components/PasswordResetDialog';

function formatDateTime(value?: string | null): string {
  if (!value) return '-';
  return new Date(value).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function UserDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const qc = useQueryClient();
  const [showReset, setShowReset] = useState(false);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: userKeys.detail(id ?? ''),
    queryFn: () => getUser(id!),
    enabled: !!id,
  });

  const resetPassword = useMutation({
    mutationFn: (password: string) => setUserPassword(id!, password),
    onSuccess: () => { toast.success('Password reset.'); setShowReset(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: () => deleteUser(id!),
    onSuccess: () => { toast.success('User deleted.'); qc.invalidateQueries({ queryKey: userKeys.all }); navigate('/users'); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>;
  if (isError) return <div className="p-6 text-center text-red-500">{(error as Error)?.message || 'Unable to load user.'}</div>;
  if (!data?.data) return <div className="p-6 text-center text-slate-400">User not found.</div>;

  const u = data.data;
  const InfoRow = ({ label, value }: { label: string; value?: string | null }) => (
    <div className="flex justify-between gap-4 border-b border-slate-100 py-2 text-sm last:border-0">
      <span className="shrink-0 text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-900">{value || '-'}</span>
    </div>
  );

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-6">
      <button onClick={() => navigate('/users')} className="mb-4 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" /> Users
      </button>

      <div className="mb-6 rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Avatar name={u.name} size="lg" />
            <div>
              <h1 className="text-xl font-bold text-slate-900">{u.name}</h1>
              <p className="text-sm text-slate-400">@{u.username} · {u.employeeCode}</p>
              <span className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${u.isActive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {u.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {can('user.update') && (
              <>
                <button onClick={() => setShowReset(true)} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
                  <KeyRound className="h-4 w-4" /> Reset Password
                </button>
                <button onClick={() => navigate(`/users/${u.id}/edit`)} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
                  <Pencil className="h-4 w-4" /> Edit
                </button>
              </>
            )}
            {can('user.delete') && (
              <button onClick={() => remove.mutate()} className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50">
                <Trash2 className="h-4 w-4" /> Delete
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">Profile</h2>
          <InfoRow label="Name" value={u.name} />
          <InfoRow label="Email" value={u.email} />
          <InfoRow label="Phone" value={u.phone} />
          <InfoRow label="Position" value={u.position} />
          <InfoRow label="Department" value={u.department} />
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">Access</h2>
          <InfoRow label="Roles" value={u.roles.join(', ') || '-'} />
          <InfoRow label="Last Login" value={formatDateTime(u.lastLoginAt)} />
          <InfoRow label="Created" value={formatDateTime(u.createdAt)} />
          <InfoRow label="Updated" value={formatDateTime(u.updatedAt)} />
        </div>
      </div>

      <PasswordResetDialog open={showReset} isSubmitting={resetPassword.isPending} onClose={() => setShowReset(false)} onSubmit={(p) => resetPassword.mutate(p)} />
    </div>
  );
}
