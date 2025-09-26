#!/bin/bash
echo "=== Live Nginx Charset Fix ==="

echo "1. Aktuelle Nginx-Config prüfen:"
docker compose exec nginx cat /etc/nginx/conf.d/default.conf | grep -A5 -B5 "server_name"

echo ""
echo "2. Charset-Direktive hinzufügen (falls nicht vorhanden):"
docker compose exec nginx sed -i '/server_name _;/a\    charset utf-8;' /etc/nginx/conf.d/default.conf

echo ""
echo "3. Config nach Änderung:"
docker compose exec nginx cat /etc/nginx/conf.d/default.conf | grep -A5 -B5 "charset"

echo ""
echo "4. Nginx reload:"
docker compose exec nginx nginx -s reload

echo ""
echo "✅ Fix angewendet! Teste die Seite jetzt im Browser."
