import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Loader2 } from 'lucide-react';
import type { CctvChannel, CctvChannelInput } from '../types';

function inputClass() {
  return 'mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500';
}

/**
 * Edits a channel's operational (BBP-owned) fields plus an optional Stream URI
 * correction. Technical fields discovered from the device are shown read-only;
 * the Stream URI may be adjusted when discovery returned a value the operator
 * needs to override.
 */
export default function ChannelEditDialog({
  channel,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  channel: CctvChannel | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (payload: CctvChannelInput) => void;
}) {
  const { register, handleSubmit, reset, watch } = useForm<CctvChannelInput>({
    defaultValues: { name: '', location: '', description: '', displayOrder: 0 },
  });
  const [profileId, setProfileId] = useState('');
  const [streamUri, setStreamUri] = useState('');

  const profiles = useMemo(() => channel?.streamProfiles ?? [], [channel]);

  useEffect(() => {
    if (!channel) return;
    reset({
      name: channel.name === 'Belum diatur' ? '' : channel.name,
      location: channel.location ?? '',
      description: channel.description ?? '',
      displayOrder: channel.displayOrder,
    });
    const preferred =
      channel.streamProfiles.find((p) => p.isMainStream) ?? channel.streamProfiles[0] ?? null;
    setProfileId(preferred?.id ?? '');
    setStreamUri(preferred?.streamUri ?? '');
  }, [channel, reset]);

  const selectedProfile = useMemo(
    () => profiles.find((p) => p.id === profileId) ?? null,
    [profiles, profileId],
  );

  // Keep the URI field in sync when the operator switches profile.
  const onProfileChange = (id: string) => {
    setProfileId(id);
    const p = profiles.find((x) => x.id === id) ?? null;
    setStreamUri(p?.streamUri ?? '');
  };

  const displayOrder = watch('displayOrder');

  if (!channel) return null;

  const submit = (values: CctvChannelInput) => {
    const payload: CctvChannelInput = {
      name: values.name?.trim() ? values.name.trim() : 'Belum diatur',
      location: values.location?.trim() ? values.location.trim() : null,
      description: values.description?.trim() ? values.description.trim() : null,
      displayOrder: Number(displayOrder) || 0,
    };
    // Only include a Stream URI correction when a profile is selected and the
    // URI actually changed.
    if (selectedProfile && streamUri.trim() !== (selectedProfile.streamUri ?? '')) {
      payload.streamProfileId = selectedProfile.id;
      payload.streamUri = streamUri.trim() ? streamUri.trim() : null;
    }
    onSubmit(payload);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 pt-12" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-slate-200 px-6 py-4">
          <h3 className="text-lg font-semibold text-slate-900">Edit Channel</h3>
          <p className="mt-0.5 text-xs text-slate-400">
            CH{String(channel.channelNumber).padStart(2, '0')}
            {channel.technicalName ? ` · ${channel.technicalName}` : ''}
          </p>
        </div>
        <form onSubmit={handleSubmit(submit)} className="space-y-4 px-6 py-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">Channel Name</label>
            <input type="text" placeholder="Kamera Lobby" {...register('name')} className={inputClass()} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Location</label>
            <input type="text" placeholder="Lobby" {...register('location')} className={inputClass()} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Display Order</label>
            <input type="number" min={0} {...register('displayOrder', { valueAsNumber: true })} className={inputClass()} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Description</label>
            <textarea rows={2} {...register('description')} className={inputClass()} />
          </div>

          {profiles.length > 0 && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700">Stream / Profile</label>
                <select value={profileId} onChange={(e) => onProfileChange(e.target.value)} className={inputClass()}>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.streamType}
                      {p.profileName ? ` · ${p.profileName}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Stream URI</label>
                <input
                  type="text"
                  value={streamUri}
                  onChange={(e) => setStreamUri(e.target.value)}
                  placeholder="rtsp://… (opsional)"
                  className={`${inputClass()} font-mono text-xs`}
                />
                <p className="mt-1 text-xs text-slate-400">
                  Koreksi URI bila hasil discovery tidak sesuai. Credential akan dihapus otomatis.
                </p>
              </div>
            </>
          )}

          <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />} Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
