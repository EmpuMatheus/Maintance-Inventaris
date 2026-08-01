import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PermissionMatrix from './PermissionMatrix';
import { useQuery } from '@tanstack/react-query';
import { listPermissions } from '../api/roles';
import type { Role } from '../types';

const schema = z.object({
  name: z.string().min(1, 'Role name is required.'),
  description: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

function inputClass(hasError?: boolean) {
  return `mt-1 block w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
    hasError ? 'border-red-300' : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-500'
  }`;
}

export default function RoleForm({
  role,
  selectedPermissions,
  onPermissionsChange,
  isSubmitting,
  onSubmit,
}: {
  role?: Role;
  selectedPermissions: string[];
  onPermissionsChange: (permissions: string[]) => void;
  isSubmitting: boolean;
  onSubmit: (data: Record<string, unknown>) => void;
}) {
  const navigate = useNavigate();
  const isEdit = !!role;

  const { data: perms } = useQuery({ queryKey: ['roles', 'permissions'], queryFn: listPermissions });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: role?.name ?? '', description: role?.description ?? '' },
  });

  const submit = (values: FormValues) => {
    const payload: Record<string, unknown> = {
      name: values.name,
      description: values.description || null,
    };
    if (!isEdit) payload.permissions = selectedPermissions;
    onSubmit(payload);
  };

  return (
    <div className="mx-auto max-w-3xl p-4 md:p-6">
      <button onClick={() => navigate(isEdit ? `/roles/${role!.id}` : '/roles')} className="mb-4 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" /> Roles
      </button>
      <h1 className="text-2xl font-bold text-slate-900">{isEdit ? 'Edit Role' : 'Create Role'}</h1>
      <p className="mt-1 text-sm text-slate-500">{isEdit ? role?.name : 'Define a new role.'}</p>

      <form onSubmit={handleSubmit(submit)} className="mt-6 space-y-5 rounded-lg border border-slate-200 bg-white p-5 md:p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700">Role Name *</label>
            <input type="text" {...register('name')} className={inputClass(!!errors.name)} />
            {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Description</label>
            <input type="text" {...register('description')} className={inputClass()} />
          </div>
        </div>

        {!isEdit && (
          <div>
            <label className="block text-sm font-medium text-slate-700">Permissions</label>
            <div className="mt-1">
              <PermissionMatrix permissions={perms?.data ?? []} selected={selectedPermissions} onChange={onPermissionsChange} />
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
          <button type="button" onClick={() => navigate(isEdit ? `/roles/${role!.id}` : '/roles')} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
          <button type="submit" disabled={isSubmitting} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? 'Save Changes' : 'Create Role'}
          </button>
        </div>
      </form>
    </div>
  );
}
