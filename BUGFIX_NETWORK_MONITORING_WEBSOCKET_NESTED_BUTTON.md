# Bugfix Report — Network Monitoring WebSocket + Network Devices Nested Button

Date: 2026-09-11
Scope: exactly two bugs. No feature work, no refactor, no database/state-machine/ICMP/incident/Event Bus/payload changes.

---

## 1. Root cause WebSocket

The Vite dev server runs on `https://localhost:5173` with HTTPS enabled, and it proxies only `/api` and `/uploads` to the backend (port 3000). It did **not** proxy `/socket.io`.

The frontend `resolveSocketUrl()` (`apps/web/src/lib/socket.ts`) returns `window.location.origin` whenever the API URL is relative (the project default is `VITE_API_URL=/api/v1`). Therefore the browser tried:

```
wss://localhost:5173/socket.io/?EIO=4&transport=websocket
```

That is the Vite dev server, not the Socket.IO backend. Vite had no route for `/socket.io`, so the WebSocket handshake was rejected/closed immediately, producing:

```
WebSocket is closed before the connection is established.
```

A **secondary** cause (React StrictMode) amplified the error: `useNetworkMonitoring` called `disconnectSocket()` in its `useEffect` cleanup. With `<StrictMode>` enabled in `apps/web/src/main.tsx`, development effects run mount → cleanup → mount. The cleanup tore down the shared singleton while it was still mid-handshake, so a valid connection was closed and a brand-new singleton was created on the second mount.

## 2. Root cause nested button

`apps/web/src/features/reports/components/ReportTable.tsx` renders the mobile card view as a `<button>` wrapper (for `onRowClick`). The column set from `NetworkDeviceListPage.tsx` includes an `action` column whose `render` returns real `<button>` elements (Edit / Nonaktifkan / Aktifkan). Resulting DOM:

```
<button class="block w-full ...">      ← mobile card / row
  ...
  <button>Edit</button>                 ← invalid nested button
  <button>Nonaktifkan</button>
</button>
```

The desktop `<tr>` path was already valid (it is a `<tr>` with `onClick`, and the action cell is a `<span onClick={stopPropagation}>`).

## 3. Files changed

- `apps/web/vite.config.ts`
- `apps/web/src/features/network-monitoring/hooks/useNetworkMonitoring.ts`
- `apps/web/src/features/reports/components/ReportTable.tsx`

No other file was intentionally modified.

## 4. Changes made

### `apps/web/vite.config.ts`
Added a Vite dev proxy for `/socket.io` that forwards to the existing API proxy target and enables WebSocket upgrade:

```ts
'/socket.io': {
  target: apiProxyTarget,
  changeOrigin: true,
  ws: true,
},
```

`apiProxyTarget` is the existing `VITE_API_PROXY_TARGET` (default `http://localhost:3000`), not a new hardcoded value.

### `apps/web/src/features/network-monitoring/hooks/useNetworkMonitoring.ts`
- Removed the `disconnectSocket()` import.
- Stopped calling `disconnectSocket()` in the effect cleanup. Listener unsubscription (`socket.off`) is preserved. The shared singleton now survives the StrictMode mount/cleanup/mount cycle, so a valid handshake is not torn down. `disconnectSocket()` remains exported for explicit teardown (e.g. logout).

### `apps/web/src/features/reports/components/ReportTable.tsx`
Changed the mobile card wrapper from `<button>` to a non-interactive `<div>` that keeps `onClick`, the exact same layout classes, and a conditional `cursor-pointer` when `onRowClick` is set:

```tsx
<div
  key={rowKey(item)}
  onClick={onRowClick ? () => onRowClick(item) : undefined}
  className={`block w-full rounded-lg border border-slate-200 bg-white p-4 text-left${onRowClick ? ' cursor-pointer' : ''}`}
>
```

Nested action buttons remain real `<button>`s and are now valid HTML. Their existing `onClick={(e) => e.stopPropagation()}` in the action cell prevents the row navigation, so behaviour is unchanged.

## 5. How the frontend now determines the Socket.IO URL

Unchanged logic in `apps/web/src/lib/socket.ts`:

- Relative `config.apiUrl` (default `/api/v1`) → `window.location.origin`.
- Absolute `VITE_API_URL` (e.g. `https://api.example.com/api/v1`) → suffix `/api/vN` stripped to obtain the origin.

So the browser always connects to the origin it was loaded from. It no longer points at `:5173` as if it were an API server; `:5173` is now a working proxy hop.

## 6. How the proxy / backend URL is used

