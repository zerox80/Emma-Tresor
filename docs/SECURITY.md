# Sicherheitshandbuch für Emma-Tresor

> Stand: November 2025 – Bitte Änderungen im Rahmen von Pull Requests dokumentieren.

## 1. Überblick
Emma-Tresor ist eine Inventarverwaltungslösung mit einem Django REST Backend (`EmmaTresor/`, `inventory/`) und einem React/Vite Frontend (`frontend/`). Das System speichert sensible Bestands- und Metadaten, verarbeitet Benutzeranmeldungen via JWT und bietet QR-Code-Funktionen. Dieses Dokument fasst den aktuellen Sicherheitszustand sowie organisatorische Prozesse zusammen und richtet sich an Betreiber:innen, Entwickler:innen und Auditor:innen.

## 2. Architektur & Sicherheitsrelevante Komponenten
- **Backend (`EmmaTresor/settings.py`)**: Django 5.2, Django REST Framework, SimpleJWT, Sicherheits-Middleware, CSP, Logging-Konfiguration.
- **Backend-App (`inventory/`)**: Datenmodelle mit Validierungen, Cookie-basierte JWT-Authentifizierung, Ratenbegrenzungen, Upload-Validierung.
- **Frontend (`frontend/src/`)**: React 19.x, Axios-Client mit CSRF-Token-Handling, Zustandverwaltung (Zustand), Route-Guards.
- **DevOps**: Docker Compose (`docker-compose.yml`), separates Nginx-Proxy-Setup (`nginx/`), Deployment-Skripte (`deploy_ubuntu.sh`, `setup_backend.py`).
- **Konfiguration**: `.env.production`, `env.example` und `requirements.txt` beschreiben harte Sicherheitsvorgaben (TLS, Secret-Rotation, Cookie Flags).

## 3. Security Intake & Responsible Disclosure
- **Kontaktadresse**: Sicherheitsrelevante Hinweise bitte an `security@emmatresor.example` senden (Postfach wird werktäglich geprüft).
- **PGP-Key**: Öffentlicher Schlüssel unter `docs/pgp/security.asc` (Fingerprint in `docs/pgp/README.md`).
- **Erwartete Reaktionszeiten**: Erste Rückmeldung innerhalb von 3 Werktagen, vollständige Antwort oder Zwischenstand binnen 10 Werktagen.
- **Coordinated Disclosure**: Wir bevorzugen koordiniertes Vorgehen und bitten um angemessene Zeitspanne zur Behebung gemeldeter Schwachstellen.

## 4. Authentifizierung & Sitzungsmanagement
- **JWT-Cookie-Flow** (`inventory/views.py`, `CookieJWTAuthentication`): Zugriffstoken (15 Minuten) + optionales Refresh-Token (7 Tage) werden als HttpOnly-Cookies gesetzt. Logout invalidiert Refresh-Tokens via Blacklist, sämtliche Token-Cookies werden gelöscht.
- **Remember-Me**: Separate Kennzeichnung über Cookie (`JWT_REMEMBER_COOKIE_NAME`), das Refresh-Lebensdauer steuert.
- **Rate Limiting** (`settings.py`): Differenzierte Throttles für Login, Registrierung, CRUD-Aktionen und QR-Code-Generierung reduzieren Brute-Force-Angriffe.
- **Passwortschutz**: Argon2 als bevorzugter Hash; zusätzliche Validatoren (Länge, Gemeinsamkeiten, numerisch) verhindern schwache Passwörter.
- **CSRF-Abwehr**: Backend-Endpunkt `/csrf/`, Axios-Interceptor (`frontend/src/api/client.ts`) und Standard-Cookie `csrftoken` stellen CSRF-Header für mutierende Requests bereit.

## 5. Autorisierung & Mandantenschutz
- **Datenisolation**: `UserScopedModelViewSet` filtert Querysets nach dem authentifizierten Benutzer und verhindert horizontale Rechteausweitung.
- **Registrierungssteuerung**: `ALLOW_USER_REGISTRATION` ist standardmäßig deaktiviert, Aktivierung erfordert explizite Umgebungsvariable.
- **Admin-Interface**: Django-Admin bleibt aktiv; zusätzliche Schutzmaßnahmen (2FA, VPN) werden empfohlen, sind aber nicht projektiert.

