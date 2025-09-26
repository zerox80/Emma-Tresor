#!/bin/bash
echo "=== PostgreSQL Volume Migration ==="
echo "Migriere Daten von emma-tresor_postgres_data zu emmatresor_postgres_data"

# Stoppe Container
echo "1. Stoppe Container..."
docker compose down

# Erstelle temporären Container für Migration
echo "2. Starte Migrations-Container..."
docker run --rm -it \
  -v emma-tresor_postgres_data:/old_data \
  -v emmatresor_postgres_data:/new_data \
  alpine sh -c "
    echo 'Kopiere Daten vom alten zum neuen Volume...'
    cp -av /old_data/. /new_data/ || echo 'Fehler beim Kopieren'
    echo 'Migration abgeschlossen!'
    echo 'Alte Volume-Größe:'
    du -sh /old_data
    echo 'Neue Volume-Größe:'  
    du -sh /new_data
  "

echo "3. Starte Container wieder..."
docker compose up -d

echo "4. Warte auf PostgreSQL..."
sleep 10

echo "5. Teste Datenbankverbindung..."
docker compose exec postgres psql -U emmatresor -d emmatresor -c "SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema = 'public';"

echo "✅ Migration abgeschlossen! Deine Daten sollten wieder da sein."
