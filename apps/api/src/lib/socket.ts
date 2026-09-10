import type { Server as HttpServer } from 'http';
import { Server as SocketServer, type Socket } from 'socket.io';
import { env } from '@/config/env';
import { isPrivateDevelopmentOrigin } from '@/config/cors';
import { logger } from '@/lib/logger';
import { verifyToken } from '@/lib/jwt';
import * as authRepo from '@/modules/auth/auth.repository';

/** Room every authenticated socket joins; all network monitoring events fan out here. */
export const NETWORK_MONITORING_ROOM = 'network-monitoring';

export interface SocketUser {
  id: string;
  username: string;
}

let io: SocketServer | null = null;

/**
 * Builds the Socket.IO CORS options using the same allow-list rules as the
 * Express app: development accepts localhost/loopback/private-LAN origins,
 * production only the explicit allow-list.
 */
function buildSocketCorsOptions() {
  const isDevelopment = env.NODE_ENV === 'development';
  return {
    origin(origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
      if (!origin) {
        callback(null, true);
        return;
      }
      const allowed = isDevelopment
        ? isPrivateDevelopmentOrigin(origin) || env.corsOrigins.includes(origin)
        : env.corsOrigins.includes(origin);
      callback(null, allowed);
    },
    credentials: true,
  };
}

/**
 * Attaches a Socket.IO server to the existing HTTP(S) server and installs JWT
 * authentication on the handshake. Safe to call more than once (returns the
 * existing instance).
 */
export function initSocketServer(httpServer: HttpServer): SocketServer {
  if (io) return io;

  io = new SocketServer(httpServer, {
    cors: buildSocketCorsOptions(),
    // Give reconnecting clients a short window to resume their session.
    connectionStateRecovery: {},
  });

  io.use(async (socket, next) => {
    try {
      const token =
        (typeof socket.handshake.auth?.token === 'string' && socket.handshake.auth.token) ||
        (typeof socket.handshake.query?.token === 'string' && socket.handshake.query.token) ||
        undefined;

      if (!token) {
        next(new Error('UNAUTHORIZED'));
        return;
      }

      let payload: { sub: string };
      try {
        payload = verifyToken(token);
      } catch {
        next(new Error('UNAUTHORIZED'));
        return;
      }

      const user = await authRepo.findUserById(payload.sub);
      if (!user || !user.isActive) {
        next(new Error('UNAUTHORIZED'));
        return;
      }

      socket.data.user = { id: user.id, username: user.username } satisfies SocketUser;
      next();
    } catch (error) {
      logger.warn({ error }, 'Socket handshake failed');
      next(new Error('UNAUTHORIZED'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = socket.data.user as SocketUser | undefined;
    socket.join(NETWORK_MONITORING_ROOM);

    // Reconnection-safe: the client can always re-request current state via
    // GET /api/v1/network-monitoring/status after (re)connecting.
    socket.emit('network:ready', { connectedAt: new Date().toISOString() });
    logger.debug({ userId: user?.id, socketId: socket.id }, 'Socket connected');
  });

  return io;
}

/** Returns the active Socket.IO server, or null when realtime is not initialised. */
export function getIo(): SocketServer | null {
  return io;
}

/** Closes the Socket.IO server (used on graceful shutdown). */
export async function closeSocketServer(): Promise<void> {
  if (!io) return;
  const current = io;
  io = null;
  await current.close();
}
