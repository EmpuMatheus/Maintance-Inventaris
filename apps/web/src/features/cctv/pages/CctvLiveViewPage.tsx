import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Play, RotateCw, Square, Video } from 'lucide-react';
import { toast } from 'sonner';
import { listCctvDevices, listMonitorChannels } from '../api/cctv';
import LivePlayer from '../components/LivePlayer';
import CctvProtocolBadge from '../components/CctvProtocolBadge';
import { useLiveSessionPlayer, type PlayerPhase } from '../hooks/useLiveSessionPlayer';
import { isBusyPhase } from '../utils/player-control';
import type { CctvLiveStreamKind, CctvPlaybackTransport } from '../types';

const selectClass =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500';

const PHASE_LABEL: Record<PlayerPhase, string> = {
  idle: 'Idle',
  waiting: 'Menunggu resource…',
  starting: 'Starting…',
  playing: 'Playing',
  error: 'Error',
  stopping: 'Stopping…',
};

export default function CctvLiveViewPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  // Query params are used ONLY to select device/channel/stream. They never
  // trigger playback: Live View must never autoplay.
  const urlDeviceId = searchParams.get('deviceId') ?? '';
  const urlChannelId = searchParams.get('channelId') ?? '';
  const initialStream = (searchParams.get('stream') ?? '').toUpperCase() === 'SUB' ? 'SUB' : 'MAIN';
  const [deviceId, setDeviceId] = useState<string>(urlDeviceId);
  const [channelId, setChannelId] = useState<string>(urlChannelId);
  const [streamKind, setStreamKind] = useState<CctvLiveStreamKind>(initialStream as CctvLiveStreamKind);
  const [transport, setTransport] = useState<CctvPlaybackTransport>('webrtc');

  const devicesQuery = useQuery({
    queryKey: ['cctv-devices', 'list', { page: 1, limit: 100 }],
    queryFn: () => listCctvDevices({ page: 1, limit: 100 }),
  });
  const devices = useMemo(() => devicesQuery.data?.data ?? [], [devicesQuery.data]);

  const channelsQuery = useQuery({
    queryKey: ['cctv-channels', 'monitor'],
    queryFn: () => listMonitorChannels(),
  });
  const allChannels = useMemo(() => channelsQuery.data?.data ?? [], [channelsQuery.data]);

  // Auto-select the first device when the URL does not carry one.
  useEffect(() => {
    if (!deviceId && devices.length > 0) setDeviceId(devices[0].id);
  }, [deviceId, devices]);

  const channels = useMemo(
    () => allChannels.filter((c) => !deviceId || c.deviceId === deviceId),
    [allChannels, deviceId],
  );

  // Select the channel: keep the current one if still valid, else prefer the
  // URL channel (from a Monitor click), else the first channel. This selects
  // the target only — it never starts playback.
  useEffect(() => {
    setChannelId((current) => {
      if (current && channels.some((c) => c.id === current)) return current;
      if (urlChannelId && channels.some((c) => c.id === urlChannelId)) return urlChannelId;
      return channels[0]?.id ?? '';
    });
  }, [channels, urlChannelId]);

  const selectedDevice = devices.find((d) => d.id === deviceId) ?? null;

  // No autoStart: the player stays idle until the user presses Play.
  const player = useLiveSessionPlayer({ deviceId, channelId, streamKind });

  const { phase, session, error } = player;
  const isStarting = phase === 'starting';
  const isStopping = phase === 'stopping';
  const isPlaying = phase === 'playing';
  const isError = phase === 'error';
  const isWaiting = phase === 'waiting';
  const busy = isBusyPhase(phase);

  const canSelect = !isPlaying && !busy;

  const onDeviceChange = (value: string) => {
    setDeviceId(value);
    setChannelId('');
    setSearchParams(value ? { deviceId: value } : {});
  };

  const onPlay = () => {
    if (!deviceId || !channelId) {
      toast.error('Pilih device dan channel terlebih dahulu.');
      return;
    }
    player.play();
  };

  const placeholderText =
    phase === 'waiting'
      ? 'Menunggu resource streaming…'
      : phase === 'starting'
        ? 'Memulai stream…'
        : phase === 'stopping'
          ? 'Menghentikan stream…'
          : phase === 'error'
            ? error ?? 'Stream gagal.'
            : 'Klik Play untuk memulai stream.';

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">CCTV Live View</h1>
        <p className="mt-1 text-sm text-slate-500">
          Pilih device &amp; channel, lalu tekan Play. Video diputar melalui streaming gateway (WebRTC, fallback HLS).
          Credential device tidak pernah dikirim ke browser.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 lg:col-span-1">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500" htmlFor="live-device">
              Device
            </label>
            <select
              id="live-device"
              className={selectClass}
              value={deviceId}
              onChange={(e) => onDeviceChange(e.target.value)}
              disabled={devicesQuery.isLoading || !canSelect}
            >
              <option value="">Pilih device</option>
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500" htmlFor="live-channel">
              Channel
            </label>
            <select
              id="live-channel"
              className={selectClass}
              value={channelId}
              onChange={(e) => setChannelId(e.target.value)}
              disabled={!deviceId || channelsQuery.isLoading || channels.length === 0 || !canSelect}
            >
              <option value="">
                {channels.length === 0 ? 'Tidak ada channel (sync dulu)' : 'Pilih channel'}
              </option>
              {channels.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · CH{String(c.channelNumber).padStart(2, '0')}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500" htmlFor="live-stream">
              Stream
            </label>
            <select
              id="live-stream"
              className={selectClass}
              value={streamKind}
              onChange={(e) => setStreamKind(e.target.value as CctvLiveStreamKind)}
              disabled={!canSelect}
            >
              <option value="MAIN">Main Stream</option>
              <option value="SUB">Sub Stream</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500" htmlFor="live-transport">
              Transport
            </label>
            <select
              id="live-transport"
              className={selectClass}
              value={transport}
              onChange={(e) => setTransport(e.target.value as CctvPlaybackTransport)}
              disabled={!canSelect}
            >
              <option value="webrtc">WebRTC (primary)</option>
              <option value="hls">HLS (fallback)</option>
            </select>
          </div>

          <div className="flex gap-2 pt-1">
            {isPlaying ? (
              <>
                <button
                  onClick={() => player.stop()}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
                >
                  <Square className="h-4 w-4" /> Stop
                </button>
                <button
                  onClick={onPlay}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  <RotateCw className="h-4 w-4" /> Reload
                </button>
              </>
            ) : isError ? (
              <button
                onClick={onPlay}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                <RotateCw className="h-4 w-4" /> Retry
              </button>
            ) : (
              <>
                <button
                  onClick={onPlay}
                  disabled={!deviceId || !channelId || busy || isWaiting}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  {isStopping ? 'Stopping…' : isStarting ? 'Starting…' : isWaiting ? 'Waiting…' : 'Play'}
                </button>
                {isStarting && (
                  <button
                    onClick={() => player.stop()}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                  >
                    <Square className="h-4 w-4" /> Stop
                  </button>
                )}
              </>
            )}
          </div>

          {selectedDevice && (
            <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
              <CctvProtocolBadge protocol={selectedDevice.integrationProtocol} />
              <span className="font-mono">{selectedDevice.ipAddress}</span>
            </div>
          )}
        </div>

        <div className="space-y-3 lg:col-span-2">
          {session ? (
            <LivePlayer
              session={session}
              preferredTransport={transport}
              onStatusChange={player.notifyPlayerStatus}
            />
          ) : (
            <div className="flex aspect-video w-full items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50">
              <div className="flex flex-col items-center gap-2 text-slate-400">
                <Video className="h-10 w-10" />
                <p className="text-sm">{placeholderText}</p>
                {isError && (
                  <button
                    onClick={onPlay}
                    className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  >
                    <RotateCw className="h-3.5 w-3.5" /> Retry
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-slate-500">
            <span>
              Status:{' '}
              <span
                className={
                  isPlaying
                    ? 'font-medium text-emerald-600'
                    : isError
                      ? 'font-medium text-red-600'
                      : 'font-medium text-slate-600'
                }
              >
                {PHASE_LABEL[phase]}
              </span>
            </span>
            {session && (
              <>
                <span>
                  Channel:{' '}
                  <span className="font-medium text-slate-700">
                    CH{String(session.channelNumber).padStart(2, '0')}
                  </span>
                </span>
                <span>
                  Stream:{' '}
                  <span className="font-medium text-slate-700">
                    {session.streamKind === 'MAIN' ? 'Main' : 'Sub'}
                  </span>
                </span>
                <span className="font-mono">Source: {session.sourceLabel}</span>
              </>
            )}
          </div>

          {channelsQuery.isError && (
            <p className="text-xs text-red-500">Gagal memuat channel. Coba muat ulang halaman.</p>
          )}
        </div>
      </div>
    </div>
  );
}
