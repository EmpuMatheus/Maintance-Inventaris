import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { createUser, updateUser, getUser, userKeys } from '../api/users';
import { listRoles } from '@/features/roles/api/roles';
import UserForm from '../components/UserForm';
import type { RoleOption } from '../types';

export default function UserFormPage() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);

  const { data: rolesData } = useQuery({ queryKey: ['roles', 'list'], queryFn: listRoles });
  const roles = (rolesData?.data ?? []) as RoleOption[];

  const { data, isLoading } = useQuery({
    queryKey: userKeys.detail(id ?? ''),
    queryFn: () => getUser(id!),
    enabled: isEdit,
  });

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
      selectedRoles={selectedRoles}
      onRolesChange={setSelectedRoles}
      isSubmitting={mutation.isPending}
      onSubmit={(payload) => mutation.mutate(payload)}
    />
  );
}
