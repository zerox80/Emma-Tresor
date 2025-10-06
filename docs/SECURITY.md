# Sicherheitshandbuch für Emma-Tresor

## 1. Überblick
Emma-Tresor ist eine Inventarverwaltungslösung mit einem Django REST Backend (`EmmaTresor/`, `inventory/`) und einem React/Vite Frontend (`frontend/`). Das System speichert sensible Bestands- und Metadaten, verarbeitet Benutzeranmeldungen via JWT und bietet QR-Code-Funktionen. Dieser Bericht fasst den aktuellen Sicherheitszustand nach Code- und Konfigurationsreview zusammen und liefert eine Bewertung nach dem US-amerikanischen Notensystem.

## 2. Architektur & Sicherheitsrelevante Komponenten
- **Backend (`EmmaTresor/settings.py`)**: Django 5.2, REST Framework, SimpleJWT, Argon2 hashing, Security Middleware, CSP, Logging.
- **Backend-App (`inventory/`)**: Datenmodelle, Auth, Views, Validierung (z. B. Größen-/Formatprüfungen für Uploads).
- **Frontend (`frontend/src/`)**: React 19.1, Axios-Client mit CSRF-Schutz, Zustand-Management.
- **DevOps**: Docker Compose (`docker-compose.yml`), separate Dockerfiles, `deploy_ubuntu.sh`, `.env.production` Muster.
- **Konfiguration**: `.env.production`, `env.example`, `requirements.txt` geben deutliche Sicherheitsvorgaben (Secret Rotation, TLS, Cookie Flags).

## 3. Authentifizierung & Sitzungsmanagement
- **JWT Cookie-Flow** (`inventory/views.py`, `CookieJWTAuthentication`): Access/Refresh Tokens werden als HttpOnly-Cookies gesetzt; optionales "Remember me" mit Rotation. Refresh wird bei Logout geblacklistet, Cookies werden gelöscht.
- **Rate Limiting** (`settings.py` & `views.py`): Separate Throttles für Login, Registrierung, Aktionen, QR-Generierung.
- **Passwörter**: Argon2 als bevorzugter Hash (`PASSWORD_HASHERS`), Django Validierungen aktiv.
- **CSRF**: `GetCSRFTokenView` + Axios-Interceptor (`frontend/src/api/client.ts`) holen und setzen Cookies, CSRF-Header wird für mutierende Requests angefügt.

## 4. Autorisierung & Mandantenschutz
- **Benutzerspezifische Daten** (`UserScopedModelViewSet`): Querysets gefiltert per User-ID, Updates prüfen Eigentümer, wodurch horizontale Eskalationen verhindert werden.
- **Registrierung**: Standardmäßig deaktiviert (`ALLOW_USER_REGISTRATION=false`), lässt sich per Env steuern.
- **Rollenmodell**: Primär Single-Tenant pro Account; Admin-Oberfläche bleibt Django-Standard (keine zusätzlichen Rollen ersichtlich).

## 5. Datenvalidierung & Schutz sensibler Daten
- **Model Validierung** (`inventory/models.py`): Prüft Wertebereiche, Asset-Tags mit UUID, Uploadgrößen/-formate mit vollständiger Bildvalidierung (Pillow `load()` verhindert bekannte Angriffe, Pixel-Limit zur Bomb-Prävention).
- **Private Medien** (`inventory/storage.py`): Eigener Storage außerhalb öffentlicher MEDIA-Roots schützt sensible Anhänge.
- **Secrets**: Nutzung eines dedizierten Vaults wird nicht erwähnt; stattdessen .env-Dateien, aber Rotation vorgesehen (`DJANGO_SECRET_KEY` + Fallbacks).
- **Datenbank**: PostgreSQL standardmäßig, Credentials per env; `psycopg[binary]` im Einsatz, `DB_VENDOR` fallback auf SQLite für Dev.

## 6. Netzwerksicherheit & Infrastruktur
- **TLS & Cookies**: `.env.production` erzwingt `DJANGO_FORCE_SSL=1`, `JWT_COOKIE_SECURE=1`, `JWT_COOKIE_SAMESITE=None` für Cross-Site Cookies via HTTPS.
- **Reverse Proxy**: Nginx-Setup (`docker/nginx/`, `nginx/emmatresor.conf`) übernimmt TLS-Terminierung, HSTS in `settings.py` aktiv bei FORCE_SSL.
- **Container-Härtung**: Backend-Dockerfile erstellt Non-Root User `appuser`, setzt Verzeichnisrechte, entfernt apt caches.
- **Health Checks**: Docker Compose nutzt `manage.py check --deploy`, `pg_isready` zur Verfügbarkeitsprüfung.

