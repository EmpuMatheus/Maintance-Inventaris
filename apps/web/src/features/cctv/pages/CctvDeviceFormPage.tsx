import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { createCctvDevice, getCctvDevice, updateCctvDevice, cctvDeviceKeys } from '../api/cctv';
import CctvDeviceForm from '../components/CctvDeviceForm';
import type { CctvDeviceInput } from '../types';

export default function CctvDeviceFormPage() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: cctvDeviceKeys.detail(id ?? ''),
    queryFn: () => getCctvDevice(id!),
    enabled: isEdit,
  });

  const mutation = useMutation({
    mutationFn: (payload: CctvDeviceInput) =>
      isEdit ? updateCctvDevice(id!, payload) : createCctvDevice(payload),
    onSuccess: (res) => {
      toast.success(isEdit ? 'CCTV device updated.' : 'CCTV device created.');
      qc.invalidateQueries({ queryKey: cctvDeviceKeys.all });
      if (isEdit) qc.invalidateQueries({ queryKey: cctvDeviceKeys.detail(id!) });
      else qc.invalidateQueries({ queryKey: cctvDeviceKeys.detail(res.data.id) });
      navigate('/cctv/devices', { replace: true });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isEdit && isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (isEdit && isError) {
    return (
      <div className="p-6 text-center">
        <p className="mb-2 text-sm text-red-500">{(error as Error)?.message || 'Unable to load CCTV device.'}</p>
        <button
          onClick={() => refetch()}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <CctvDeviceForm
      device={data?.data}
      isSubmitting={mutation.isPending}
      onSubmit={(payload) => mutation.mutate(payload)}
    />
  );
}
