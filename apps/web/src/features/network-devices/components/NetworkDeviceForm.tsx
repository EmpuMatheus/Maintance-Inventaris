import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { listMaster } from '@/features/inventory/api/inventory';
import NetworkDeviceAssetSelect, { type AssetOption } from './NetworkDeviceAssetSelect';
import {
  buildNetworkDevicePayload,
  networkDeviceFormSchema,
  type NetworkDeviceFormValues,
} from '../utils/validation';
import type { NetworkDevice, NetworkDeviceInput } from '../types';

const DEVICE_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'COMPUTER', label: 'Computer' },
  { value: 'SWITCH', label: 'Switch' },
];

function inputClass(hasError?: boolean) {
  return `mt-1 block w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
    hasError ? 'border-red-300' : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-500'
  }`;
}

export default function NetworkDeviceForm({
  device,
  isSubmitting,
  onSubmit,
}: {
  device?: NetworkDevice;
  isSubmitting: boolean;
  onSubmit: (payload: NetworkDeviceInput) => void;
}) {
  const navigate = useNavigate();
  const isEdit = !!device;

  const { data: roomsData } = useQuery({ queryKey: ['master', 'rooms'], queryFn: () => listMaster('rooms') });
  const rooms = (roomsData?.data ?? []) as { id: string; name?: string; code?: string }[];

  const [assetId, setAssetId] = useState(device?.assetId ?? '');
  const initialAsset: AssetOption | null = device?.asset
    ? { id: device.asset.id, assetCode: device.asset.assetCode, assetName: device.asset.assetName }
    : null;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<NetworkDeviceFormValues>({
    resolver: zodResolver(networkDeviceFormSchema),
    defaultValues: {
      name: device?.name ?? '',
      deviceType: device?.deviceType ?? 'COMPUTER',
      ipAddress: device?.ipAddress ?? '',
      hostname: device?.hostname ?? '',
      macAddress: device?.macAddress ?? '',
      roomId: device?.roomId ?? '',
      assetId: device?.assetId ?? '',
    },
  });

  const submit = (values: NetworkDeviceFormValues) => {
    onSubmit(buildNetworkDevicePayload({ ...values, assetId }));
  };

  const cancelTo = isEdit && device ? `/network-devices/${device.id}` : '/network-devices';

  return (
    <div className="mx-auto max-w-3xl p-4 md:p-6">
      <button
        onClick={() => navigate(cancelTo)}
        className="mb-4 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" /> Network Devices
      </button>
      <h1 className="text-2xl font-bold text-slate-900">{isEdit ? 'Edit Network Device' : 'Tambah Network Device'}</h1>
      <p className="mt-1 text-sm text-slate-500">
        {isEdit
          ? 'Perbarui identitas, alamat, lokasi, atau relasi asset device.'
          : 'Daftarkan device baru untuk dipantau oleh Network Monitoring Runner.'}
      </p>

      <form onSubmit={handleSubmit(submit)} className="mt-6 space-y-6">
        <section className="rounded-lg border border-slate-200 bg-white p-5 md:p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">Device Information</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700">Name *</label>
              <input type="text" {...register('name')} className={inputClass(!!errors.name)} />
              {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Device Type *</label>
              <select {...register('deviceType')} className={inputClass(!!errors.deviceType)}>
                {DEVICE_TYPE_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              {errors.deviceType && <p className="mt-1 text-xs text-red-500">{errors.deviceType.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">IP Address *</label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="192.168.1.10"
                {...register('ipAddress')}
                className={inputClass(!!errors.ipAddress)}
              />
              {errors.ipAddress && <p className="mt-1 text-xs text-red-500">{errors.ipAddress.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Hostname</label>
              <input type="text" {...register('hostname')} className={inputClass(!!errors.hostname)} />
              {errors.hostname && <p className="mt-1 text-xs text-red-500">{errors.hostname.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">MAC Address</label>
              <input
                type="text"
                placeholder="AA:BB:CC:DD:EE:FF"
                {...register('macAddress')}
                className={inputClass(!!errors.macAddress)}
              />
              {errors.macAddress && <p className="mt-1 text-xs text-red-500">{errors.macAddress.message}</p>}
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 md:p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">Location</h2>
          <div>
            <label className="block text-sm font-medium text-slate-700">Room *</label>
            <select {...register('roomId')} className={inputClass(!!errors.roomId)}>
              <option value="">Select room...</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name || r.code || r.id}
                </option>
              ))}
            </select>
            {errors.roomId && <p className="mt-1 text-xs text-red-500">{errors.roomId.message}</p>}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 md:p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">Asset</h2>
          <label className="block text-sm font-medium text-slate-700">Asset (optional)</label>
          <NetworkDeviceAssetSelect
            value={assetId}
            initialAsset={initialAsset}
            onChange={setAssetId}
            hasError={!!errors.assetId}
          />
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
            {isEdit ? 'Save Changes' : 'Create Network Device'}
          </button>
        </div>
      </form>
    </div>
  );
}
