#!/bin/bash
echo "=== Sauberer EmmaTresor Reset ==="

echo "1. Stoppe alle Container..."
docker compose down

echo "2. Lösche alle EmmaTresor-Volumes..."
docker volume ls --format "table {{.Name}}" | grep -E "(emma-tresor|emmatresor)" | xargs -r docker volume rm

echo "3. Lösche auch verwaiste Volumes..."
docker volume prune -f

echo "4. Zeige verbleibende Volumes:"
docker volume ls

echo "5. Starte Container mit frischen Volumes..."
docker compose up -d

echo "6. Warte auf PostgreSQL-Initialisierung..."
echo "Das kann 30-60 Sekunden dauern..."
sleep 45

echo "7. Erstelle Superuser (falls AUTO_CREATE_SUPERUSER=true)..."
docker compose exec backend python manage.py collectstatic --noinput
docker compose exec backend python manage.py migrate

echo "8. Teste Datenbankverbindung..."
docker compose exec postgres psql -U emmatresor -d emmatresor -c "SELECT version();"

echo ""
echo "✅ Sauberer Reset abgeschlossen!"
echo "🌐 Frontend: https://emma.kowobau.eu"
echo "👤 Admin-Login sollte automatisch erstellt sein (siehe .env)"
echo ""
echo "Neue Volumes:"
docker volume ls | grep -E "(emma-tresor|emmatresor)"
