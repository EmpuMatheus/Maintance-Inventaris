import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { createResource, updateResource } from '../api/master-data';
import type { ModuleConfig, MasterDataRecord } from '../types';

interface Props {
  config: ModuleConfig;
  record: MasterDataRecord | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function MasterDataForm({ config, record, onClose, onSuccess }: Props) {
  const isEdit = !!record;
  const [form, setForm] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const f of config.fields) {
      if (f.type === 'hidden') continue;
      initial[f.key] = record ? String((record as any)[f.key] ?? '') : '';
    }
    return initial;
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const mutate = useMutation({
    mutationFn: () => {
      const payload: Record<string, unknown> = {};
      for (const f of config.fields) {
        if (f.type === 'hidden') continue;
        const val = form[f.key];
        payload[f.key] = val === '' ? undefined : val;
      }
      if (isEdit) return updateResource(config.path, record!.id, payload);
      return createResource(config.path, payload);
    },
    onSuccess: () => {
      toast.success(`${config.label} ${isEdit ? 'updated' : 'created'} successfully`);
      onSuccess();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function validate() {
    const errs: Record<string, string> = {};
    for (const f of config.fields) {
      if (f.type === 'hidden') continue;
      if (f.required && !form[f.key]?.trim()) {
        errs[f.key] = `${f.label} is required`;
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (validate()) mutate.mutate();
  }

  function setValue(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => { const n = { ...prev }; delete n[key]; return n; });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 pt-12">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h3 className="text-lg font-semibold text-slate-900">
            {isEdit ? `Edit ${config.label}` : `New ${config.label}`}
          </h3>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-4">
          {config.fields.filter(f => f.type !== 'hidden').map((field) => (
            <div key={field.key}>
              <label className="block text-sm font-medium text-slate-700">
                {field.label}{field.required ? ' *' : ''}
              </label>
              {field.type === 'textarea' ? (
                <textarea
                  value={form[field.key] ?? ''}
                  onChange={(e) => setValue(field.key, e.target.value)}
                  rows={3}
                  className={`mt-1 block w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${errors[field.key] ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-500'}`}
                  placeholder={field.placeholder}
                />
              ) : field.type === 'select' ? (
                <select
                  value={form[field.key] ?? ''}
                  onChange={(e) => setValue(field.key, e.target.value)}
                  className={`mt-1 block w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${errors[field.key] ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-500'}`}
                >
                  <option value="">Select {field.label.toLowerCase()}</option>
                  {field.options?.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              ) : (
                <input
                  type={field.type}
                  value={form[field.key] ?? ''}
                  onChange={(e) => setValue(field.key, e.target.value)}
                  className={`mt-1 block w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${errors[field.key] ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-500'}`}
                  placeholder={field.placeholder}
                />
              )}
              {errors[field.key] && <p className="mt-1 text-xs text-red-500">{errors[field.key]}</p>}
            </div>
          ))}
          <div className="flex justify-end gap-3 border-t border-slate-200 pt-4 pb-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={mutate.isPending} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
              {mutate.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