## 7. Logging, Monitoring & Audits
- **Security Logging** (`settings.py`, `middleware.py`): `SecurityEventLoggingMiddleware` loggt 401/403/429 mit Kontext; Logging-Handler schreibt in `logs/security.log` mit Rotation.
- **Change Tracking**: `ItemChangeLog` dokumentiert CRUD-Aktionen mit JSON-Diff, Audit-Indexes vorhanden.
- **Fehlende Hinweise**: Kein dediziertes SIEM, aber Logs strukturiert; Einbindung externer Monitoring-Systeme nicht dokumentiert.

## 8. Build- & Deployment-Sicherheit
- **Dependencies** (`requirements.txt`): Festgelegte Major-Versionen (>=,<) mindern unkontrollierte Updates. Pillow 11.3, Django 5.2 etc.
- **Setup Scripts** (`setup_backend.py`, `run_backend.py`): Automatische Migrationen, optional Venv, kein Hinweis auf Signaturprüfung.
- **CI/CD**: README empfiehlt GitHub Actions, Tests (`python manage.py test`, `npm run typecheck`). Kein definierter Pipeline-Ordner vorhanden.
- **Secrets Handling**: `.env.production` Beispiel nutzt Platzhalter, aber keine Anleitung zum Secrets-Management (z. B. Vault, SSM).

## 9. Third-Party & Lieferkette
- **Externe Dienste**: Keine externen APIs abseits Standardbibliotheken. README erwähnt Attack Surface Monitoring, aber keine Umsetzung.
- **Open Source**: Abhängigkeiten über PyPI/npm; SBOM oder Dependabot nicht dokumentiert.

## 10. Offene Risiken & Beobachtungen
- **Shadow IT & Inventar**: README benennt fehlende Transparenz, derzeit kein Tool implementiert.
- **Secrets im Dateisystem**: `.env`-basierter Ansatz erfordert konforme Betriebsprozesse (Zugriffshärtung, Rotation, Audit).
- **Admin-Interface**: Kein Brute-Force-Schutz dokumentiert, Rate-Limits greifen für API-Logins; Admin-/Session-Management muss überprüft werden.
- **Frontend-Schutz**: CSP erlaubt nur `'self'`; jedoch kein `strict-dynamic`, potenzielle Erweiterung bei Nutzung externer Ressourcen nötig.
- **Backups & Logs**: Docker Compose legt Backups im Projektverzeichnis ab; Berechtigungen/Rotation müssen administrativ gesichert werden.

## 11. Empfehlungen
- **Secrets Management**: Anbindung an zentralen Secret Store (Vault, AWS SSM) statt `.env` im Deployment.
- **SBOM & Supply Chain**: Automatisierte Dependency-Scans (SCA) mit Alerts integrieren.
- **Monitoring**: SIEM-Anbindung für `security.log`, Alerting definieren.
- **Shadow IT**: Umsetzung der geplanten CASB/App-Whitelist (README Roadmap) priorisieren.
- **Hardening**: Docker Images regelmäßig scannen, minimaler Base Image Footprint, Rootless Compose.

## 12. Bewertung (US Letter Grade)
| Kategorie | Note | Begründung |
| --- | --- | --- |
| Authentifizierung & Zugriff | **A-** | Argon2, JWT mit Rotate/Blacklist, MFA-Vorgaben in Doku; Admin-Bereich benötigt zusätzliche Hardening.
| Daten- & Anwendungsschutz | **B+** | Umfangreiche Validierung, Private Storage, CSP/HSTS; Secrets noch Dateibasiert.
| Infrastruktur & Deployment | **B** | Docker Hardening, Health Checks vorhanden; keine dokumentierten Vulnerability Scans oder IaC-Policies.
| Monitoring & Response | **B-** | Security Logging solide, aber keine SIEM/Alerting-Integration; Incident-Runbooks fehlen.
| Governance & Prozesse | **B** | Detaillierte README-Vorgaben, doch tatsächliche Richtlinien/Trainings nicht implementiert.

**Gesamtnote: B (Good Security Posture)**
Das Projekt zeigt starke technische Sicherheitsmaßnahmen im Code und in den Konfigurationen. Für ein exzellentes Niveau fehlen vor allem operationalisierte Prozesse: zentralisiertes Secrets-Management, automatisierte Supply-Chain-Checks, Monitoring-Integration und formalisierte Incident-/Governance-Strukturen.
