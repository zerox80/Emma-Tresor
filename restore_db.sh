#!/bin/bash
# PostgreSQL Restore Script für EmmaTresor
# Verwendung: ./restore_db.sh <backup_file>

if [ $# -eq 0 ]; then
    echo "❌ Backup-Datei als Parameter erforderlich!"
    echo "Verwendung: ./restore_db.sh <backup_file>"
    echo "Verfügbare Backups:"
    ls -la db_backups/
    exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Backup-Datei '$BACKUP_FILE' nicht gefunden!"
    exit 1
fi

# Lade Environment-Variablen
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

echo "⚠️  WARNUNG: Diese Aktion überschreibt die aktuelle Datenbank!"
echo "Backup-Datei: $BACKUP_FILE"
read -p "Möchtest du fortfahren? (y/N): " -n 1 -r
echo

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Abgebrochen."
    exit 0
fi

# Hole den Container-Namen
CONTAINER_NAME=$(docker compose ps -q postgres)

echo "Stoppe alle Verbindungen zur Datenbank..."
docker exec "$CONTAINER_NAME" psql -U "$POSTGRES_USER" -d postgres -c "
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = '$POSTGRES_DB' AND pid <> pg_backend_pid();"

echo "Lösche und erstelle Datenbank neu..."
docker exec "$CONTAINER_NAME" psql -U "$POSTGRES_USER" -d postgres -c "DROP DATABASE IF EXISTS $POSTGRES_DB;"
docker exec "$CONTAINER_NAME" psql -U "$POSTGRES_USER" -d postgres -c "CREATE DATABASE $POSTGRES_DB;"

echo "Stelle Datenbank wieder her..."
docker exec -i "$CONTAINER_NAME" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" < "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    echo "✅ Datenbank erfolgreich wiederhergestellt!"
else
    echo "❌ Wiederherstellung fehlgeschlagen!"
    exit 1
fi
