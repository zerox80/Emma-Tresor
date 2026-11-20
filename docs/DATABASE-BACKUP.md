# Database Backup & Restore

`scripts/db_backup.sh` creates a backup of the PostgreSQL database from the running Docker Compose stack.

## What the script does

- Runs `pg_dump` inside the `postgres` container, so no PostgreSQL tools are needed on the host
- Writes `db_backups/emmatresor_<UTC timestamp>.dump` in the compressed custom format
- Checks the dump with `pg_restore --list` before keeping it. A failed or broken dump never replaces anything and leaves no partial file behind
- Creates the files with permissions `600`, because the backups contain personal data
- After a successful backup, deletes `emmatresor_*.dump` files older than 14 days

| Variable | Default | Meaning |
|---|---|---|
| `BACKUP_DIR` | `<project>/db_backups` | Where backups are written |
| `BACKUP_RETENTION_DAYS` | `14` | Delete backups older than this; `0` keeps everything |

## Creating a backup

The `postgres` service must be running. Run the script as root or as a user in the `docker` group:

```bash
scripts/db_backup.sh
```

If it reports that `db_backups` is not writable: Docker creates the directory as `root` when it starts the stack. Either run the script as root or take over the directory with `sudo chown "$USER" db_backups`.

## Daily backups with cron

Example for the root crontab (`sudo crontab -e`), adjust the path to your checkout:

```cron
17 3 * * * /opt/Emma-Tresor/scripts/db_backup.sh >> /var/log/emmatresor-backup.log 2>&1
```

Backups on the same disk do not protect against disk failure or a lost server. Copy `db_backups/` to another machine or storage regularly (e.g. with `rsync`, `restic` or `borg`).

## Restoring a backup

Restoring replaces the entire database. Create a fresh backup first so you can go back.

```bash
scripts/db_backup.sh
```

Stop the backend so it does not write during the restore:

```bash
docker compose stop backend
```

Drop and recreate the database. This also removes tables that were created after the backup was taken:

```bash
docker compose exec -T postgres sh -c 'dropdb --username="$POSTGRES_USER" --force "$POSTGRES_DB" && createdb --username="$POSTGRES_USER" "$POSTGRES_DB"'
```

Restore the backup, replacing the file name:

```bash
docker compose exec -T postgres sh -c 'pg_restore --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" --no-owner' < db_backups/emmatresor_20260101T031700Z.dump
```

Start the backend again:

```bash
docker compose start backend
```

Test a restore every now and then. A backup you have never restored is not a proven backup.

## PostgreSQL major upgrades

The dump format works across major versions: a backup from PostgreSQL 16 restores into a newer server (tested with 16 → 18). A major upgrade is therefore: back up, start the new version with an empty data volume, and restore as described above. Simply changing the image tag on an existing data volume does not work, because PostgreSQL cannot read the data directory of an older major version.
