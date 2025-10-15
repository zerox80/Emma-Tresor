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

## 6. Edge-Sicherheit & CDN (BunnyCDN)
Das System ist durch BunnyCDN geschützt, das als primärer Schutzschild für den gesamten eingehenden Traffic dient.
- **Web Application Firewall (WAF)**: Die WAF ist auf die Stufe "High" eingestellt. Dies bietet einen robusten Schutz gegen eine Vielzahl von Angriffen, einschließlich:
  - **OWASP Top 10**: Schutz vor SQL-Injection, Cross-Site Scripting (XSS), Command Injection und anderen gängigen Schwachstellen.
  - **Bot & Scraping Protection**: Blockiert bösartige Bots und verhindert das automatische Auslesen von Inhalten.
  - **DDoS-Mitigation**: BunnyCDN absorbiert und filtert großvolumige DDoS-Angriffe, bevor sie die Serverinfrastruktur erreichen.
- **Content Delivery Network (CDN)**: Statische und mediale Inhalte werden über das globale Netzwerk von BunnyCDN ausgeliefert, was die Ladezeiten reduziert und die Verfügbarkeit erhöht.

## 7. Netzwerksicherheit & Infrastruktur
- **TLS & Cookies**: `.env.production` erzwingt `DJANGO_FORCE_SSL=1`, `JWT_COOKIE_SECURE=1`, `JWT_COOKIE_SAMESITE=None` für Cross-Site Cookies via HTTPS. TLS-Terminierung erfolgt auf dem CDN.
- **Reverse Proxy**: Nginx (`docker/nginx/`, `nginx/emmatresor.conf`) läuft hinter BunnyCDN und ist für das Routing interner Anfragen, das Setzen von Security-Headern und das Rate-Limiting zuständig.
- **Container-Härtung**: Das Backend-Dockerfile erstellt einen Non-Root-Benutzer `appuser`, setzt Verzeichnisrechte und entfernt `apt`-Caches zur Reduzierung der Angriffsfläche.
- **Health Checks**: Docker Compose nutzt `manage.py check --deploy` und `pg_isready` zur Überprüfung der Dienstverfügbarkeit.

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

## 12. Sicherheitsbewertung (1-10 Skala)

| Kategorie | Bewertung | Begründung |
| --- | :---: | --- |
| **Edge & Netzwerksicherheit** | **9/10** | Exzellenter Schutz durch BunnyCDN mit WAF auf "High". Nginx-Härtung und Rate-Limiting sind ebenfalls sehr gut konfiguriert. Punktabzug für fehlende, dokumentierte Origin-IP-Beschränkung. |
| **Authentifizierung & Zugriff** | **8/10** | Sehr sichere JWT-Implementierung mit Argon2, Cookie-Schutz und Blacklisting. Das Admin-Interface könnte zusätzlichen Schutz (z.B. 2FA) vertragen. |
| **Daten- & Anwendungsschutz** | **8/10** | Starke Eingabevalidierung, Schutz privater Medien und eine solide CSP. Die dateibasierte Speicherung von Secrets ist der Hauptgrund für den Punktabzug. |
| **Infrastruktur & Deployment** | **7/10** | Gutes Docker-Hardening und automatisierte Checks. Es fehlen jedoch automatisierte Security-Scans in der CI/CD-Pipeline und ein zentrales Secret-Management. |
| **Monitoring & Response** | **6/10** | Gutes Security-Logging ist implementiert, aber es fehlt eine Anbindung an ein SIEM oder ein automatisiertes Alerting, was die Reaktionszeit auf Vorfälle verlangsamt. |

---

### Gesamtbewertung: 8.5 / 10 (Sehr Gut)

Das Projekt verfügt über eine sehr starke und tiefgreifende Sicherheitsarchitektur, die durch den Einsatz von BunnyCDN WAF erheblich verbessert wird. Die meisten kritischen Bereiche sind gut abgedeckt. Die verbleibenden Schwachpunkte liegen hauptsächlich im Bereich der Automatisierung von Sicherheitsprozessen (Secrets Management, CI/CD-Scans) und der Überwachung. Mit der Implementierung der verbleibenden Empfehlungen kann eine exzellente Bewertung erreicht werden.
