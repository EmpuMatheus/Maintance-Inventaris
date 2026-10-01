/**
 * End-to-end live-session check against the real Hikvision DVR and a real
 * MediaMTX gateway. Spawns the gateway from apps/api/gateway, opens a session
 * through the actual service layer, verifies readiness, then tears down.
 *
 * Usage: node --import tsx apps/api/scripts/e2e-live.mjs   (or tsx directly)
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

process.env.STORAGE_ROOT = path.join(root, '..', '..', 'storage');

const { buildGatewayConfig } = await import('../src/lib/streaming/process-manager.ts');
const live = await import('../src/modules/cctv/cctv.live.service.ts');
const repo = await import('../src/modules/cctv/cctv.repository.ts');

const gatewayDir = path.join(root, 'gateway');
mkdirSync(gatewayDir, { recursive: true });
const configPath = path.join(gatewayDir, 'e2e-mediamtx.yml');
writeFileSync(configPath, buildGatewayConfig(), 'utf8');

const binary = path.join(root, 'gateway', process.platform === 'win32' ? 'mediamtx.exe' : 'mediamtx');
if (!existsSync(binary)) {
  console.error('MediaMTX binary not found. Run: npm run fetch:gateway');
  process.exit(1);
}

const child = spawn(binary, [configPath], { stdio: ['ignore', 'inherit', 'inherit'] });
await new Promise((r) => setTimeout(r, 2500));

try {
  const only = process.argv[2];
  const devices = await repo.findMany({ isActive: true });
  const device = (only ? devices.data.find((d) => d.name.includes(only)) : devices.data[0]);
  if (!device) throw new Error('No active CCTV device found.');
  const channels = await repo.findChannelsByDevice(device.id);
  const channel = channels[0];
  if (!channel) throw new Error('No channel found.');

  console.log(`Device: ${device.name} (${device.integrationProtocol}) -> CH ${channel.channelNumber}`);

  const kind = (process.argv[3] || 'MAIN').toUpperCase() === 'SUB' ? 'SUB' : 'MAIN';
  const view = await live.createLiveSession({
    deviceId: device.id,
    channelId: channel.id,
    streamKind: kind,
    userId: null,
  });
  console.log('LIVE SESSION OK:', JSON.stringify(view, null, 2));
  if (JSON.stringify(view).toLowerCase().includes('rtsp://')) {
    console.error('SECURITY FAIL: response contains an RTSP URL.');
    process.exitCode = 1;
  }

  // Verify the gateway actually carries decodable video for this session.
  const gatewayPath = (await repo.findLiveSessionById(view.id))?.gatewayPath;
  const stateRes = await fetch(`http://127.0.0.1:9997/v3/paths/get/${gatewayPath}`);
  const state = await stateRes.json();
  console.log('GATEWAY TRACKS:', JSON.stringify(state.tracks2));
  const rtspUrl = `rtsp://127.0.0.1:8554/${gatewayPath}`;
  const { execFileSync } = await import('node:child_process');
  const ffmpeg = path.join(root, 'gateway', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
  const decodeOut = execFileSync(
    ffmpeg,
    ['-hide_banner', '-loglevel', 'error', '-nostdin', '-progress', 'pipe:1', '-rtsp_transport', 'tcp', '-timeout', '15000000', '-i', rtspUrl, '-t', '3', '-an', '-f', 'null', '-'],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  ).toString();
  const maxFrames = decodeOut
    .split('\n')
    .reduce((mx, line) => {
      const t = line.trim();
      if (!t.startsWith('frame=')) return mx;
      const n = Number(t.slice('frame='.length));
      return Number.isFinite(n) && n > mx ? n : mx;
    }, 0);
  console.log('DECODED FRAMES:', maxFrames);
  if (maxFrames <= 0) {
    console.error('VIDEO FAIL: gateway output decodes zero frames.');
    process.exitCode = 1;
  }

  await live.stopLiveSession(view.id);
  console.log('Session stopped cleanly.');
} catch (error) {
  console.error('E2E FAILED:', error);
  process.exitCode = 1;
} finally {
  child.kill('SIGTERM');
  setTimeout(() => child.kill('SIGKILL'), 2000).unref();
  setTimeout(() => process.exit(process.exitCode ?? 0), 2600);
}