## 6. Datenvalidierung & Schutz sensibler Daten
- **Modellvalidierung** (`inventory/models.py`): Feldprüfungen, Upload-Limits (max. 8 MB), Pillow-basierte Bildvalidierung (`load()` + Pixelbegrenzung) gegen Image-Tricks.
- **Private Medien** (`inventory/storage.py`): Eigene Storage-Instanz außerhalb öffentlicher MEDIA-Root, keine direkte URL-Auslieferung.
- **Secret-Management**: `.env`-basiert mit Rotationsunterstützung (`DJANGO_SECRET_KEY_OLD_*`); für Produktion wird zentraler Secret Store (Vault/SSM) empfohlen.
- **Datenbank**: PostgreSQL mit konfigurierbaren Credentials; `DB_VENDOR` erlaubt SQLite für lokale Entwicklung.

## 7. Netzwerk- & Infrastruktur-Schutz
- **TLS & Cookies**: Produktionsbeispiel `.env.production` erzwingt HTTPS (`DJANGO_FORCE_SSL=1`), Secure/HttpOnly/SameSite=None flags für JWT-Cookies.
- **Reverse Proxy**: Nginx (`nginx/emmatresor.conf`) terminiert TLS im Standard-Setup, setzt Security-Header (HSTS, CSP) und dient als statischer Asset-Host.
- **Container-Härtung**: Backend-Dockerfile führt Non-Root-User (`appuser`) ein, setzt restriktive Verzeichnisrechte und entfernt Paket-Caches.
- **Gesundheitsprüfungen**: Docker Compose nutzt `manage.py check --deploy` sowie `pg_isready` für Datenbank-Verfügbarkeit.
- **CDN/WAF (BunnyCDN)**: Eingebundener Edge-Schutz via BunnyCDN: WAF-Profil auf „High“, Bot Protection aktiv, DDoS-Mitigation inklusive. Regeln für Rate-Limiting, Geo-Blocking und Header-Härtung werden im Betriebs-Runbook gepflegt (siehe internes BunnyCDN-Playbook; Summary in `nginx/README.md`, `nginx/SIMPLE-SETUP.md`).

## 8. Logging, Monitoring & Audits
- **Security Logging** (`EmmaTresor/middleware.py`, `settings.py`): `SecurityEventLoggingMiddleware` protokolliert 401/403/429 inklusive Pfad, IP und User Agent; Logs rotieren via `logging.handlers.RotatingFileHandler` im Verzeichnis `logs/security.log`.
- **Audit-Trails**: `ItemChangeLog` führt JSON-Diffs zu CRUD-Operationen; Datenbank-Indices erleichtern Nachverfolgung.
- **Monitoring-Ansatz**: Kein SIEM oder zentrale Log-Aggregation im Einsatz; bei derzeitigem Zwei-Personen-Betrieb genügt eine manuelle Log-Prüfung (z. B. wöchentlich). Für Skalierung sollten SIEM/Syslog-Forwarding und Alerting vorbereitet werden.

## 9. Build-, Release- & Lieferkettensicherheit
- **Dependencies** (`requirements.txt`, `frontend/package.json`): Gepinnte Versionen mit konservativen Operatoren. Regelmäßiges Update-Review erforderlich.
- **Setup/Deploy-Skripte** (`setup_backend.py`, `deploy_ubuntu.sh`): Automatisieren Migrationen, erstellen Venvs; keine Signaturprüfung für Pakete implementiert.
- **CI/CD**: README empfiehlt GitHub Actions, aber es existiert keine standardisierte Pipeline im Repo. Sicherheitsprüfungen (Linting, SCA, SAST) müssen projektspezifisch ergänzt werden.
- **Software Bill of Materials (SBOM)**: Nicht vorhanden; Empfehlung zur Einführung (z. B. `cyclonedx-bom`, `npm audit --json`).

## 10. Drittparteien & externe Dienste
- **Managed Services**: Keine fest eingebundenen SaaS-Anbieter. Projekt ist autark betreibbar.
- **Platz für Erweiterungen**: Bei Integration von E-Mail/SMS/Monitoring müssen zusätzliche Sicherheitsanforderungen dokumentiert werden.