- Browser → `wss://<current-origin>/socket.io` (Vite dev server).
- Vite (`ws: true`) → `http://localhost:3000/socket.io` (backend, default `VITE_API_PROXY_TARGET`).
- Protocol follows the environment: HTTPS page → `wss` browser-side, plain `ws` on the internal proxy hop; production with HTTPS → `wss` end to end.
- Socket.IO still uses the default `/socket.io` path, Engine.IO protocol, JWT auth handshake, and the existing backend CORS allowlist. Nothing in the backend was changed.

## 7. Does React StrictMode have an effect?

Yes — it was a contributing cause, and it is now handled. StrictMode still double-invokes the effect in development, but the cleanup only removes listeners; it no longer disconnects the shared socket, so the singleton is created once and the valid connection persists. No connect → disconnect → connect loop. The singleton in `socket.ts` is still safe: `getSocket()` creates it only when `socket === null`, and `connectSocket()` is a no-op while already connected/connecting.

## 8. Typecheck

`npm run typecheck` — **PASS** (shared, web, api).

## 9. Lint

`npm run lint` — **PASS**: 0 errors. 224 pre-existing warnings (`no-explicit-any`, one `react-hooks/exhaustive-deps`), none introduced by the changed files. Targeted lint of the four touched files returned 0 problems.

## 10. Frontend test

`npm run test -w apps/web` — **PASS**: 3 files, 21 tests.
Additionally, a temporary server-render assertion verified the `ReportTable` mobile card contains no nested interactive elements; it passed and was removed afterwards.

## 11. Backend test

`npm run test -w apps/api` — **PASS**: 43 files, 285 tests.

## 12. Frontend build

`npm run build -w apps/web` — **PASS** (`tsc -b && vite build`).

## 13. Backend build

`npm run build -w apps/api` — **PASS** (`tsc --noEmit && node scripts/build.mjs` → `dist/server.cjs`).

## 14. Manual verification

Performed against the real running stack (Postgres was available):

1. Started backend: `Server started` on port 3000, DB connected, network monitoring runner started (2-minute interval unchanged).
2. Started Vite dev server: `https://localhost:5173`.
3. HTTP API through proxy: `GET https://localhost:5173/api/v1/health` → `200 OK`.
4. Socket.IO handshake through proxy (polling): `GET https://localhost:5173/socket.io/?EIO=4&transport=polling` → `200` with `0{"sid":...,"upgrades":["websocket"],...}` (previously this hit an unproxied Vite route and failed).
5. Real WebSocket via `socket.io-client` (`transports: ['websocket','polling']`, JWT from `POST /api/v1/auth/login`) to `https://localhost:5173`:
   - `CONNECTED id=...`
   - `NETWORK_READY {"connectedAt":"..."}`
   - exit code 0.

This confirms items 1–5 and 8–10 of the expected results: HTTP API works, Socket.IO connects to the backend, no WebSocket error loop, `network:ready` is received, authentication and CORS are untouched, and API recovery on reconnect remains wired through the existing `connect` handler.

For the Network Devices bug, verification of “no nested `<button>`” was done by server-side render + tag-stack assertion (passed) because no browser/jsdom is available in this environment. Click behaviour (detail/edit/activate/deactivate) is preserved structurally: the wrapper is now a `<div>` with the same `onClick`, the action cell still calls `stopPropagation()`, and the `<button>` handlers are unchanged. Full browser click-through is recommended for sign-off.

## 15. Blockers / findings

No blockers for the two requested fixes.

Findings outside the requested scope (reported, not changed):

- `apps/web/package.json` test script contains a Windows-only redirect: `vitest run --passWithNoTests 2>nul || echo "No tests configured yet."`. On Linux `2>nul` creates a `nul` file and `||` can mask failures. Tests still ran and passed here. Not modified because the task forbids changing scripts to make testing “look” successful.
- `disconnectSocket()` currently has no callers after this change. It is intentionally kept for explicit logout teardown; the monitoring socket now stays connected after leaving `/network-monitoring`. No auth/logout integration was added (out of scope).
- Vite's `loadEnv` uses `apps/web` as its env dir, so `VITE_API_PROXY_TARGET` from the repository root `.env` is not read; the config falls back to the identical default `http://localhost:3000`. No behavioural issue in this project, but worth noting if the backend port ever changes.
- `apps/web/tsconfig.tsbuildinfo` is tracked and was refreshed as a side effect of running the requested typecheck/build. It is a generated artifact.
- The working tree already contained unrelated uncommitted changes (`network-device.repository.ts`, `network-device.service.ts`, `router/index.tsx`, `AppLayout.tsx`, the `network-devices` feature, tests, `NETWORK_DEVICE_MANAGEMENT_REPORT.md`). These were left untouched.
