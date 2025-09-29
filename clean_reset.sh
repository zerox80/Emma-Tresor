#!/bin/bash
echo "=== Sauberer EmmaTresor Reset ==="

echo "1. Stoppe alle Container..."
docker compose down

echo "2. Lösche alle EmmaTresor-Volumes..."
docker volume ls --format "{{.Name}}" | grep -E "^(emma-tresor|emmatresor)" | xargs -r docker volume rm || {
    echo "⚠️  Konnte Volumes nicht löschen. Bitte manuell prüfen."
}

echo "3. Lösche auch verwaiste Volumes..."
docker volume prune -f || {
    echo "⚠️  Volume-Aufräumung fehlgeschlagen."
}

echo "4. Zeige verbleibende Volumes:"
docker volume ls

echo "5. Starte Container mit frischen Volumes..."
if ! docker compose up -d; then
    echo "❌ docker compose up -d fehlgeschlagen."
    exit 1
fi

echo "6. Warte auf PostgreSQL-Initialisierung..."
echo "Das kann 30-60 Sekunden dauern..."
sleep 45

echo "7. Erstelle Superuser (falls AUTO_CREATE_SUPERUSER=true)..."
if ! docker compose exec backend python manage.py collectstatic --noinput; then
    echo "❌ collectstatic fehlgeschlagen."
    exit 1
fi
if ! docker compose exec backend python manage.py migrate; then
    echo "❌ Migration fehlgeschlagen."
    exit 1
fi

echo "8. Teste Datenbankverbindung..."
docker compose exec postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT version();" || {
    echo "⚠️  Verbindungstest fehlgeschlagen."
}

echo ""
echo "✅ Sauberer Reset abgeschlossen!"
echo "🌐 Frontend: ${FRONTEND_BASE_URL:-http://127.0.0.1:5173}"
echo "👤 Admin-Login sollte automatisch erstellt sein (siehe .env)"
echo ""
echo "Neue Volumes:"
docker volume ls | grep -E "(emma-tresor|emmatresor)"
