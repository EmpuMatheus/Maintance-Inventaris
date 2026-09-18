import { io, type Socket } from 'socket.io-client';
import { config } from '@/app/config';
import { getStoredToken } from '@/services/auth';

/** Socket.IO event names emitted by the backend network monitoring layer. */
export const NETWORK_SOCKET_EVENTS = {
  offline: 'network:device-offline',
  restored: 'network:device-restored',
  ready: 'network:ready',
} as const;

export interface NetworkDeviceOfflinePayload {
  deviceId: string;
  deviceName: string;
  deviceType: string;
  ipAddress: string;
  roomId: string;
  status: 'OFFLINE';
  eventType: 'CONNECTION_LOST';
  timestamp: string;
  startedAt: string;
}

export interface NetworkDeviceRestoredPayload {
  deviceId: string;
  deviceName: string;
  deviceType: string;
  ipAddress: string;
  roomId: string;
  status: 'ONLINE';
  eventType: 'RESTORED';
  timestamp: string;
  startedAt: string;
  resolvedAt: string;
  durationSeconds: number;
}

let socket: Socket | null = null;

/**
 * Resolves the Socket.IO server origin.
 *
 * - Relative API URL (`/api/v1`): the socket connects to the current origin, so
 *   the Vite dev proxy / single-origin deployment handles it transparently.
 * - Absolute API URL: strip the `/api/v1` suffix to get the server origin.
 */
export function resolveSocketUrl(): string {
  const apiUrl = config.apiUrl;
  if (apiUrl.startsWith('http')) {
    return apiUrl.replace(/\/api\/v\d+\/?$/, '');
  }
  return window.location.origin;
}

/**
 * Returns the shared Socket.IO connection, creating it on first use.
 * The JWT is sent in the handshake and refreshed on every (re)connect so a
 * reconnect after the frontend lost its connection recovers cleanly.
 */
export function getSocket(): Socket {
  if (socket) return socket;
  socket = io(resolveSocketUrl(), {
    autoConnect: false,
    transports: ['websocket', 'polling'],
    auth: (cb) => cb({ token: getStoredToken() ?? '' }),
  });
  return socket;
}

/** Connects the shared socket (no-op when already connected). */
export function connectSocket(): Socket {
  const s = getSocket();
  if (!s.connected) s.connect();
  return s;
}

/** Disconnects the shared socket and clears the singleton (e.g. on logout). */
export function disconnectSocket(): void {
  if (!socket) return;
  socket.disconnect();
  socket = null;
}

export type { Socket } from 'socket.io-client';
