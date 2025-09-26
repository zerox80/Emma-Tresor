#!/bin/bash
echo "=== Docker Volumes Debug ==="

echo "1. Alle Volumes anzeigen:"
docker volume ls

echo ""
echo "2. EmmaTresor-spezifische Volumes:"
docker volume ls | grep -E "(postgres|emmatresor)"

echo ""
echo "3. Volume Details für postgres_data:"
docker volume inspect $(docker compose config --services | xargs -I {} docker compose ps -q {}) 2>/dev/null | grep postgres -A 20 || echo "Postgres container nicht gefunden"

echo ""
echo "4. Container Mount-Points prüfen:"
docker compose ps -q postgres | xargs -I {} docker inspect {} --format='{{range .Mounts}}{{.Type}}: {{.Source}} -> {{.Destination}} ({{.Driver}}){{"\n"}}{{end}}' 2>/dev/null || echo "Container nicht gefunden"

echo ""
echo "5. PostgreSQL Data Directory Inhalt:"
docker compose exec postgres ls -la /var/lib/postgresql/data/ 2>/dev/null || echo "Container läuft nicht"

echo ""
echo "6. Container Logs (letzte 10 Zeilen):"
docker compose logs --tail=10 postgres 2>/dev/null || echo "Keine Logs verfügbar"
