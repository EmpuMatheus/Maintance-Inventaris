import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { listMaster } from '@/features/inventory/api/inventory';
import RoleSelector from './RoleSelector';
import type { CategoryOption, RoleOption, User } from '../types';

const CATEGORY_REQUIRED_ROLES = ['ADMIN', 'TECHNICIAN'];

const schema = z.object({
  employeeCode: z.string().min(1, 'Employee code is required.'),
  name: z.string().min(1, 'Name is required.'),
  email: z.string().email('Invalid email.').optional().or(z.literal('')),
  username: z.string().min(3, 'Username must be at least 3 characters.'),
  password: z.string().optional(),
  departmentId: z.string().optional(),
  phone: z.string().optional(),
  position: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

function inputClass(hasError?: boolean) {
  return `mt-1 block w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
    hasError ? 'border-red-300' : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-500'
  }`;
}

export default function UserForm({
  user,
  roles,
  categories,
  roleId,
  categoryId,
  onRoleChange,
  onCategoryChange,
  isSubmitting,
  onSubmit,
}: {
  user?: User;
  roles: RoleOption[];
  categories: CategoryOption[];
  roleId: string;
  categoryId: string;
  onRoleChange: (roleId: string) => void;
  onCategoryChange: (categoryId: string) => void;
  isSubmitting: boolean;
  onSubmit: (data: Record<string, unknown>) => void;
}) {
  const navigate = useNavigate();
  const isEdit = !!user;

  const { data: departments } = useQuery({ queryKey: ['master', 'departments'], queryFn: () => listMaster('departments') });
  const depts = ((departments as unknown as { data?: { id: string; name: string; code?: string }[] })?.data ?? []) as { id: string; name: string; code?: string }[];

  const selectedRole = roles.find((r) => r.id === roleId);
  const needsCategory = selectedRole ? CATEGORY_REQUIRED_ROLES.includes(selectedRole.name) : false;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      employeeCode: user?.employeeCode ?? '',
      name: user?.name ?? '',
      email: user?.email ?? '',
      username: user?.username ?? '',
      password: '',
      departmentId: user?.departmentId ?? '',
      phone: user?.phone ?? '',
      position: user?.position ?? '',
    },
  });

  const submit = (values: FormValues) => {
    if (!roleId) {
      toast.error('Please select a role.');
      return;
    }
    if (needsCategory && !categoryId) {
      toast.error('This role requires an asset category.');
      return;
    }
    const payload: Record<string, unknown> = {
      name: values.name,
      email: values.email || null,
      departmentId: values.departmentId || null,
      phone: values.phone || null,
      position: values.position || null,
      roleId,
      categoryId: categoryId || null,
    };
    if (!isEdit) {
      payload.employeeCode = values.employeeCode;
      payload.username = values.username;
      payload.password = values.password;
    }
    onSubmit(payload);
  };

  return (
    <div className="mx-auto max-w-2xl p-4 md:p-6">
      <button onClick={() => navigate(isEdit ? `/users/${user!.id}` : '/users')} className="mb-4 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" /> Users
      </button>
      <h1 className="text-2xl font-bold text-slate-900">{isEdit ? 'Edit User' : 'Create User'}</h1>
      <p className="mt-1 text-sm text-slate-500">{isEdit ? user?.username : 'Add a new system user.'}</p>

      <form onSubmit={handleSubmit(submit)} className="mt-6 space-y-4 rounded-lg border border-slate-200 bg-white p-5 md:p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700">Name *</label>
            <input type="text" {...register('name')} className={inputClass(!!errors.name)} />
            {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Employee Code {!isEdit && '*'}</label>
            <input type="text" {...register('employeeCode')} disabled={isEdit} className={`${inputClass(!!errors.employeeCode)} disabled:bg-slate-50`} />
            {errors.employeeCode && <p className="mt-1 text-xs text-red-500">{errors.employeeCode.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Username {!isEdit && '*'}</label>
            <input type="text" {...register('username')} disabled={isEdit} className={`${inputClass(!!errors.username)} disabled:bg-slate-50`} />
            {errors.username && <p className="mt-1 text-xs text-red-500">{errors.username.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Email</label>
            <input type="email" {...register('email')} className={inputClass(!!errors.email)} />
            {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
          </div>
          {!isEdit && (
            <div>
              <label className="block text-sm font-medium text-slate-700">Password *</label>
              <input type="password" {...register('password')} className={inputClass(!!errors.password)} />
              {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700">Department</label>
            <select {...register('departmentId')} className={inputClass()}>
              <option value="">None</option>
              {depts.map((d) => <option key={d.id} value={d.id}>{d.code ? `${d.code} - ${d.name}` : d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Phone</label>
            <input type="text" {...register('phone')} className={inputClass()} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Position</label>
            <input type="text" {...register('position')} className={inputClass()} />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Role *</label>
          <RoleSelector roles={roles} value={roleId} onChange={onRoleChange} />
        </div>

        {needsCategory && (
          <div>
            <label className="block text-sm font-medium text-slate-700">Asset Category *</label>
            <select value={categoryId} onChange={(e) => onCategoryChange(e.target.value)} className={inputClass()}>
              <option value="">Select category...</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.code} - {c.name}</option>)}
            </select>
            {!categoryId && <p className="mt-1 text-xs text-red-500">This role requires an asset category.</p>}
          </div>
        )}

        {!needsCategory && !roleId && <p className="text-xs text-slate-400">Select a role to continue.</p>}

        <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
          <button type="button" onClick={() => navigate(isEdit ? `/users/${user!.id}` : '/users')} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
          <button type="submit" disabled={isSubmitting} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? 'Save Changes' : 'Create User'}
          </button>
        </div>
      </form>
    </div>
  );
}
