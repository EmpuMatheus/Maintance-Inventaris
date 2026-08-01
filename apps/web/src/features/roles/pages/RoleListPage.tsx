import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { listRoles } from '../api/roles';
import ReportTable from '@/features/reports/components/ReportTable';
import type { Role } from '../types';

export default function RoleListPage() {
  const { can } = useAuth();
  const navigate = useNavigate();

  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: ['roles', 'list'], queryFn: listRoles });

  const columns = [
    { key: 'name', label: 'Role', render: (r: Role) => <span className="font-medium text-slate-900">{r.name}</span> },
    { key: 'description', label: 'Description', render: (r: Role) => <span className="text-slate-500">{r.description || '-'}</span> },
    { key: 'permissionCount', label: 'Permissions', render: (r: Role) => r.permissionCount },
    { key: 'userCount', label: 'Members', render: (r: Role) => r.userCount },
    { key: 'isActive', label: 'Status', render: (r: Role) => <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${r.isActive ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'}`}>{r.isActive ? 'Active' : 'Inactive'}</span> },
  ];

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Roles</h1>
          <p className="mt-1 text-sm text-slate-500">Roles control what each user can access.</p>
        </div>
        {can('role.create') && (
          <button onClick={() => navigate('/roles/new')} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700">
            <Plus className="h-4 w-4" /> New Role
          </button>
        )}
      </div>

      <ReportTable
        columns={columns}
        items={data?.data ?? []}
        rowKey={(r) => r.id}
        isLoading={isLoading}
        isError={isError}
        errorMessage={(error as Error)?.message}
        onRetry={() => refetch()}
        page={1}
        onPageChange={() => undefined}
        onRowClick={(r) => navigate(`/roles/${r.id}`)}
        emptyMessage="No roles found."
      />
    </div>
  );
}
