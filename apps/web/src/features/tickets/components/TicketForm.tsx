import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { listMaster } from '@/features/inventory/api/inventory';
import SearchableAssetSelect from '@/features/inventory/components/SearchableAssetSelect';
import { TICKET_CATEGORIES } from '../constants';
import type { Ticket } from '../types';

const schema = z.object({
  title: z.string().min(1, 'Subject is required.'),
  description: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  category: z.string().optional(),
  assetId: z.string().optional(),
  departmentId: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

function inputClass(hasError?: boolean) {
  return `mt-1 block w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
    hasError ? 'border-red-300' : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-500'
  }`;
}

export default function TicketForm({
  ticket,
  isSubmitting,
  onSubmit,
}: {
  ticket?: Ticket;
  isSubmitting: boolean;
  onSubmit: (data: Record<string, unknown>) => void;
}) {
  const navigate = useNavigate();
  const isEdit = !!ticket;

  const { data: departments } = useQuery({
    queryKey: ['master', 'departments'],
    queryFn: () => listMaster('departments'),
  });
  const departmentList = (departments?.data ?? []) as { id: string; name: string; code?: string }[];

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: ticket?.title ?? '',
      description: ticket?.description ?? '',
      priority: ticket?.priority ?? 'MEDIUM',
      category: ticket?.category ?? '',
      assetId: ticket?.assetId ?? '',
      departmentId: ticket?.departmentId ?? '',
    },
  });

  const submit = (values: FormValues) => {
    onSubmit({
      title: values.title,
      description: values.description || null,
      priority: values.priority,
      category: values.category || null,
      assetId: values.assetId || null,
      departmentId: values.departmentId || null,
    });
  };

  return (
    <div className="mx-auto max-w-2xl p-4 md:p-6">
      <button onClick={() => navigate(isEdit ? `/tickets/${ticket!.id}` : '/tickets')} className="mb-4 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" /> Tickets
      </button>

      <h1 className="text-2xl font-bold text-slate-900">{isEdit ? 'Edit Ticket' : 'Create Ticket'}</h1>
      <p className="mt-1 text-sm text-slate-500">{isEdit ? ticket?.ticketCode : 'Report an asset problem.'}</p>

      <form onSubmit={handleSubmit(submit)} className="mt-6 space-y-5 rounded-lg border border-slate-200 bg-white p-5 md:p-6">
        <div>
          <label className="block text-sm font-medium text-slate-700">Subject *</label>
          <input type="text" {...register('title')} className={inputClass(!!errors.title)} placeholder="e.g. Laptop cannot turn on" />
          {errors.title && <p className="mt-1 text-xs text-red-500">{errors.title.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Description</label>
          <textarea {...register('description')} rows={4} className={inputClass()} placeholder="Describe the problem in detail..." />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
            <label className="block text-sm font-medium text-slate-700">Category</label>
            <select {...register('category')} className={inputClass()}>
              <option value="">None</option>
              {TICKET_CATEGORIES.map((c) => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Related Asset</label>
          <Controller
            name="assetId"
            control={control}
            render={({ field }) => <SearchableAssetSelect value={field.value ?? ''} onChange={field.onChange} />}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Department</label>
          <select {...register('departmentId')} className={inputClass()}>
            <option value="">None</option>
            {departmentList.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
          <button type="button" onClick={() => navigate(isEdit ? `/tickets/${ticket!.id}` : '/tickets')} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? 'Save Changes' : 'Create Ticket'}
          </button>
        </div>
      </form>
    </div>
  );
}
