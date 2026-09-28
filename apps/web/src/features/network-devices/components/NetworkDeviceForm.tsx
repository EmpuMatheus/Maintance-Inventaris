import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { getAssetPreview } from '../api/network-devices';
import NetworkDeviceAssetSelect, { type AssetOption } from './NetworkDeviceAssetSelect';
import DeviceTypeBadge from '@/features/network-monitoring/components/DeviceTypeBadge';
import {
  buildNetworkDevicePayload,
  networkDeviceFormSchema,
  type NetworkDeviceFormValues,
} from '../utils/validation';
import type { NetworkDevice, NetworkDeviceInput } from '../types';

function inputClass(hasError?: boolean) {
  return `mt-1 block w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
    hasError ? 'border-red-300' : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-500'
  }`;
}

const readonlyClass =
  'mt-1 block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600';

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

  const [selectedAsset, setSelectedAsset] = useState<AssetOption | null>(
    device?.asset
      ? {
          id: device.asset.id,
          assetCode: device.asset.assetCode,
          assetName: device.asset.assetName,
          subcategoryName: device.asset.subcategoryName,
          picName: device.asset.picName,
          roomName: device.room?.name ?? null,
        }
      : null,
  );
  const [assetError, setAssetError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<NetworkDeviceFormValues>({
    resolver: zodResolver(networkDeviceFormSchema),
    defaultValues: {
      name: device?.name ?? '',
      ipAddress: device?.ipAddress ?? '',
      macAddress: device?.macAddress ?? '',
      assetId: device?.assetId ?? '',
    },
  });

  // The asset picker is a custom control, so its value is pushed into
  // react-hook-form explicitly. Without this the form keeps an empty `assetId`
  // and zod validation silently fails, which is why submit never fired.
  const assetId = watch('assetId');

  // Derived readonly values. Previewed live from the backend whenever an asset
  // is chosen, falling back to the device's stored/derived values on edit.
  const previewQuery = useQuery({
    queryKey: ['network-device-asset-preview', assetId, device?.id],
    queryFn: () => getAssetPreview(assetId, device?.id),
    enabled: !!assetId,
  });
  const preview = previewQuery.data?.data;

  // Device Type is the selected Asset's subcategory name. The preview returns
  // it from the backend; fall back to the device's own values on edit.
  const deviceType = preview?.subcategoryName ?? device?.deviceType ?? null;
  const hostname = preview?.hostname ?? (assetId ? device?.hostname ?? null : null);
  const roomName = preview?.roomName ?? (assetId ? device?.room?.name ?? null : null);
  const subcategoryName = preview?.subcategoryName ?? selectedAsset?.subcategoryName ?? null;
  const picName = preview?.picName ?? selectedAsset?.picName ?? null;
  const roomDisplayName = roomName ?? selectedAsset?.roomName ?? null;
  const hasAsset = !!assetId;

  const onAssetSelect = (asset: AssetOption) => {
    setValue('assetId', asset.id, { shouldValidate: true, shouldDirty: true });
    setSelectedAsset(asset);
    setAssetError(null);
  };

  const submit = (values: NetworkDeviceFormValues) => {
    if (!assetId) {
      setAssetError('Asset is required.');
      return;
    }
    onSubmit(buildNetworkDevicePayload({ ...values, assetId }));
  };

  // Surface validation failures (e.g. a missing/invalid asset) so the submit
  // button never appears unresponsive.
  const onInvalid = () => {
    if (!assetId) setAssetError('Asset is required.');
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
          ? 'Perbarui asset atau alamat jaringan device. Tipe, hostname, dan room mengikuti Asset.'
          : 'Pilih Asset terlebih dahulu. Tipe, hostname, dan room diisi otomatis dari Asset.'}
      </p>

      <form onSubmit={handleSubmit(submit, onInvalid)} className="mt-6 space-y-6">
        <section className="rounded-lg border border-slate-200 bg-white p-5 md:p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">Asset</h2>
          <label className="block text-sm font-medium text-slate-700">Asset *</label>
          <NetworkDeviceAssetSelect
            value={assetId}
            initialAsset={selectedAsset}
            excludeNetworkDeviceId={device?.id}
            onChange={onAssetSelect}
            hasError={!!assetError}
          />
          {assetError && <p className="mt-1 text-xs text-red-500">{assetError}</p>}
          <p className="mt-2 text-xs text-slate-400">
            Hanya Asset dengan Subcategory bertanda Network Device dan belum digunakan device lain yang dapat dipilih.
          </p>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 md:p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">Device Information</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-slate-700">Device Type</label>
              <div className={readonlyClass}>
                {previewQuery.isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                ) : deviceType ? (
                  <DeviceTypeBadge deviceType={deviceType} />
                ) : (
                  <span className="text-slate-400">Select asset first</span>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Hostname</label>
              <input
                readOnly
                disabled
                value={hasAsset ? hostname ?? '' : ''}
                placeholder="Select asset first"
                className={readonlyClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Room</label>
              <input
                readOnly
                disabled
                value={hasAsset ? roomDisplayName ?? '' : ''}
                placeholder="Select asset first"
                className={readonlyClass}
              />
            </div>
          </div>
          {hasAsset && subcategoryName && (
            <p className="mt-3 text-xs text-slate-400">
              Subcategory: <span className="font-medium text-slate-500">{subcategoryName}</span>
              {picName && <> · PIC: <span className="font-medium text-slate-500">{picName}</span></>}
            </p>
          )}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 md:p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">Network Information</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700">Name</label>
              <input
                type="text"
                placeholder="Default mengikuti nama Asset"
                {...register('name')}
                className={inputClass(!!errors.name)}
              />
              {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
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
