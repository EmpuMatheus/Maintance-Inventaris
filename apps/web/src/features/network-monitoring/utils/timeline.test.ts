import { describe, it, expect } from 'vitest';
import { incidentToTimelineEntries, type NetworkMonitoringEvent, type TimelineEntry } from '../types';
import { appendTimelineEntries, mergeTimelineEntries, pruneLiveEntries } from '../utils/timeline';

function event(overrides: Partial<NetworkMonitoringEvent> = {}): NetworkMonitoringEvent {
  return {
    id: 'incident-1',
    networkDeviceId: 'device-1',
    eventType: 'CONNECTION_LOST',
    startedAt: '2026-09-09T03:04:00.000Z',
    resolvedAt: null,
    durationSeconds: null,
    createdAt: '2026-09-09T03:04:00.000Z',
    deviceName: 'PC Produksi 01',
    deviceType: 'COMPUTER',
    ipAddress: '192.168.1.10',
    roomId: 'room-1',
    roomName: 'Room A',
    roomCode: 'RA',
    location: 'Site / Building / Floor / Room A',
    currentStatus: 'OFFLINE',
    ...overrides,
  };
}

function entry(overrides: Partial<TimelineEntry> = {}): TimelineEntry {
  return {
    id: 'device-1:2026-09-09T03:04:00.000Z:CONNECTION_LOST',
    deviceId: 'device-1',
    deviceName: 'PC Produksi 01',
    deviceType: 'COMPUTER',
    ipAddress: '192.168.1.10',
    roomId: 'room-1',
    roomName: 'Room A',
    roomCode: 'RA',
    location: 'Site / Building / Floor / Room A',
    state: 'CONNECTION_LOST',
    timestamp: '2026-09-09T03:04:00.000Z',
    startedAt: '2026-09-09T03:04:00.000Z',
    resolvedAt: null,
    durationSeconds: null,
    live: false,
    ...overrides,
  };
}

describe('incidentToTimelineEntries', () => {
  it('projects an unresolved incident as a single CONNECTION_LOST state', () => {
    const entries = incidentToTimelineEntries(event());
    expect(entries).toHaveLength(1);
    expect(entries[0].state).toBe('CONNECTION_LOST');
    expect(entries[0].timestamp).toBe('2026-09-09T03:04:00.000Z');
  });

  it('projects a resolved incident as CONNECTION_LOST + RESTORED without a second incident', () => {
    const entries = incidentToTimelineEntries(
      event({
        resolvedAt: '2026-09-09T03:10:00.000Z',
        durationSeconds: 360,
        currentStatus: 'ONLINE',
      }),
    );
    expect(entries).toHaveLength(2);
    expect(entries.map((e) => e.state)).toEqual(['CONNECTION_LOST', 'RESTORED']);
    // Both states share the same incident identity, so `id` differs only by state.
    expect(entries[0].id).toBe('device-1:2026-09-09T03:04:00.000Z:CONNECTION_LOST');
    expect(entries[1].id).toBe('device-1:2026-09-09T03:04:00.000Z:RESTORED');
    expect(entries[1].durationSeconds).toBe(360);
  });
});

describe('appendTimelineEntries', () => {
  it('prepends new live entries', () => {
    const existing = [entry()];
    const incoming = [entry({ id: 'x', state: 'RESTORED' })];
    const result = appendTimelineEntries(existing, incoming);
    expect(result[0].id).toBe('x');
    expect(result).toHaveLength(2);
  });

  it('deduplicates repeated events (reconnect-safe)', () => {
    const existing = [entry()];
    const result = appendTimelineEntries(existing, [entry()]);
    expect(result).toHaveLength(1);
    expect(result).toBe(existing);
  });
});

describe('pruneLiveEntries', () => {
  it('drops live entries already present in API history', () => {
    const live = [entry(), entry({ id: 'keep-live', state: 'RESTORED' })];
    const history = [entry()];
    const result = pruneLiveEntries(live, history);
    expect(result.map((e) => e.id)).toEqual(['keep-live']);
  });
});

describe('mergeTimelineEntries', () => {
  it('merges history + live, dedupes by id and sorts newest first', () => {
    const history = [entry()];
    const live = [
      entry({ id: 'restored-1', state: 'RESTORED', timestamp: '2026-09-09T03:10:00.000Z' }),
      entry(),
    ];
    const merged = mergeTimelineEntries(history, live);
    expect(merged).toHaveLength(2);
    expect(merged[0].id).toBe('restored-1');
    expect(merged[1].id).toBe('device-1:2026-09-09T03:04:00.000Z:CONNECTION_LOST');
  });

  it('history wins over a live entry with the same id', () => {
    const history = [entry({ deviceName: 'From API' })];
    const live = [entry({ deviceName: 'From Socket', live: true })];
    const merged = mergeTimelineEntries(history, live);
    expect(merged).toHaveLength(1);
    expect(merged[0].deviceName).toBe('From API');
    expect(merged[0].live).toBe(false);
  });
});
