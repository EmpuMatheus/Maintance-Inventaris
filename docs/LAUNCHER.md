# DESKTOP LAUNCHER

Office Inventory ships as a Windows desktop application. End users only
double-click **Office Inventory.exe** — no terminal, npm commands or manual
backend startup required.

## How it works

The launcher is a **Node.js SEA (Single Executable Application)** built from
`tools/launcher/src/launcher.ts`. It:

1. Enforces a single instance (lock file + health check).
2. Reads `config.json`.
3. Starts the production backend (`apps/api/dist/server.cjs`) as a child process.
4. Waits until `GET /api/v1/health` returns OK.
5. Serves the built React SPA from the same origin and opens the default
   browser at `http://localhost:<port>`.
6. Monitors the backend and **restarts it automatically** if it crashes.
7. Shuts down gracefully (and the backend self-terminates if the launcher dies).

## Build

```bash
# 1. Build React, the production backend bundle and the SEA launcher,
#    then assemble the release folder:
npm run package:release

# The release folder now contains:
#   release/
#   ├── Office Inventory.exe      <- double-click this
#   ├── config.template.json     <- copy to config.json and edit
#   ├── apps/
#   │   ├── api/dist/server.cjs  <- production backend
#   │   └── web/dist/            <- built React SPA
#   ├── node_modules/            <- runtime deps (argon2, exceljs)
#   └── storage/                 <- uploads, logs, backups
```

Steps used internally by `package:release`:

- `npm run build:prod` — production build of shared/web/api (+ `build-info.json`)
- `node scripts/build-launcher.mjs` — bundles the launcher with esbuild, builds
  the SEA blob (`node --experimental-sea-config`), copies `node.exe` and injects
  the blob with `postject` → `release/Office Inventory.exe`
- installs the minimal runtime `node_modules` (`argon2`, `exceljs`)

## Configuration (`config.json`)

The first time the launcher runs it creates `config.json` from
`config.template.json`. Every option is editable:

| Option | Type | Default | Meaning |
|--------|------|---------|---------|
| `port` | number | `3000` | HTTP port for the app |
| `autoStart` | boolean | `true` | Open the browser automatically on start |
| `browser` | string | `"default"` | `default` \| `chrome` \| `edge` \| full path to a browser exe |
| `logLevel` | string | `"info"` | Backend log level |
| `nodePath` | string | `""` | Full path to `node.exe` when not on PATH |
| `jwtSecret` | string | auto-generated | Stable JWT secret (generated on first run) |
| `database.url` | string | *(required)* | `postgresql://user:pass@host:5432/db` |
| `sap.enabled` | boolean | `false` | Forwarded as `SAP_*` env vars (integration hook) |
| `sap.url` / `sap.username` / `sap.password` | string | `""` | SAP connection values |
| `backup.enabled` | boolean | `false` | Enable scheduled database backups |
| `backup.intervalMinutes` | number | `1440` | Backup interval (daily) |
| `backup.retentionDays` | number | `14` | Backup retention |

### Data location

- Installed **outside** Program Files (or run from the release folder): data
  lives next to the exe (`config.json`, `logs/`, `storage/`).
- Installed under **Program Files**: writable data moves to
  `%LOCALAPPDATA%\Office Inventory` so standard users can run the app.

### First-time database setup

The database must be migrated and seeded once by an administrator:

```bash
npm install
npm run db:migrate
npm run db:seed          # development
npm run db:seed:prod     # production (creates the forced-password admin)
```

After that the launcher only needs a working `database.url`.

## Logs

- **Launcher log**: `<data-dir>\logs\launcher-YYYY-MM-DD.log` (rotates daily, 30-day retention)
- **Backend logs**: `<data-dir>\storage\logs\{app,error,access}-YYYY-MM-DD.log`
- Backend stdout/stderr is also mirrored into the launcher log with a `[backend]` prefix.

## Installer

Installers are built with **Inno Setup** (free, from jrsoftware.org).

```bash
npm run build:installer     # requires ISCC.exe on PATH or in "Inno Setup 6"
```

The installer:

- Installs the release folder to `%ProgramFiles%\Office Inventory`
- Creates Desktop and Start Menu shortcuts
- Registers uninstall in the Control Panel
- Optionally adds a **Startup shortcut** so the app launches when Windows starts

## Troubleshooting

| Symptom | Cause / fix |
|---------|-------------|
| "Backend bundle not found" | Run `npm run package:release` |
| "database.url is required" | Edit `config.json` and set the PostgreSQL connection |
| "Node.js was not found" | Install Node.js 20+ or set `nodePath` in `config.json` |
| "Database is not reachable" | Check `database.url`, run `db:migrate`/`db:seed` once |
| Port already in use | Change `port` in `config.json` |
| Backend restarts repeatedly | Check `<data-dir>\storage\logs\error-*.log` |

---

# DEVELOPER LAUNCHER (OfficeInventoryDev.exe)

For developers who work on the source checkout. Run it from the project root —
no CMD, no npm commands needed. It manages the **development** servers.

## Build

```bash
npm run build:dev-launcher      # produces OfficeInventoryDev.exe at the repo root
```

## What it does automatically

1. Detects **Node.js** and **npm**.
2. Detects **PostgreSQL** (TCP check on the `DATABASE_URL` host:port).
3. Validates **.env** (must exist with `DATABASE_URL`).
4. Installs dependencies automatically when `node_modules` is missing.
5. Starts the backend with `npm run dev:api` (tsx watch) and waits for `/health`.
6. Starts the frontend with `npm run dev:web` (Vite) and waits for the server.
7. Opens the browser to the Vite URL and the built-in **control panel**.
8. Control panel (browser window) shows live backend/frontend status, streaming
   logs, and buttons: **Restart Backend**, **Restart Frontend**, **Stop All**.
9. Prevents duplicate launcher instances.
10. Saves rotating daily logs to `logs/dev-launcher-YYYY-MM-DD.log` (30-day retention).

If a backend/frontend is already running on its port, the launcher reuses it
(marked "external" in the panel) instead of crashing with `EADDRINUSE`.

## Configuration

Optional `dev.config.json` at the repo root:

```json
{
  "controlPort": 3900,
  "apiPort": 3000,
  "webPort": 5173,
  "autoOpenBrowser": true
}
```

(All fields optional — defaults shown.)

## Control panel endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /` | Dashboard (status, logs, buttons) |
| `GET /api/status` | JSON status of backend/frontend + detection results |
| `GET /events` | SSE stream of live log lines |
| `POST /api/action/restart-backend` | Restart the backend |
| `POST /api/action/restart-frontend` | Restart the frontend |
| `POST /api/action/stop` | Stop everything and exit |
