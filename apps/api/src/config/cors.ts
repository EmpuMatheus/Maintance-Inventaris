import type { CorsOptions } from 'cors';
import { env } from '@/config/env';

/**
 * Matches a single dotted-decimal IPv4 octet (0-255).
 */
const IP_OCTET = '(?:25[0-5]|2[0-4]\\d|1\\d{2}|[1-9]?\\d)';

/**
 * Host patterns accepted as development origins. These cover the machine the
 * developer runs on (`localhost` / loopback) plus every RFC 1918 private LAN
 * range, so the app keeps working when opened from another device on the same
 * network without manually editing a CORS allowlist.
 *
 *  - `localhost`
 *  - loopback: 127.0.0.0/8
 *  - private:  10.0.0.0/8
 *  - private:  192.168.0.0/16
 *  - private:  172.16.0.0/12 (172.16.0.0 - 172.31.255.255)
 */
const DEV_ORIGIN_PATTERNS = [
  'localhost',
  `127\\.(?:${IP_OCTET}\\.){2}${IP_OCTET}`,
  `10\\.(?:${IP_OCTET}\\.){2}${IP_OCTET}`,
  `192\\.168\\.${IP_OCTET}\\.${IP_OCTET}`,
  `172\\.(?:1[6-9]|2\\d|3[0-1])\\.${IP_OCTET}\\.${IP_OCTET}`,
];

const DEV_ORIGIN_REGEX = new RegExp(
  `^https?:\\/\\/(?:${DEV_ORIGIN_PATTERNS.join('|')})(?::\\d{1,5})?$`,
  'i',
);

/**
 * Returns `true` when the given origin is `localhost`, the loopback address, or
 * a private LAN address (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16) over
 * http/https, regardless of port.
 */
export function isPrivateDevelopmentOrigin(origin: string): boolean {
  return DEV_ORIGIN_REGEX.test(origin);
}

export interface CorsConfig {
  isDevelopment: boolean;
  /** Explicit allowlist that is always honoured (used in all environments). */
  allowedOrigins: string[];
}

/**
 * Builds the CORS options for the Express app.
 *
 * - In development: `localhost`, loopback and any private LAN IP are allowed
 *   dynamically via regex, in addition to the explicit allowlist.
 * - In production: only the explicit allowlist is allowed. No wildcard is ever
 *   used and `credentials` stays enabled.
 * - Requests without an `Origin` header (same-origin, curl, server-to-server)
 *   are always allowed.
 * - Preflight `OPTIONS` requests are answered by the cors middleware itself.
 */
export function buildCorsOptions({ isDevelopment, allowedOrigins }: CorsConfig): CorsOptions {
  return {
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      const allowed = isDevelopment
        ? isPrivateDevelopmentOrigin(origin) || allowedOrigins.includes(origin)
        : allowedOrigins.includes(origin);

      callback(null, allowed);
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    preflightContinue: false,
  };
}

export const corsOptions: CorsOptions = buildCorsOptions({
  isDevelopment: env.NODE_ENV === 'development',
  allowedOrigins: env.corsOrigins,
});
