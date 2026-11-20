#!/usr/bin/env bash
# Back up the EmmaTresor PostgreSQL database from the running Docker Compose stack.
#
# Usage:   scripts/db_backup.sh   (can be called from any directory)
# Output:  db_backups/emmatresor_<UTC timestamp>.dump
#          pg_dump custom format: compressed, restored with pg_restore.
#
# Environment:
#   BACKUP_DIR             Target directory (default: <project>/db_backups)
#   BACKUP_RETENTION_DAYS  Delete backups older than this many days after a
#                          successful run (default: 14, 0 = keep everything)
#
# Restore and cron setup: docs/DATABASE-BACKUP.md

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_DIR/db_backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
SERVICE="postgres"

log() { printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >&2; }
die() { log "ERROR: $*"; exit 1; }

[[ "$RETENTION_DAYS" =~ ^[0-9]+$ ]] || die "BACKUP_RETENTION_DAYS must be a whole number, got '$RETENTION_DAYS'"

cd "$PROJECT_DIR"

if [[ -z "$(docker compose ps --status running --quiet "$SERVICE")" ]]; then
    die "service '$SERVICE' is not running (start it with: docker compose up -d $SERVICE)"
fi

# Backups contain personal data: only the owner may read them.
umask 077
mkdir -p "$BACKUP_DIR"
[[ -w "$BACKUP_DIR" ]] || die "$BACKUP_DIR is not writable (Docker may have created it as root; fix with: sudo chown \"\$USER\" $BACKUP_DIR)"

target="$BACKUP_DIR/emmatresor_$(date -u '+%Y%m%dT%H%M%SZ').dump"
partial="$target.partial"
trap 'rm -f "$partial"' EXIT

log "Dumping database to $target"
docker compose exec -T "$SERVICE" sh -c \
    'exec pg_dump --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" --format=custom' \
    > "$partial"

[[ -s "$partial" ]] || die "pg_dump produced an empty file"
docker compose exec -T "$SERVICE" pg_restore --list < "$partial" > /dev/null \
    || die "backup failed verification (pg_restore --list could not read it)"

mv "$partial" "$target"
trap - EXIT
log "Backup complete: $(du -h "$target" | cut -f1)"

if (( RETENTION_DAYS > 0 )); then
    find "$BACKUP_DIR" -maxdepth 1 -type f -name 'emmatresor_*.dump' \
        -mmin +"$(( RETENTION_DAYS * 24 * 60 ))" -print -delete \
        | while read -r old; do log "Deleted old backup $old"; done
fi
