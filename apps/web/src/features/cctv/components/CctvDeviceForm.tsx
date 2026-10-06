import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Loader2 } from 'lucide-react';
import {
  buildCctvDevicePayload,
  cctvDeviceFormSchema,
  type CctvDeviceFormValues,
} from '../utils/validation';
import CctvProtocolBadge from './CctvProtocolBadge';
import CctvDeviceAssetSelect, { type CctvAssetOption } from './CctvDeviceAssetSelect';
import { getCctvAssetPreview } from '../api/cctv';
import type { CctvDevice, CctvDeviceInput } from '../types';

function inputClass(hasError?: boolean) {
  return `mt-1 block w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
    hasError ? 'border-red-300' : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-500'
  }`;
}

const readonlyClass =
  'mt-1 block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600';

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

  const [selectedAsset, setSelectedAsset] = useState<CctvAssetOption | null>(
    device?.asset
      ? {
          id: device.asset.id,
          assetCode: device.asset.assetCode,
          assetName: device.asset.assetName ?? '',
          subcategoryName: device.subcategoryName,
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
  } = useForm<CctvDeviceFormValues>({
    resolver: zodResolver(cctvDeviceFormSchema),
    defaultValues: {
      assetId: device?.assetId ?? '',
      ipAddress: device?.ipAddress ?? '',
      port: device?.port ?? 80,
      rtspPort: device?.rtspPort ?? 554,
      username: device?.username ?? '',
      password: '',
      location: device?.location ?? '',
    },
  });

  // The asset picker is a custom control, so its value is pushed into
  // react-hook-form explicitly (otherwise validation silently fails).
  const assetId = watch('assetId');

  // Derived readonly values, previewed live from the backend once an asset is
  // chosen, falling back to the device's stored/derived values on edit.
  const previewQuery = useQuery({
    queryKey: ['cctv-asset-preview', assetId, device?.id],
    queryFn: () => getCctvAssetPreview(assetId, device?.id),
    enabled: !!assetId,
  });
  const preview = previewQuery.data?.data;

  const deviceName = preview?.deviceName ?? (assetId ? device?.name ?? null : null);
  const brand = preview?.brand ?? (assetId ? device?.brand ?? null : null);
  const model = preview?.model ?? (assetId ? device?.model ?? null : null);
  const subcategoryName =
    preview?.subcategoryName ?? selectedAsset?.subcategoryName ?? (assetId ? device?.subcategoryName ?? null : null);
  const integrationProtocol =
    preview?.integrationProtocol ?? (assetId ? device?.integrationProtocol ?? null : null);
  const hasAsset = !!assetId;

  const onAssetSelect = (asset: CctvAssetOption) => {
    setValue('assetId', asset.id, { shouldValidate: true, shouldDirty: true });
    setSelectedAsset(asset);
    setAssetError(null);
  };

  const submit = (values: CctvDeviceFormValues) => {
    if (!assetId) {
      setAssetError('Asset is required.');
      return;
    }
    onSubmit(buildCctvDevicePayload({ ...values, assetId }, { isEdit }));
  };

  // Surface validation failures (e.g. a missing/invalid asset) so the submit
  // button never appears unresponsive.
  const onInvalid = () => {
    if (!assetId) setAssetError('Asset is required.');
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
          ? 'Perbarui Asset atau kredensial/alamat jaringan. Nama, brand, model, dan subcategory mengikuti Asset.'
          : 'Pilih Asset terlebih dahulu. Nama, brand, model, subcategory, dan integration diisi otomatis dari Asset.'}
      </p>

      <form onSubmit={handleSubmit(submit, onInvalid)} className="mt-6 space-y-6">
        <section className="rounded-lg border border-slate-200 bg-white p-5 md:p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">Asset</h2>
          <label className="block text-sm font-medium text-slate-700">Asset *</label>
          <CctvDeviceAssetSelect
            value={assetId}
            initialAsset={selectedAsset}
            excludeCctvDeviceId={device?.id}
            onChange={onAssetSelect}
            hasError={!!assetError}
          />
          {assetError && <p className="mt-1 text-xs text-red-500">{assetError}</p>}
          <p className="mt-2 text-xs text-slate-400">
            Hanya Asset dengan Subcategory CCTV / DVR / NVR dan belum digunakan device lain yang dapat dipilih.
          </p>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 md:p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">Device Information</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700">Device Name</label>
              <input
                readOnly
                disabled
                value={hasAsset ? deviceName ?? '' : ''}
                placeholder="Select asset first"
                className={readonlyClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Subcategory</label>
              <input
                readOnly
                disabled
                value={hasAsset ? subcategoryName ?? '' : ''}
                placeholder="Select asset first"
                className={readonlyClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Brand</label>
              <input
                readOnly
                disabled
                value={hasAsset ? brand ?? '' : ''}
                placeholder="Select asset first"
                className={readonlyClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Model</label>
              <input
                readOnly
                disabled
                value={hasAsset ? model ?? '' : ''}
                placeholder="Select asset first"
                className={readonlyClass}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700">Integration</label>
              <div className={`${readonlyClass} flex items-center gap-2`}>
                {previewQuery.isLoading && hasAsset ? (
                  <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                ) : integrationProtocol ? (
                  <>
                    <CctvProtocolBadge protocol={integrationProtocol} />
                    <span className="text-xs text-slate-400">(DVR → ISAPI, CCTV/NVR → ONVIF)</span>
                  </>
                ) : (
                  <span className="text-slate-400">Select asset first</span>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 md:p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">Network &amp; Credential</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700">Location *</label>
              <input type="text" placeholder="Ruang Server" {...register('location')} className={inputClass(!!errors.location)} />
              {errors.location && <p className="mt-1 text-xs text-red-500">{errors.location.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">IP Address *</label>
              <input type="text" inputMode="numeric" placeholder="192.168.2.10" {...register('ipAddress')} className={inputClass(!!errors.ipAddress)} />
              {errors.ipAddress && <p className="mt-1 text-xs text-red-500">{errors.ipAddress.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Port (ONVIF/ISAPI) *</label>
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
            <div className="sm:col-span-2">
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
