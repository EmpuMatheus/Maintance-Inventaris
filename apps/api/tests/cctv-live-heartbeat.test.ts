import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import postgres from 'postgres';
import { env, streamingGatewayConfig } from '@/config/env';
import * as svc from '@/modules/cctv/cctv.service';
import * as live from '@/modules/cctv/cctv.live.service';
import * as repo from '@/modules/cctv/cctv.repository';
import { setStreamingGatewayFactory, resetStreamingGatewayFactory } from '@/lib/streaming';
import type { StreamingGateway, GatewayPathConfig, GatewayPathState } from '@/lib/streaming/types';

/**
 * Continuous playback: an ACTIVE viewer renews its session via heartbeat and
 * must NOT be reaped after the base TTL (the old ~2 minute cutoff). Only when
 * heartbeats stop does the session expire and get cleaned up.
 */

const sql = postgres(env.DATABASE_URL, { max: 1 });
const RUN = Date.now().toString(36);

let deviceId: string;
let channelId: string;

class FakeGateway implements StreamingGateway {
  readonly paths = new Map<string, GatewayPathConfig>();
  async isAvailable() {
    return true;
  }
  async addPath(config: GatewayPathConfig) {
    this.paths.set(config.name, config);
  }
  async removePath(name: string) {
    this.paths.delete(name);
  }
  async getPath(name: string): Promise<GatewayPathState | null> {
    return this.paths.has(name) ? { name, online: true, ready: true } : null;
  }
  webrtcEndpoint(name: string) {
    return `http://127.0.0.1:8889/${name}/whep`;
  }
  hlsManifestUrl(name: string) {
    return `http://127.0.0.1:8888/${name}/index.m3u8`;
  }
  rtspUrl(name: string) {
    return `rtsp://127.0.0.1:8554/${name}`;
  }
}

let gateway: FakeGateway;

beforeAll(async () => {
  const device = await svc.create({
    name: `QA Heartbeat ${RUN}`,
    deviceType: 'DVR',
    brand: 'Hikvision',
    ipAddress: `10.73.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`,
    port: 82,
    rtspPort: 554,
    username: 'admin',
    password: 'secret',
  });
  deviceId = device!.id as string;
  const channel = await repo.upsertChannelTechnical(deviceId, 1, {
    deviceChannelId: '1',
    technicalName: 'Cam 1',
    cameraIp: null,
    status: 'ONLINE',
    lastSyncAt: new Date(),
  });
  channelId = channel!.id as string;
});

afterAll(async () => {
  await sql`DELETE FROM cctv_devices WHERE id = ${deviceId}`;
  await sql.end();
});

beforeEach(async () => {
  gateway = new FakeGateway();
  setStreamingGatewayFactory(() => gateway);
  live.setLiveReadyTimeoutMs(300);
  await sql`DELETE FROM cctv_live_sessions WHERE device_id = ${deviceId}`;
});

afterEach(() => {
  live.setLiveReadyTimeoutMs(null);
  resetStreamingGatewayFactory();
});

describe('cctv live session - continuous playback', () => {
  it('has a base TTL comfortably longer than 2 minutes', () => {
    expect(streamingGatewayConfig.sessionTtlSeconds).toBeGreaterThan(120);
  });

  it('creates a session whose expiry is well beyond 2 minutes', async () => {
    const view = await live.createLiveSession({ deviceId, channelId, streamKind: 'SUB', userId: null });
    const ttlMs = new Date(view.expiresAt).getTime() - new Date(view.createdAt).getTime();
    expect(ttlMs).toBeGreaterThan(120_000);
  });

  it('heartbeat renews the expiry of an active session', async () => {
    const view = await live.createLiveSession({ deviceId, channelId, streamKind: 'SUB', userId: null });

    // Simulate a viewer that has been watching for nearly the whole TTL.
    const nearExpiry = new Date(Date.now() + 5_000);
    await repo.touchLiveSession(view.id, nearExpiry);

    const beat = await live.heartbeatLiveSession(view.id);
    expect(new Date(beat.expiresAt).getTime()).toBeGreaterThan(nearExpiry.getTime());
  });

  it('an actively-heartbeating session survives a reap cycle past the base TTL', async () => {
    const view = await live.createLiveSession({ deviceId, channelId, streamKind: 'SUB', userId: null });

    // Pretend the original 2-minute TTL elapsed, but the viewer is still there.
    await repo.touchLiveSession(view.id, new Date(Date.now() + 2_000));

    // Viewer heartbeats (this is what the browser does every 30s).
    await live.heartbeatLiveSession(view.id);

    // The reaper runs (as it does every TTL/4) — it must NOT close the session.
    const reaped = await live.reapExpiredLiveSessions();
    expect(reaped).toBe(0);

    const row = await repo.findLiveSessionById(view.id);
    expect(row?.status).toBe('ACTIVE');
    expect(gateway.paths.size).toBe(1); // gateway path still alive

    await live.stopLiveSession(view.id);
  });

  it('reaps a session whose viewer stopped heartbeating (abandoned)', async () => {
    const view = await live.createLiveSession({ deviceId, channelId, streamKind: 'SUB', userId: null });
    // No more heartbeats: force the expiry into the past.
    await repo.touchLiveSession(view.id, new Date(Date.now() - 1_000));

    const reaped = await live.reapExpiredLiveSessions();
    expect(reaped).toBeGreaterThanOrEqual(1);

    const row = await repo.findLiveSessionById(view.id);
    expect(row?.status).toBe('STOPPED');
    expect(gateway.paths.size).toBe(0); // resources cleaned up
  });

  it('heartbeat on a stopped/unknown session returns 404', async () => {
    await expect(
      live.heartbeatLiveSession('00000000-0000-0000-0000-000000000000'),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('simulated 15 minutes of viewer heartbeats is never reaped mid-view', async () => {
    const view = await live.createLiveSession({ deviceId, channelId, streamKind: 'SUB', userId: null });

    // 30 heartbeats at a 30s cadence == 15 minutes of continuous viewing.
    // Between beats the reaper runs as it would in production; the session must
    // stay ACTIVE and the gateway path must remain configured the whole time.
    for (let i = 0; i < 30; i += 1) {
      await live.heartbeatLiveSession(view.id);
      const reaped = await live.reapExpiredLiveSessions();
      expect(reaped).toBe(0);
      expect(gateway.paths.size).toBe(1);
    }

    const row = await repo.findLiveSessionById(view.id);
    expect(row?.status).toBe('ACTIVE');
    await live.stopLiveSession(view.id);
    expect(gateway.paths.size).toBe(0);
  });
});
