import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { createRole, updateRole, getRole, roleKeys } from '../api/roles';
import RoleForm from '../components/RoleForm';

export default function RoleFormPage() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: roleKeys.detail(id ?? ''),
    queryFn: () => getRole(id!),
    enabled: isEdit,
  });

  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => (isEdit ? updateRole(id!, payload) : createRole(payload)),
    onSuccess: (res) => {
      toast.success(isEdit ? 'Role updated.' : 'Role created.');
      qc.invalidateQueries({ queryKey: roleKeys.all });
      navigate(`/roles/${res.data.id}`, { replace: true });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>;

  return (
    <RoleForm
      role={data?.data}
      selectedPermissions={selectedPermissions}
      onPermissionsChange={setSelectedPermissions}
      isSubmitting={mutation.isPending}
      onSubmit={(payload) => mutation.mutate(payload)}
    />
  );
}
