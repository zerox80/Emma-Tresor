# Emma-Tresor von PostgreSQL 16 auf 19 migrieren

Plane ein Wartungsfenster für Dump, Restore und Prüfung ein. PostgreSQL 19 bekommt ein neues Volume. Das alte 16er-Volume bleibt als Rückweg erhalten. Eine Neuinstallation kann direkt mit `docker compose up -d --build` starten.

Die Befehle gelten für den Standard-Compose-Stack mit einer Emma-Tresor-Datenbank und einer Datenbankrolle. Führe sie im bisherigen Checkout in derselben Bash-Sitzung aus. Behalte den bisherigen Compose-Projektnamen bei, auch wenn du ihn mit `-p` oder `COMPOSE_PROJECT_NAME` setzt. So bleiben die Volumes für öffentliche und private Uploads zugeordnet. Der Datenbank-Dump enthält nur die Datenbank. Sichere die Uploads wie gewohnt separat. Falls du zusätzliche Rollen, Datenbanken oder Tablespaces eingerichtet hast, sichere und migriere diese ebenfalls.

## 1. Auf dem laufenden 16er-Stand sichern

Pausiere automatische Deployments und zusätzliche schreibende Clients für das Wartungsfenster. Halte Platz für beide Datenvolumes und den Dump bereit. Der Checkout muss dem laufenden 16er-Release entsprechen, damit der gesicherte Commit auch dessen Compose-Konfiguration enthält. Notiere den ausgegebenen Sicherungspfad für den Rückweg.

```bash
set -euo pipefail
sicherung=$(mktemp -d "$HOME/emmatresor-pg16.XXXXXXXX")
echo "$sicherung"
git rev-parse HEAD > "$sicherung/revision"
cp -p .env "$sicherung/env.pg16"

dbsql() {
  docker compose exec -T postgres sh -c 'exec psql -XAt -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "$1"' sh "$1"
}
stand='SELECT (SELECT count(*) FROM auth_user), (SELECT count(*) FROM inventory_item), (SELECT count(*) FROM django_migrations)'
test "$(dbsql "SELECT current_setting('server_version_num')::int / 10000")" = 16
alt=$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/var/lib/postgresql/data"}}{{.Name}}{{end}}{{end}}' "$(docker compose ps -q postgres)")
test -n "$alt"
printf '%s\n' "$alt" > "$sicherung/volume.pg16"

docker compose stop nginx backend
dbsql "$stand" > "$sicherung/bestand.pg16"
BACKUP_DIR="$sicherung" BACKUP_RETENTION_DAYS=0 scripts/db_backup.sh
docker compose stop postgres
```

Kopiere das Sicherungsverzeichnis vor dem Wechsel auf einen geschützten zweiten Speicher. Es enthält auch die bisherige `.env` mit Zugangsdaten. Bei einem Abbruch vor dem Versionswechsel kannst du den bisherigen Stack mit `docker compose up -d` wieder starten.

## 2. Nur PostgreSQL 19 starten und den Dump einspielen

Aktualisiere jetzt den Checkout auf das Release mit dieser Anleitung (auf `main` nach dem Merge beispielsweise mit `git pull --ff-only`). Starte den Stack erst nach dem Restore vollständig. Das Backend führt beim Start automatisch Django-Migrationen aus.

```bash
ziel="${alt}_pg19"
if docker volume inspect "$ziel" >/dev/null 2>&1; then
  echo "Zielvolume $ziel existiert bereits. Vor dem Fortfahren ein frisches Ziel wählen." >&2
  exit 1
fi
printf '\nPOSTGRES_VOLUME_NAME=%s\n' "$ziel" >> .env
docker compose up -d --wait postgres
test "$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/var/lib/postgresql"}}{{.Name}}{{end}}{{end}}' "$(docker compose ps -q postgres)")" = "$ziel"
test "$(dbsql "SELECT current_setting('server_version_num')::int / 10000")" = 19
test "$(dbsql "SELECT count(*) FROM pg_tables WHERE schemaname = 'public'")" = 0

dump=("$sicherung"/emmatresor_*.dump)
test "${#dump[@]}" -eq 1
docker compose exec -T postgres sh -c 'exec pg_restore --single-transaction --exit-on-error --no-owner -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < "${dump[0]}"
dbsql "$stand" > "$sicherung/bestand.pg19"
diff -u "$sicherung/bestand.pg16" "$sicherung/bestand.pg19"
```

Bei einem Fehler lasse Backend und Nginx gestoppt. Der Restore läuft in einer Transaktion. Ein leerer `diff` bestätigt die gleichen Anzahlen von Benutzern, Inventargegenständen und angewendeten Django-Migrationen. Der Eintrag `POSTGRES_VOLUME_NAME` bleibt nach der Migration dauerhaft in der Deployment-Konfiguration.

## 3. Anwendung freigeben

```bash
docker compose up -d --build --wait backend
docker compose exec -T backend python manage.py migrate --check
docker compose up -d --build nginx
```

Prüfe mit einem bestehenden Konto die Anmeldung, einen bekannten Inventargegenstand und einen privaten Anhang. Bewahre das 16er-Volume und den Dump bis zur Abnahme auf. `docker compose down -v` würde auch die eingebundenen Medien-Volumes löschen.

## Rückweg auf PostgreSQL 16

Das alte Volume enthält die Daten bis zum Wartungsfenster. Sobald Benutzer auf Version 19 geschrieben haben, müssen diese Änderungen vor einer Rückkehr gesichert und abgeglichen werden. Für den Rückweg ohne zwischenzeitliche Schreibzugriffe verwende das oben ausgegebene Sicherungsverzeichnis als `$sicherung` und denselben Compose-Projektnamen.

```bash
set -euo pipefail
docker compose stop nginx backend postgres
git switch --detach "$(cat "$sicherung/revision")"
cp -p "$sicherung/env.pg16" .env
docker compose up -d --wait postgres
test "$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/var/lib/postgresql/data"}}{{.Name}}{{end}}{{end}}' "$(docker compose ps -q postgres)")" = "$(cat "$sicherung/volume.pg16")"
version=$(docker compose exec -T postgres sh -c 'exec psql -XAt -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SHOW server_version_num"')
test "$((version / 10000))" = 16
docker compose up -d --build backend nginx
```

Der Checkout steht danach auf dem gesicherten Commit. Vor dem nächsten regulären Update wieder auf den Deployment-Branch wechseln.
