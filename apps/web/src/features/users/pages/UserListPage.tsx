import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { listUsers, setUserStatus, userKeys } from '../api/users';
import UserFilters from '../components/UserFilters';
import Avatar from '../components/Avatar';
import StatusToggle from '../components/StatusToggle';
import ReportTable from '@/features/reports/components/ReportTable';
import type { User, UserFilters as Filters } from '../types';

const INITIAL: Filters = { page: 1, limit: 25 };

function formatDate(value?: string | null): string {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function UserListPage() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [filters, setFilters] = useState<Filters>(INITIAL);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: userKeys.list(filters),
    queryFn: () => listUsers(filters),
  });

  const toggleStatus = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => setUserStatus(id, isActive),
    onSuccess: () => { toast.success('User status updated.'); qc.invalidateQueries({ queryKey: userKeys.all }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const onChange = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }));
  const onPageChange = (p: number) => setFilters((f) => ({ ...f, page: p }));
  const onSort = (sortBy: string, sortOrder: 'asc' | 'desc') => setFilters((f) => ({ ...f, sortBy, sortOrder, page: 1 }));

  const columns = [
    { key: 'user', label: 'User', render: (u: User) => (
      <span className="flex items-center gap-2">
        <Avatar name={u.name} size="sm" />
        <span>
          <span className="block font-medium text-slate-900">{u.name}</span>
          <span className="block text-xs text-slate-400">@{u.username}</span>
        </span>
      </span>
    )},
    { key: 'employeeCode', label: 'Employee Code', sortable: true, render: (u: User) => <span className="font-mono text-xs text-slate-600">{u.employeeCode}</span> },
    { key: 'email', label: 'Email', render: (u: User) => u.email || '-' },
    { key: 'department', label: 'Department', render: (u: User) => u.department || '-' },
    { key: 'roles', label: 'Role', render: (u: User) => <span className="text-xs text-slate-500">{u.roles.join(', ') || '-'}</span> },
    { key: 'categories', label: 'Category', render: (u: User) => <span className="text-xs text-slate-500">{u.categories.join(', ') || '-'}</span> },
    { key: 'lastLoginAt', label: 'Last Login', render: (u: User) => <span className="text-xs text-slate-400">{formatDate(u.lastLoginAt)}</span> },
    { key: 'isActive', label: 'Active', render: (u: User) => (
      <span onClick={(e) => e.stopPropagation()}>
        <StatusToggle active={u.isActive} disabled={!can('user.update')} onChange={(v) => toggleStatus.mutate({ id: u.id, isActive: v })} />
      </span>
    )},
  ];

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Users</h1>
          <p className="mt-1 text-sm text-slate-500">Manage system users and their roles.</p>
        </div>
        {can('user.create') && (
          <button onClick={() => navigate('/users/new')} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700">
            <Plus className="h-4 w-4" /> New User
          </button>
        )}
      </div>

      <UserFilters value={filters} onChange={onChange} onReset={() => setFilters(INITIAL)} />

      <ReportTable
        columns={columns}
        items={data?.data ?? []}
        rowKey={(u) => u.id}
        isLoading={isLoading}
        isError={isError}
        errorMessage={(error as Error)?.message}
        onRetry={() => refetch()}
        page={filters.page ?? 1}
        meta={data?.meta}
        onPageChange={onPageChange}
        onSort={onSort}
        onRowClick={(u) => navigate(`/users/${u.id}`)}
        emptyMessage="No users found."
      />
    </div>
  );
}
