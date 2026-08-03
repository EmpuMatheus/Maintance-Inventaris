# RELEASE CHECKLIST

Use this checklist before every production release.

## Pre-release

- [ ] `npm run lint` — 0 errors
- [ ] `npm run typecheck` — all workspaces pass
- [ ] `npm run test` — full backend suite passes (173+ tests)
- [ ] `npm run build:prod` — production build succeeds
- [ ] `npm run check:prod` — artifacts present (dist, build-info.json, migrations)
- [ ] New DB migrations generated and reviewed (`npm run db:migrate` applied on staging)
- [ ] `build-info.json` shows the correct version/commit
- [ ] Changelog/version bumped in `package.json` and `.env.example` `APP_VERSION`

## Configuration

- [ ] `.env` uses `APP_ENV=production`
- [ ] `JWT_SECRET` is a fresh random value >= 32 chars
- [ ] `CORS_ORIGIN` is the exact production origin allowlist
- [ ] `PROD_ADMIN_PASSWORD` set (or existing admin in place)
- [ ] `DATABASE_URL` points at the production database
- [ ] `TRUST_PROXY` matches the proxy setup (e.g. `1` behind Nginx)
- [ ] `BACKUP_INTERVAL_MINUTES` configured (e.g. `1440`)
- [ ] `LOG_LEVEL=info` (not `debug`) in production

## Infrastructure

- [ ] Reverse proxy configured (docs/proxy/nginx.conf.example) with HTTPS
- [ ] HTTP -> HTTPS redirect in place (proxy-level, or `HTTPS_ENABLED=true`)
- [ ] PostgreSQL reachable and `pg_dump` on PATH (or `PG_DUMP_PATH` set)
- [ ] Uploads directory `storage/uploads` writable by the service account
- [ ] Backup + logs directories writable
- [ ] Offsite backup copy job configured (docs/BACKUP.md)

## Smoke test (after deploy)

- [ ] `GET /api/v1/health/live` → 200
- [ ] `GET /api/v1/health/ready` → 200 (database connected)
- [ ] `GET /api/v1/metrics` → reports version, uptime, memory, disk
- [ ] Login as production admin succeeds
- [ ] Production admin is prompted to change the initial password
- [ ] Inventory: list, search, create, assign, transfer
- [ ] Maintenance: create, workflow states, complete updates asset condition
- [ ] Schedules & calendar render
- [ ] Tickets: create, assign, resolve
- [ ] Reports: each report renders and exports XLSX
- [ ] Audit log records privileged actions
- [ ] Administration: users, roles, permission matrix
- [ ] Notifications bell + center
- [ ] QR: mobile scan + manual lookup
- [ ] Upload a photo/document — rejected file types blocked
- [ ] Access logs written daily; error-level lines in `error-*.log`
- [ ] Manual backup endpoints work and rotation prunes old backups

## Post-release

- [ ] Monitor `/api/v1/metrics` for memory/disk trends
- [ ] Confirm scheduled backup produced a file within `BACKUP_INTERVAL_MINUTES`
- [ ] Verify error log is empty of unexpected exceptions
- [ ] Record the release (version + commit) in build-info.json
