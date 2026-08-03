# DEPLOYMENT

This guide covers deploying the Office Inventory Maintenance System to production on Windows and Linux.

## Windows desktop launcher (recommended for end users)

End users double-click **Office Inventory.exe** — no terminal, npm commands or
manual backend startup. The launcher starts the backend, serves the React SPA,
opens the browser, monitors and restarts the backend if it crashes, and keeps
daily rotating logs.

```bash
npm run package:release     # builds React + backend bundle + SEA launcher
npm run build:installer     # optional: build the Inno Setup installer (requires Inno Setup 6)
```

See **docs/LAUNCHER.md** for full details (config.json options, data location,
first-time database setup, troubleshooting).

## Developer launcher (for developers)

**OfficeInventoryDev.exe** is a separate SEA launcher for the source checkout.
It detects Node/npm/PostgreSQL, validates `.env`, installs dependencies if
missing, runs the backend and frontend in watch mode, opens the browser, and
provides a control panel with live status, streaming logs and restart/stop
buttons.

```bash
npm run build:dev-launcher   # produces OfficeInventoryDev.exe at the repo root
```

See the **Developer Launcher** section in docs/LAUNCHER.md.

## Architecture

```
Browser ── HTTPS ──> Reverse Proxy (Nginx/Apache/IIS)
                        │
                        ├─ /api/v1  ──> Node.js API (Express) ──> PostgreSQL
                        ├─ /uploads ─> static files (storage/uploads)
                        └─ /        ─> Vite-built React SPA (static)
```

Two deployable artifacts are produced by the production build:

| Artifact        | Location                    | Runtime                        |
|-----------------|-----------------------------|--------------------------------|
| Web (SPA)       | `apps/web/dist`             | Any static file server / proxy |
| API             | `apps/api/dist`             | Node.js >= 20                  |

## Prerequisites

- Node.js **>= 20** (tested on 22)
- PostgreSQL **>= 14** with `pg_dump` available for database backups
- A reverse proxy (Nginx, Apache, or IIS) for HTTPS termination (recommended)

## 1. Install dependencies

```bash
npm install
```

## 2. Configure environment

Copy the example and set real values:

```bash
cp .env.example .env
# edit .env — see docs/ENVIRONMENT.md
```

**Required in production:** `DATABASE_URL`, `JWT_SECRET` (>= 32 random chars),
`CORS_ORIGIN` (explicit allowlist), `PROD_ADMIN_PASSWORD`.

## 3. Run database migrations

```bash
npm run db:migrate
```

## 4. Seed production admin

```bash
npm run db:seed:prod
```

The production admin is created with the `SUPER_ADMIN` role and is forced to
change its password on first login.

## 5. Build

```bash
npm run build:prod
```

This writes `build-info.json` (version, build timestamp, git commit) and builds
the shared package, the web SPA and the API with `NODE_ENV=production`.

Validate the build before release:

```bash
npm run check:prod
```

## Windows deployment

1. Install Node.js LTS from nodejs.org.
2. Install PostgreSQL from postgresql.org (enable `pg_dump` in the installer).
3. Clone the repository, run steps 1-5 above.
4. Start the API:

   ```powershell
   npm run start:prod
   ```

5. Serve `apps/web/dist` with IIS (see `docs/proxy/iis.web.config.example`) or
   `npx serve apps/web/dist` behind your proxy.
6. Recommended: register a scheduled task so the service restarts automatically,
   or run under a process manager such as PM2 (`pm2 start scripts/start-prod.mjs`).

## Linux deployment

1. Install Node.js LTS (NodeSource) and PostgreSQL (`apt install postgresql`).
2. Clone the repository, run steps 1-5 above.
3. Run the API under systemd:

   ```ini
   # /etc/systemd/system/office-inventory.service
   [Unit]
   Description=Office Inventory API
   After=network.target postgresql.service

   [Service]
   WorkingDirectory=/opt/office-inventory
   ExecStart=/usr/bin/node /opt/office-inventory/apps/api/dist/server.js
   Environment=NODE_ENV=production
   Environment=APP_ENV=production
   Restart=on-failure
   User=office

   [Install]
   WantedBy=multi-user.target
   ```

   ```bash
   sudo systemctl enable --now office-inventory
   ```

4. Serve the SPA with Nginx or Apache (see `docs/proxy/`).

## PostgreSQL setup

```sql
CREATE USER office WITH PASSWORD 'STRONG_PASSWORD';
CREATE DATABASE office_inventory OWNER office;
-- optional: GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO office;
```

`DATABASE_URL=postgresql://office:STRONG_PASSWORD@localhost:5432/office_inventory`

## Reverse proxy & HTTPS

Set `TRUST_PROXY=1` (or `loopback`) so the API honours `X-Forwarded-*` headers.
See `docs/proxy/nginx.conf.example`, `docs/proxy/apache.conf.example` and
`docs/proxy/iis.web.config.example`.

For direct HTTPS without a proxy, set `HTTPS_ENABLED=true` and point
`HTTPS_KEY`/`HTTPS_CERT` at your certificate files (see docs/ENVIRONMENT.md).

## Upgrade

1. `git pull` the new release.
2. `npm install`.
3. `npm run build:prod`.
4. Back up the database (`npm run backup:database` via the admin API, see docs/BACKUP.md).
5. `npm run db:migrate`.
6. Restart the service.
7. Verify `/api/v1/health/ready` returns 200.

## Rollback

1. Restore the previous `apps/api/dist` and `apps/web/dist`.
2. Restore the database from the backup taken before the upgrade
   (see docs/RESTORE.md).
3. Restart the service.

## Next steps

- Verify production readiness with `npm run check:prod`.
- Run through `docs/RELEASE_CHECKLIST.md` before going live.
