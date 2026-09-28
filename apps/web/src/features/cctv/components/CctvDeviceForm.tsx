import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useWatch } from 'react-hook-form';
import {
  DEVICE_TYPE_OPTIONS,
  buildCctvDevicePayload,
  cctvDeviceFormSchema,
  deriveIntegrationProtocol,
  type CctvDeviceFormValues,
} from '../utils/validation';
import CctvProtocolBadge from './CctvProtocolBadge';
import type { CctvDevice, CctvDeviceInput } from '../types';

function inputClass(hasError?: boolean) {
  return `mt-1 block w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
    hasError ? 'border-red-300' : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-500'
  }`;
}

export default function CctvDeviceForm({
  device,
  isSubmitting,
  onSubmit,
}: {
  device?: CctvDevice;
  isSubmitting: boolean;
  onSubmit: (payload: CctvDeviceInput) => void;
}) {
  const navigate = useNavigate();
  const isEdit = !!device;

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<CctvDeviceFormValues>({
    resolver: zodResolver(cctvDeviceFormSchema),
    defaultValues: {
      name: device?.name ?? '',
      deviceType: device?.deviceType ?? 'DVR',
      brand: device?.brand ?? '',
      model: device?.model ?? '',
      ipAddress: device?.ipAddress ?? '',
      port: device?.port ?? 80,
      rtspPort: device?.rtspPort ?? 554,
      username: device?.username ?? '',
      password: '',
      location: device?.location ?? '',
      description: device?.description ?? '',
    },
  });

  const brandValue = useWatch({ control, name: 'brand' });
  const modelValue = useWatch({ control, name: 'model' });
  const derivedProtocol = deriveIntegrationProtocol(brandValue, modelValue);

  const submit = (values: CctvDeviceFormValues) => {
    onSubmit(buildCctvDevicePayload(values, { isEdit }) as unknown as CctvDeviceInput);
  };

  const cancelTo = isEdit && device ? `/cctv/devices/${device.id}` : '/cctv/devices';

  return (
    <div className="mx-auto max-w-3xl p-4 md:p-6">
      <button
        onClick={() => navigate(cancelTo)}
        className="mb-4 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" /> CCTV Devices
      </button>
      <h1 className="text-2xl font-bold text-slate-900">{isEdit ? 'Edit CCTV Device' : 'Tambah CCTV Device'}</h1>
      <p className="mt-1 text-sm text-slate-500">
        {isEdit
          ? 'Perbarui informasi device. Status koneksi diperbarui melalui Test Connection / Sync.'
          : 'Daftarkan DVR/NVR/Recorder. Protokol integrasi ditentukan otomatis dari vendor/tipe.'}
      </p>
      <p className="mt-2 flex items-center gap-2 text-sm text-slate-500">
        Integration Protocol: <CctvProtocolBadge protocol={derivedProtocol} />
        <span className="text-xs text-slate-400">
          (Hikvision → ISAPI, XMEye/ONVIF → ONVIF)
        </span>
      </p>

      <form onSubmit={handleSubmit(submit)} className="mt-6 space-y-6">
        <section className="rounded-lg border border-slate-200 bg-white p-5 md:p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">Device Information</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700">Device Name *</label>
              <input type="text" placeholder="Hikvision DVR" {...register('name')} className={inputClass(!!errors.name)} />
              {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Device Type *</label>
              <select {...register('deviceType')} className={inputClass(!!errors.deviceType)}>
                {DEVICE_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Brand</label>
              <input type="text" placeholder="Hikvision / XMEye" {...register('brand')} className={inputClass(!!errors.brand)} />
              {errors.brand && <p className="mt-1 text-xs text-red-500">{errors.brand.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Model</label>
              <input type="text" placeholder="Model perangkat" {...register('model')} className={inputClass(!!errors.model)} />
              {errors.model && <p className="mt-1 text-xs text-red-500">{errors.model.message}</p>}
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700">Location</label>
              <input type="text" placeholder="Ruang Server" {...register('location')} className={inputClass(!!errors.location)} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700">Description</label>
              <textarea rows={3} {...register('description')} className={inputClass(!!errors.description)} />
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 md:p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">Network &amp; Credential</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700">IP Address *</label>
              <input type="text" inputMode="numeric" placeholder="192.168.2.10" {...register('ipAddress')} className={inputClass(!!errors.ipAddress)} />
              {errors.ipAddress && <p className="mt-1 text-xs text-red-500">{errors.ipAddress.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Port (ONVIF) *</label>
              <input type="number" placeholder="80" {...register('port')} className={inputClass(!!errors.port)} />
              {errors.port && <p className="mt-1 text-xs text-red-500">{errors.port.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">RTSP Port *</label>
              <input type="number" placeholder="554" {...register('rtspPort')} className={inputClass(!!errors.rtspPort)} />
              {errors.rtspPort && <p className="mt-1 text-xs text-red-500">{errors.rtspPort.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Username</label>
              <input type="text" autoComplete="off" {...register('username')} className={inputClass(!!errors.username)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Password {isEdit && <span className="font-normal text-slate-400">(kosongkan bila tidak diubah)</span>}
              </label>
              <input
                type="password"
                autoComplete="new-password"
                placeholder={isEdit ? '••••••••' : ''}
                {...register('password')}
                className={inputClass(!!errors.password)}
              />
              {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>}
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-400">
            Credential disimpan terenkripsi dan tidak pernah dikirim kembali ke browser.
          </p>
        </section>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate(cancelTo)}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? 'Save Changes' : 'Create CCTV Device'}
          </button>
        </div>
      </form>
    </div>
  );
}
