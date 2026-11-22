# PostgreSQL 16 auf 19 mit Docker Compose migrieren

Im bestehenden Emma-Tresor-Checkout auf dem Docker-Host ausführen. Den Stack vorher laufen lassen. Für eine Neuinstallation genügt weiterhin `docker compose up -d --build`.

```bash
git pull --ff-only && python3 scripts/migrate_postgres_19.py
```

Der Befehl setzt Python 3.8+ und Docker Compose v2 mit `--wait` voraus. Unter Windows mit Docker Desktop und PowerShell 7 lautet er `git pull --ff-only && py -3 scripts/migrate_postgres_19.py`. Alle PostgreSQL-Werkzeuge laufen in Linux-Containern. Der ausführende Benutzer braucht Zugriff auf Docker und Schreibrechte im Checkout. Plane ein Wartungsfenster und Platz für das zweite Datenvolume, den Datenbank-Dump und beide komprimierten Medienarchive ein. Pausiere währenddessen externe Datenbankschreiber und automatische Deployments.

Das Skript ermittelt das Compose-Projekt und das Datenvolume, stoppt Nginx und Backend und sichert die Datenbank sowie öffentliche und private Uploads. Es erstellt ein eigenes Zielvolume, trägt es in `.env` ein, spielt den Dump in einer Transaktion ein und vergleicht die Anzahl der Benutzer, Inventargegenstände und Django-Migrationen. Nach dem Django-Migrationscheck öffnet es Nginx wieder.

**Backup und Rückweg.** Am Ende steht der Sicherungspfad im Terminal. Unter `.pg19-migration/pg16-…/` liegen Dump, Medienarchive, ursprüngliche `.env` und die Compose-Konfiguration für die alte Datenbank. Kopiere diese Sicherung auf einen geschützten zweiten Speicher. Das 16er-Volume bleibt erhalten.

**Fehler oder Unterbrechung.** Scheitert der Umstieg vor der Freigabe, startet das Skript den Stack wieder mit dem ursprünglichen 16er-Volume. Nach einem Stromausfall oder Prozessabbruch denselben Skriptbefehl erneut ausführen. Sobald die geprüfte 19er-Datenbank freigegeben werden kann, setzt ein weiterer Aufruf den Start der Dienste auf 19 fort. Eine bereits migrierte Installation wird geprüft. Eine nachträgliche Rückkehr auf 16 erfordert den Abgleich aller seit der Freigabe geschriebenen Daten.

Der automatische Umzug ist für die Emma-Tresor-Datenbank im Standard-Compose-Stack ausgelegt. Zusätzliche Datenbanken, eigene Datenbankrollen oder Tablespaces erfordern eine separate Clustermigration.
