#!/bin/bash
# PostgreSQL Backup Script für EmmaTresor
# Verwendung: ./backup_db.sh

# Lade Environment-Variablen
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
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

# Erstelle Backup
docker exec "$CONTAINER_NAME" pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" > "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    echo "✅ Backup erfolgreich erstellt: $BACKUP_FILE"
else
    echo "❌ Backup fehlgeschlagen!"
    exit 1
fi
