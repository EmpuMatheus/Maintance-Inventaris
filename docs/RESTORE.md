# RESTORE

Restoring data is a deliberate, destructive operation. Back up the current state
first (docs/BACKUP.md), then restore.

> **Stop the application** before restoring the database so no writers are active.

## Restore the database

Database backups are `pg_dump` custom-format files (`db-<timestamp>.dump`).

### 1. Locate the backup

```bash
ls storage/backups/database/
```

If it was encrypted offsite, decrypt it first:

```bash
openssl enc -d -aes-256-cbc -pbkdf2 -in db.dump.enc -out db.dump
```

### 2. Restore into the existing database

```bash
pg_restore --clean --if-exists --no-owner --dbname "$DATABASE_URL" storage/backups/database/db-<timestamp>.dump
```

- `--clean --if-exists` drops existing objects before restore.
- `--no-owner` avoids ownership errors when the role differs.

### 3. Restore into a brand-new database

```bash
createdb "$NEW_DATABASE_URL"        # or: createdb office_inventory_restore
pg_restore --no-owner --dbname "$NEW_DATABASE_URL" db-<timestamp>.dump
```

### 4. Verify

```bash
curl http://localhost:3000/api/v1/health/ready     # expect 200 "database":"connected"
# spot-check record counts:
#   SELECT count(*) FROM assets; SELECT count(*) FROM maintenance_records;
```

## Restore uploads

Upload backups are either dated snapshot folders or `uploads-<timestamp>.tar.gz`
archives.

### From a tar.gz archive

```bash
mkdir -p storage/uploads
tar -xzf storage/backups/uploads/uploads-<timestamp>.tar.gz -C storage/uploads
```

### From a snapshot folder

```bash
cp -r storage/backups/uploads/uploads-<timestamp>/* storage/uploads/
```

### Verify

The file count in `storage/uploads` must match the count recorded in the backup
summary or computed from the archive listing:

```bash
tar -tzf storage/backups/uploads/uploads-<timestamp>.tar.gz | grep -v '/$' | wc -l
```

## Point-in-time considerations

- The DB and upload backups are taken independently, so the two can be slightly
  out of sync. After a disaster restore, reconcile by re-uploading any documents
  added between the two backup timestamps.
- For minimal data loss, pair scheduled backups with the offsite copy workflow
  described in docs/BACKUP.md.

## Post-restore checklist

1. Restart the API service.
2. Verify `/api/v1/health/ready` and `/api/v1/health/live`.
3. Log in as the production admin and confirm key screens (Inventory,
   Maintenance, Reports, Administration).
4. Re-run `npm run db:seed:prod` only if the `backup.manage` permission or
   production admin role mappings are missing (seed is idempotent).