## 11. Offene Risiken & Beobachtungen
- **Secret Handling**: `.env`-Dateien im Dateisystem setzen strenge Zugriffskontrollen voraus; zentrale Secret-Verwaltung fehlt.
- **Admin-Härtung**: Django-Admin erfordert zusätzliche Maßnahmen (2FA/SSO) außerhalb des Codebestands.
- **Monitoring**: Fehlende SIEM/Alerting-Anbindung; aufgrund des kleinen Nutzerkreises vertretbar, sollte bei Wachstum priorisiert werden.
- **Shadow IT**: README erkennt fehlendes Inventarisierungs-/CASB-Tool; Umsetzung offen.
- **Backups**: Backup-Skripte speichern Dumps im Projektverzeichnis; Rechte-Management und Rotation müssen organisatorisch sichergestellt werden.

## 12. Empfehlungen
1. **Secrets zentralisieren** (Vault/SSM/KMS) und Rotation automatisieren.
2. **CI/CD-Sicherheit**: Pipeline mit SAST, SCA, Dependency-Review, Signaturverifikation etablieren.
3. **Monitoring skalierbar halten**: Manuelle Log-Prüfung dokumentieren; bei größerem Team Security-Events an SIEM oder zentrales Log-System weiterleiten und Alerting-Policy definieren.
4. **Admin-Zugang absichern**: 2FA oder IP-Restriktionen für Django-Admin prüfen.
5. **BunnyCDN-WAF pflegen**: Regelwerk mindestens quartalsweise reviewen (IPs, Geo-Blocking, Bot-Regeln) und Änderungen im BunnyCDN-Playbook dokumentieren.
6. **SBOM & Updates**: Regelmäßige SBOM-Generierung und Update-Reviews fest im Prozess verankern.

## 13. Incident Response
- **Log-Speicherung**: `logs/security.log` mindestens 180 Tage aufbewahren, Rotationsgröße 10 MB × 10 Backups.
- **Incident-Runbook**: Siehe `docs/incident_response.md` (in Arbeit) für Rollen, Meldewege und Checklisten.
- **Forensik**: Container-Images sind reproduzierbar; Snapshots vor Wiederherstellung anfertigen.

## 14. Sicherheitsbewertung (1–10 Skala)

| Kategorie | Bewertung | Begründung |
| --- | :---: | --- |
| **Netzwerk & Edge** | **9/10** | Nginx-Härtung plus produktiver BunnyCDN-WAF (High-Profile, Bot Protection, DDoS-Mitigation); kleinere Lücke: Playbook-Prozesse weiter automatisieren. |
| **Authentifizierung & Zugriff** | **8/10** | Starke JWT-Cookie-Implementierung, Argon2 und Throttling; Admin-Härtung noch ausbaufähig. |
| **Daten- & Anwendungsschutz** | **8/10** | Umfangreiche Validierungen und privater Storage; Secrets weiterhin filesystem-basiert. |
| **Infrastruktur & Deployment** | **7/10** | Container-Härtung und Health Checks vorhanden, aber keine automatisierte CI/CD-Security. |
| **Monitoring & Response** | **6/10** | Manuelle Log-Prüfung deckt den Zwei-Personen-Betrieb ab; SIEM/Alerting für Wachstum vorbereiten. |

---

### Gesamtbewertung: 7.6 / 10 (Gut)

Emma-Tresor verfügt über solide Sicherheitsmechanismen auf Applikations- und Infrastrukturebene. Der produktive BunnyCDN-Edge-Schutz ergänzt die Nginx-Härtung wirkungsvoll; im aktuellen Zwei-Personen-Betrieb reichen dokumentierte Minimalprozesse (z. B. manuelle Log-Prüfung) aus. Für einen produktionsreifen Betrieb mit größerem Team sind weiterhin zusätzliche organisatorische Maßnahmen (Secrets-Management, Monitoring-Automatisierung, Admin-Härtung) und ein definierter Verantwortungsprozess erforderlich. Die Umsetzung der Empfehlungen erhöht Transparenz, Reaktionsfähigkeit und reduziert das Risiko operativer Fehlkonfigurationen.
