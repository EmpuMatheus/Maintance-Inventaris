# ENVIRONMENT

Reference for every configuration variable. Copy `.env.example` to `.env` and
customize. **Never commit real secrets.**

## Runtime mode

| Variable     | Values                         | Default       | Notes                                                |
|--------------|--------------------------------|---------------|------------------------------------------------------|
| `APP_ENV`    | `development` \| `production` \| `test` | derived from `NODE_ENV` | `production` enables fail-fast validation, file logging, backup scheduler. |
| `NODE_ENV`   | `development` \| `production` \| `test` | `development` | Legacy alias; `APP_ENV` wins if both are set.        |

### Production fail-fast

With `APP_ENV=production` the server refuses to start unless:

- `JWT_SECRET` is set to a random secret **of at least 32 characters** (not the dev default)
- `CORS_ORIGIN` is an explicit allowlist

`PROD_ADMIN_PASSWORD` is only required when running `npm run db:seed:prod`
(seeding), not at runtime.

## Application

| Variable | Default | Notes |
|----------|---------|-------|
| `PORT` | `3000` | API listen port |
| `API_PREFIX` | `/api/v1` | API path prefix |
| `BASE_URL` | *(empty)* | Public base URL, e.g. `https://inventory.example.com` |
| `APP_VERSION` | `1.0.0` | Overrides package version reported by `/metrics` |
| `APP_BUILD_TIME` | *(empty)* | ISO build timestamp reported by `/metrics` |
| `CORS_ORIGIN` | `http://localhost:5173` | Comma-separated allowlist. In production this is the **only** allowed set. |

## Database

| Variable | Default | Notes |
|----------|---------|-------|
| `DATABASE_URL` | *(required)* | `postgresql://user:pass@host:5432/db` |

## Authentication

| Variable | Default | Notes |
|----------|---------|-------|
| `JWT_SECRET` | dev default | **Must be a random secret >= 32 chars in production** |
| `JWT_EXPIRES_IN` | `15m` | Access token lifetime |

## HTTPS

| Variable | Default | Notes |
|----------|---------|-------|
| `HTTPS_ENABLED` | `false` | Serve TLS directly (`true`/`false`/`1`/`0`) |
| `HTTPS_KEY` | `certs/localhost+2-key.pem` | Path to private key |
| `HTTPS_CERT` | `certs/localhost+2.pem` | Path to certificate |
| `COOKIE_SECURE` | derived from `HTTPS_ENABLED` | Marks cookies Secure when HTTPS is on |
| `TRUST_PROXY` | `false` | Express `trust proxy`: `false`, `true`, hop count `1`, or `loopback` |

When running behind a reverse proxy, terminate TLS at the proxy, set
`TRUST_PROXY=1`, and leave `HTTPS_ENABLED=false`.

### Single-origin SPA & storage

| Variable | Default | Notes |
|----------|---------|-------|
| `SERVE_SPA_DIR` | *(empty)* | Path to a built React SPA (`apps/web/dist`). When set, the API serves the SPA from the same origin and falls back to `index.html` for client-side routes. Used by the desktop launcher. |
| `STORAGE_ROOT` | derived | Overrides the storage root (uploads/logs/backups). The desktop launcher sets it to `%LOCALAPPDATA%\Office Inventory\storage` when installed under Program Files. |

## Logging

| Variable | Default | Notes |
|----------|---------|-------|
| `LOG_LEVEL` | `debug` | `debug` \| `info` \| `warn` \| `error` |
| `LOG_DIR` | `storage/logs` | Production log directory |
| `LOG_RETENTION_DAYS` | `30` | Delete logs older than N days |

In production the logger writes daily rotating files:

- `app-YYYY-MM-DD.log` — application log
- `error-YYYY-MM-DD.log` — error-level lines (mirrored)
- `access-YYYY-MM-DD.log` — HTTP access log

Passwords, tokens, cookies and authorization headers are always redacted
(`[REDACTED]`).

## Backups

| Variable | Default | Notes |
|----------|---------|-------|
| `BACKUP_DIR` | `storage/backups` | Root backup directory |
| `BACKUP_DATABASE_RETENTION_DAYS` | `14` | DB backup retention |
| `BACKUP_UPLOADS_RETENTION_DAYS` | `14` | Upload backup retention |
| `BACKUP_INTERVAL_MINUTES` | `0` | Scheduled DB backup interval; `0` disables (production only) |
| `PG_DUMP_PATH` | `pg_dump` | Absolute path to `pg_dump` if not on `PATH` |

Manual backups: `POST /api/v1/backups/database` and `POST /api/v1/backups/uploads`
(permission `backup.manage`). See docs/BACKUP.md.

## Production admin (seed)

| Variable | Default | Notes |
|----------|---------|-------|
| `PROD_ADMIN_USERNAME` | `admin` | Username created by `npm run db:seed:prod` |
| `PROD_ADMIN_PASSWORD` | *(required in production)* | Strong initial password |
| `PROD_ADMIN_NAME` | `Production Administrator` | Display name |

The production admin is assigned `SUPER_ADMIN`, is created only when missing
(`ON CONFLICT DO NOTHING` — never overwrites an existing admin), and is forced
to change its password (`must_change_password`) after first login.

## Request & scheduler

| Variable | Default | Notes |
|----------|---------|-------|
| `REQUEST_BODY_LIMIT` | `2mb` | JSON body size limit |
| `SCHEDULE_PROCESS_INTERVAL_MINUTES` | `60` | Preventive-maintenance processor interval |
| `RATE_LIMIT_*` / `AUTH_RATE_LIMIT_*` | see example | Login brute-force protection tuning |

## Frontend (VITE_*)

`VITE_*` variables are bundled into the browser and are **public**.

| Variable | Default | Notes |
|----------|---------|-------|
| `VITE_APP_NAME` | Office Inventory Maintenance System | App display name |
| `VITE_APP_VERSION` | `1.0.0` | Version shown in the UI |
| `VITE_API_URL` | `/api/v1` | API base; set an absolute URL in production |
| `VITE_API_PROXY_TARGET` | `http://localhost:3000` | Dev proxy target (dev only) |

## Examples

### Development (default in `.env.example`)

```
APP_ENV=development
DATABASE_URL=postgresql://postgres:secret@localhost:5432/office_inventory
CORS_ORIGIN=http://localhost:5173
```

### Production behind Nginx

```
APP_ENV=production
DATABASE_URL=postgresql://office:strongpass@127.0.0.1:5432/office_inventory
JWT_SECRET=<64 random characters>
CORS_ORIGIN=https://inventory.example.com
TRUST_PROXY=1
LOG_LEVEL=info
BACKUP_INTERVAL_MINUTES=1440
PROD_ADMIN_USERNAME=admin
PROD_ADMIN_PASSWORD=<strong initial password>
VITE_API_URL=https://inventory.example.com/api/v1
```
