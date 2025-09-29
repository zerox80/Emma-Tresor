#!/bin/bash
# PostgreSQL Backup Script für EmmaTresor
# Verwendung: ./backup_db.sh

# Lade Environment-Variablen sicher
if [ -f .env ]; then
    set -a
    # shellcheck disable=SC2046
    . ./.env
    set +a
fi

# Erstelle Backup-Verzeichnis falls es nicht existiert
mkdir -p db_backups

# Erstelle Backup mit Zeitstempel
TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S)
BACKUP_FILE="db_backups/emmatresor_backup_${TIMESTAMP}.sql"

echo "Erstelle Backup der EmmaTresor-Datenbank..."
echo "Backup-Datei: $BACKUP_FILE"

# Hole den Container-Namen
CONTAINER_NAME=$(docker compose ps -q postgres)

# Stelle sicher, dass der Postgres-Container läuft
if [ -z "$CONTAINER_NAME" ]; then
    echo "❌ PostgreSQL-Container wurde nicht gefunden. Läuft docker compose?"
    exit 1
fi

# Erstelle Backup
if ! docker exec "$CONTAINER_NAME" pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" > "$BACKUP_FILE"; then
    echo "❌ Backup fehlgeschlagen!"
    exit 1
fi

echo "✅ Backup erfolgreich erstellt: $BACKUP_FILE"
