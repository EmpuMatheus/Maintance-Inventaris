import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { createSchedule, scheduleKeys } from '../api/schedules';
import { listMaster } from '@/features/inventory/api/inventory';
import SearchableAssetSelect from '@/features/inventory/components/SearchableAssetSelect';
import { SCHEDULE_FREQUENCIES, SCHEDULE_FREQUENCY_LABELS } from './schedule-constants';

const schema = z.object({
  assetId: z.string().min(1, 'Asset is required.'),
  maintenanceTypeId: z.string().optional(),
  frequencyType: z.enum(SCHEDULE_FREQUENCIES),
  frequencyValue: z.coerce.number().int().min(1, 'Interval must be at least 1.'),
  startDate: z.string().min(1, 'Start date is required.'),
  reminderDays: z.coerce.number().int().min(0).optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

function inputClass(hasError?: boolean) {
  return `mt-1 block w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
    hasError ? 'border-red-300' : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-500'
  }`;
}

export default function ScheduleFormModal({
  onClose,
}: {
  onClose: () => void;
}) {
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
      frequencyType: 'MONTHLY',
      frequencyValue: 1,
      startDate: new Date().toISOString().slice(0, 10),
      reminderDays: 7,
      notes: '',
    },
  });

  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => createSchedule(payload),
    onSuccess: () => {
      toast.success('Maintenance schedule created.');
      queryClient.invalidateQueries({ queryKey: scheduleKeys.all });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const onSubmit = (values: FormValues) => {
    mutation.mutate({
      assetId: values.assetId,
      maintenanceTypeId: values.maintenanceTypeId || null,
      frequencyType: values.frequencyType,
      frequencyValue: values.frequencyValue,
      startDate: values.startDate,
      reminderDays: values.reminderDays ?? 7,
      notes: values.notes || null,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 pt-12" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-slate-200 px-6 py-4">
          <h3 className="text-lg font-semibold text-slate-900">New Maintenance Schedule</h3>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 px-6 py-4">
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700">Maintenance Type</label>
              <select {...register('maintenanceTypeId')} className={inputClass()}>
                <option value="">None</option>
                {maintenanceTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Frequency *</label>
              <select {...register('frequencyType')} className={inputClass()}>
                {SCHEDULE_FREQUENCIES.map((f) => <option key={f} value={f}>{SCHEDULE_FREQUENCY_LABELS[f]}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-slate-700">Interval *</label>
              <input type="number" min={1} {...register('frequencyValue')} className={inputClass(!!errors.frequencyValue)} />
              {errors.frequencyValue && <p className="mt-1 text-xs text-red-500">{errors.frequencyValue.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Start Date *</label>
              <input type="date" {...register('startDate')} className={inputClass(!!errors.startDate)} />
              {errors.startDate && <p className="mt-1 text-xs text-red-500">{errors.startDate.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Reminder Days</label>
              <input type="number" min={0} {...register('reminderDays')} className={inputClass()} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Notes</label>
            <textarea {...register('notes')} rows={2} className={inputClass()} />
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || mutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {isSubmitting || mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Create Schedule
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
