# BACKUP

Backups protect the two pieces of data that cannot be regenerated: the
**PostgreSQL database** and the **uploaded files** (`storage/uploads`).

## Storage layout

```
storage/
├── uploads/            <- user-uploaded photos & documents (source data)
└── backups/
    ├── database/       <- pg_dump custom-format backups
    └── uploads/        <- upload snapshots / tar.gz archives
```

Configure locations and retention with environment variables (docs/ENVIRONMENT.md):

| Variable                          | Default            | Meaning                                  |
|-----------------------------------|--------------------|------------------------------------------|
| `BACKUP_DIR`                      | `storage/backups`  | Root backup directory                    |
| `BACKUP_DATABASE_RETENTION_DAYS`  | `14`               | Keep database backups N days             |
| `BACKUP_UPLOADS_RETENTION_DAYS`   | `14`               | Keep upload backups N days               |
| `BACKUP_INTERVAL_MINUTES`         | `0`                | Scheduled DB backup interval (0 = off)   |
| `PG_DUMP_PATH`                    | `pg_dump`          | Absolute path to pg_dump if not on PATH  |

## Database backup

Backups are created with `pg_dump` in **custom format** (`--format=custom
--no-owner`), which supports selective and parallel restore.

- **Scheduled:** set `BACKUP_INTERVAL_MINUTES` (e.g. `1440` for daily) in
  production. The scheduler runs only when `APP_ENV=production`.
- **Manual:** `POST /api/v1/backups/database` (permission `backup.manage`).
- **List / retention:** old backups are pruned automatically by rotation after
  every backup based on `BACKUP_DATABASE_RETENTION_DAYS`.

### Manual command-line backup

```bash
pg_dump --format=custom --no-owner --file=storage/backups/database/db-manual.dump "$DATABASE_URL"
```

## Upload backup

- **Manual:** `POST /api/v1/backups/uploads` (permission `backup.manage`).
- The uploads directory is copied into a dated snapshot. If the `tar` binary is
  available the snapshot is compressed into `uploads-<timestamp>.tar.gz` and the
  folder removed; otherwise the plain folder is kept.
- Integrity is verified after every backup by comparing the file count between
  the source and the backup. A mismatch aborts and removes the bad backup.

## List backups

`GET /api/v1/backups` (permission `backup.manage`) returns both lists:

```json
{
  "success": true,
  "data": {
    "database": [{ "name": "db-2026-08-02_00-00-00.dump", "size": 12345, "createdAt": "..." }],
    "uploads": [{ "name": "uploads-2026-08-02_00-00-00.tar.gz", "size": 6789, "createdAt": "..." }]
  }
}
```

## Offsite copy (recommended)

Copy `storage/backups` to a second location or object storage periodically.
A common pattern is a cron/systemd-timer job that rsyncs or uploads the backups
directory to an S3 bucket:

```bash
# example nightly offsite sync (Linux)
rsync -a --delete /opt/office-inventory/storage/backups/ backup@offsite:/backups/
```

## Verifying backup integrity

- **Database:** `pg_restore --list <file>.dump` lists the objects without
  restoring; exit code 0 means the archive is readable.
- **Uploads:** `tar -tzf <file>.tar.gz` lists entries; compare the count with
  the live `storage/uploads` file count.

## Encryption (recommended for sensitive environments)

Encrypt backups at rest before copying them offsite:

```bash
openssl enc -aes-256-cbc -salt -pbkdf2 -in db.dump -out db.dump.enc
```

Decrypt before restore (docs/RESTORE.md).
