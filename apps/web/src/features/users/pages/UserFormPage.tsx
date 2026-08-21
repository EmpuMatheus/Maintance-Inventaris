import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { createUser, updateUser, getUser, userKeys } from '../api/users';
import { listRoles } from '@/features/roles/api/roles';
import { listMaster } from '@/features/inventory/api/inventory';
import UserForm from '../components/UserForm';
import type { CategoryOption, RoleOption } from '../types';

export default function UserFormPage() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [roleId, setRoleId] = useState('');
  const [categoryId, setCategoryId] = useState('');

  const { data: rolesData } = useQuery({ queryKey: ['roles', 'list'], queryFn: listRoles });
  const roles = (rolesData?.data ?? []) as RoleOption[];

  const { data: categoriesData } = useQuery({ queryKey: ['master', 'categories'], queryFn: () => listMaster('categories') });
  const categories = (categoriesData?.data ?? []) as CategoryOption[];

  const { data, isLoading } = useQuery({
    queryKey: userKeys.detail(id ?? ''),
    queryFn: () => getUser(id!),
    enabled: isEdit,
  });

  useEffect(() => {
    const user = data?.data;
    if (!user || roles.length === 0) return;
    const role = roles.find((r) => r.name === user.roles[0]);
    setRoleId(role?.id ?? '');
    setCategoryId(user.categoryIds?.[0] ?? '');
  }, [data, roles]);

  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => (isEdit ? updateUser(id!, payload) : createUser(payload)),
    onSuccess: (res) => {
      toast.success(isEdit ? 'User updated.' : 'User created.');
      qc.invalidateQueries({ queryKey: userKeys.all });
      navigate(`/users/${res.data.id}`, { replace: true });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>;

  return (
    <UserForm
      user={data?.data}
      roles={roles}
      categories={categories}
      roleId={roleId}
      categoryId={categoryId}
      onRoleChange={(rid) => { setRoleId(rid); setCategoryId(''); }}
      onCategoryChange={setCategoryId}
      isSubmitting={mutation.isPending}
      onSubmit={(payload) => mutation.mutate(payload)}
    />
  );
}
