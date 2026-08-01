import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { createMaintenance, maintenanceKeys } from '../api/maintenance';
import { listMaster } from '@/features/inventory/api/inventory';
import SearchableAssetSelect from '@/features/inventory/components/SearchableAssetSelect';

const schema = z.object({
  assetId: z.string().min(1, 'Asset is required.'),
  maintenanceTypeId: z.string().optional(),
  maintenanceCategory: z.enum(['PREVENTIVE', 'CORRECTIVE']),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  problem: z.string().min(3, 'Problem description is required.'),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function MaintenanceForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: types } = useQuery({
    queryKey: ['master', 'maintenance-types'],
    queryFn: () => listMaster('maintenance-types'),
  });

  const maintenanceTypes = (types?.data ?? []) as { id: string; name: string; maintenanceCategory?: string }[];

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      assetId: '',
      maintenanceTypeId: '',
      maintenanceCategory: 'CORRECTIVE',
      priority: 'MEDIUM',
      problem: '',
      notes: '',
    },
  });

  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => createMaintenance(payload),
    onSuccess: (res) => {
      toast.success('Maintenance created successfully.');
      queryClient.invalidateQueries({ queryKey: maintenanceKeys.all });
      navigate(`/maintenance/${res.data.id}`, { replace: true });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const onSubmit = (values: FormValues) => {
    const selectedType = maintenanceTypes.find((t) => t.id === values.maintenanceTypeId);
    mutation.mutate({
      assetId: values.assetId,
      maintenanceTypeId: values.maintenanceTypeId || null,
      maintenanceCategory: selectedType?.maintenanceCategory || values.maintenanceCategory,
      priority: values.priority,
      problem: values.problem,
      notes: values.notes || null,
    });
  };

  const inputClass = (hasError?: boolean) =>
    `mt-1 block w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
      hasError ? 'border-red-300' : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-500'
    }`;

  return (
    <div className="mx-auto max-w-2xl p-4 md:p-6">
      <button onClick={() => navigate('/maintenance')} className="mb-4 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" /> Maintenance
      </button>

      <h1 className="text-2xl font-bold text-slate-900">Create Maintenance</h1>
      <p className="mt-1 text-sm text-slate-500">Report a maintenance request for an asset.</p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-5 rounded-lg border border-slate-200 bg-white p-5 md:p-6">
        <div>
          <label className="block text-sm font-medium text-slate-700">Asset *</label>
          <Controller
            name="assetId"
            control={control}
            render={({ field }) => (
              <SearchableAssetSelect value={field.value} onChange={field.onChange} hasError={!!errors.assetId} />
            )}
          />
          {errors.assetId && <p className="mt-1 text-xs text-red-500">{errors.assetId.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Maintenance Type</label>
          <select {...register('maintenanceTypeId')} className={inputClass(!!errors.maintenanceTypeId)}>
            <option value="">None</option>
            {maintenanceTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          {errors.maintenanceTypeId && <p className="mt-1 text-xs text-red-500">{errors.maintenanceTypeId.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Priority</label>
          <select {...register('priority')} className={inputClass()}>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="CRITICAL">Critical</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Problem Description *</label>
          <textarea
            {...register('problem')}
            rows={4}
            placeholder="Describe the problem with the asset..."
            className={inputClass(!!errors.problem)}
          />
          {errors.problem && <p className="mt-1 text-xs text-red-500">{errors.problem.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Notes</label>
          <textarea {...register('notes')} rows={2} placeholder="Additional notes (optional)" className={inputClass()} />
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
          <button type="button" onClick={() => navigate('/maintenance')} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || mutation.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {isSubmitting || mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Create Maintenance
          </button>
        </div>
      </form>
    </div>
  );
}
