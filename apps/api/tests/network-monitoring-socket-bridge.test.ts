import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const emit = vi.fn();
const to = vi.fn(() => ({ emit }));

vi.mock('@/lib/socket', () => ({
  getIo: () => ({ to }),
  NETWORK_MONITORING_ROOM: 'network-monitoring',
}));

import { eventBus } from '@/lib/event-bus';
import { setupNetworkMonitoringSocketBridge, SOCKET_EVENT_OFFLINE, SOCKET_EVENT_RESTORED } from '@/lib/network-monitoring/socket-bridge';

describe('Network monitoring socket bridge failure isolation', () => {
  beforeEach(() => {
    setupNetworkMonitoringSocketBridge();
    emit.mockReset();
    to.mockClear();
  });

  afterEach(() => {
    emit.mockReset();
  });

  const offlineEvent = {
    type: 'NETWORK_DEVICE_OFFLINE' as const,
    deviceId: 'dev-1',
    deviceName: 'PC 1',
    deviceType: 'COMPUTER',
    ipAddress: '10.0.0.1',
    roomId: 'room-1',
    status: 'OFFLINE' as const,
    eventType: 'CONNECTION_LOST' as const,
    timestamp: new Date('2026-09-09T03:04:00.000Z').toISOString(),
    startedAt: new Date('2026-09-09T03:04:00.000Z').toISOString(),
  };

  it('emits the offline event to the monitoring room', () => {
    eventBus.publish(offlineEvent);
    expect(to).toHaveBeenCalledWith('network-monitoring');
    expect(emit).toHaveBeenCalledWith(SOCKET_EVENT_OFFLINE, offlineEvent);
  });

  it('does not throw when Socket.IO emit fails (database remains committed)', () => {
    emit.mockImplementation(() => {
      throw new Error('socket transport down');
    });
    expect(() => eventBus.publish(offlineEvent)).not.toThrow();
  });

  it('ignores non-network events entirely', () => {
    eventBus.publish({
      type: 'SYSTEM',
      action: 'x',
      targetUserId: null,
      data: {},
    } as never);
    expect(emit).not.toHaveBeenCalled();
  });

  it('does not emit restored for offline and vice versa', () => {
    eventBus.publish(offlineEvent);
    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit.mock.calls[0][0]).toBe(SOCKET_EVENT_OFFLINE);

    emit.mockReset();
    eventBus.publish({
      type: 'NETWORK_DEVICE_RESTORED',
      deviceId: 'dev-1',
      deviceName: 'PC 1',
      deviceType: 'COMPUTER',
      ipAddress: '10.0.0.1',
      roomId: 'room-1',
      status: 'ONLINE',
      eventType: 'RESTORED',
      timestamp: new Date('2026-09-09T03:10:00.000Z').toISOString(),
      startedAt: new Date('2026-09-09T03:04:00.000Z').toISOString(),
      resolvedAt: new Date('2026-09-09T03:10:00.000Z').toISOString(),
      durationSeconds: 360,
    });
    expect(emit.mock.calls[0][0]).toBe(SOCKET_EVENT_RESTORED);
  });
});