/**
 * Application-wide configuration.
 *
 * `apiUrl` defaults to a relative path (`/api/v1`) so that during development
 * requests are transparently proxied by Vite to the API server. Because the
 * browser always talks to the origin it was loaded from, the frontend works
 * unchanged whether it is opened via `localhost`, `127.0.0.1` or the current
 * LAN IP.
 *
 * For production (or when the API is hosted separately), set `VITE_API_URL` to
 * an absolute URL such as `https://api.example.com/api/v1`.
 */
export const config = {
  appName: import.meta.env.VITE_APP_NAME || 'Office Inventory Maintenance System',
  apiUrl: (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/+$/, ''),
} as const;
