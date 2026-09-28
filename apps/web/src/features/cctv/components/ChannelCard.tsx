import { Video, Pencil } from 'lucide-react';
import CctvChannelStatusBadge from './CctvChannelStatusBadge';
import StreamTypeBadge from './StreamTypeBadge';
import type { CctvChannel } from '../types';

/**
 * A camera/channel tile on the CCTV Stream page. Live video is intentionally not
 * part of Phase 1: this shows channel + stream information only.
 */
export default function ChannelCard({
  channel,
  canManage,
  onEdit,
}: {
  channel: CctvChannel;
  canManage: boolean;
  onEdit: (channel: CctvChannel) => void;
}) {
  const mainStream = channel.streamProfiles.find((p) => p.isMainStream) ?? channel.streamProfiles[0];

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="relative flex h-36 items-center justify-center bg-slate-900">
        <div className="flex flex-col items-center gap-1 text-slate-500">
          <Video className="h-8 w-8" />
          <span className="text-[11px] uppercase tracking-wider">Live</span>
        </div>
        <span className="absolute left-2 top-2 rounded bg-black/50 px-1.5 py-0.5 font-mono text-[11px] text-white">
          CH{String(channel.channelNumber).padStart(2, '0')}
        </span>
        <span className="absolute right-2 top-2">
          <CctvChannelStatusBadge status={channel.status} />
        </span>
      </div>

      <div className="space-y-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-800">{channel.name || 'Belum diatur'}</p>
            <p className="truncate text-xs text-slate-400">{channel.location || 'Belum diatur'}</p>
          </div>
          {canManage && (
            <button
              onClick={() => onEdit(channel)}
              className="shrink-0 rounded-lg border border-slate-300 p-1.5 text-slate-500 hover:bg-slate-50"
              aria-label="Edit channel"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <dl className="space-y-1 text-xs">
          <div className="flex justify-between gap-2">
            <dt className="text-slate-400">Technical</dt>
            <dd className="truncate text-right font-mono text-slate-600">{channel.technicalName || 'null'}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-slate-400">Camera IP</dt>
            <dd className="font-mono text-slate-600">{channel.cameraIp || '-'}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-slate-400">Streams</dt>
            <dd className="flex flex-wrap justify-end gap-1">
              {channel.streamProfiles.length > 0 ? (
                channel.streamProfiles.map((p) => <StreamTypeBadge key={p.id} streamType={p.streamType} />)
              ) : (
                <span className="text-slate-400">-</span>
              )}
            </dd>
          </div>
          {mainStream && (mainStream.resolution || mainStream.videoCodec) && (
            <div className="flex justify-between gap-2">
              <dt className="text-slate-400">Main</dt>
              <dd className="truncate text-right text-slate-600">
                {[mainStream.resolution, mainStream.videoCodec, mainStream.fps ? `${mainStream.fps}fps` : null]
                  .filter(Boolean)
                  .join(' · ')}
              </dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  );
}
