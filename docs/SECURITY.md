# Sicherheitsleitfaden für EmmaTresor

Dieser Leitfaden fasst die wichtigsten Sicherheitsmaßnahmen und empfohlenen Betriebsrichtlinien für EmmaTresor zusammen. 

**Stand:** 2025-09-30  
**Version:** 1.1.0  
**Tech Stack:** Django 5.2+, Django REST Framework, React 19, PostgreSQL 16, Nginx 1.27, Docker

## 🔒 Letzte Security Updates (v1.1.0)

**Datum:** 2025-09-30

### Behobene Schwachstellen:
- ✅ **CSRF-Middleware entfernt** - API-Endpoints sind jetzt durch Django's Standard-CSRF-Schutz gesichert
- ✅ **HSTS konfiguriert** - 1-Jahres HSTS Header für Produktion aktiviert (`SECURE_HSTS_SECONDS=31536000`)
- ✅ **JWT Access Token Lifetime reduziert** - Von 30 auf 15 Minuten für bessere Sicherheit
- ✅ **Docker Non-Root User** - Backend-Container läuft als `appuser` (UID 1000) statt Root
- ✅ **Security Event Logging** - 401/403/429 Responses werden strukturiert geloggt
- ✅ **Enhanced Nginx Security Headers** - Permissions-Policy, COOP, CORP hinzugefügt
- ✅ **Rate Limiting für Static Files** - /static/ und /media/ haben jetzt 50req/s Limit
- ✅ **User Enumeration Prevention** - Generische Fehlermeldungen beim Login
- ✅ **Input Length Validation** - Max 10.000 Zeichen für Item-Beschreibungen

### Neue Features:
- 📝 **Security Logging** - Automatisches Logging von Security Events in `logs/security.log`
- 🔒 **.gitignore erstellt** - `.env.production` wird nie mehr ins Repository committed
- 📋 **.env.production.template** - Sichere Template-Datei für Production Deployments

## Zusammenfassung

EmmaTresor ist eine sichere Inventarverwaltung mit:
- ✅ **Cookie-basierte JWT-Authentication** (httpOnly, SameSite, Secure)
- ✅ **Argon2 Passwort-Hashing** mit automatischer Migration
- ✅ **Content Security Policy** (Django + Nginx)
- ✅ **Zweistufiges Rate Limiting** (DRF + Nginx)
- ✅ **Docker-basiertes Deployment** mit Health Checks
- ✅ **PostgreSQL** mit automatischen Backups
- ✅ **HTTPS/TLS-Ready** mit Reverse Proxy Support

## Inhaltsverzeichnis

- [Authentifizierung & Autorisierung](#authentifizierung--autorisierung)
- [Transport- & Sitzungs-Sicherheit](#transport---sitzungs-sicherheit)
- [Frontend-Schutzmaßnahmen](#frontend-schutzmassnahmen-react--typescript)
- [Rate Limiting & DDoS-Schutz](#rate-limiting--ddos-schutz)
- [Infrastruktur & Deployment](#infrastruktur--deployment)
- [Bekannte Einschränkungen](#bekannte-einschrankungen)
- [Incident Response](#incident-response)
- [Checkliste: Vor dem Go-Live](#checkliste-vor-dem-go-live)
- [Kontakt & Responsible Disclosure](#kontakt--responsible-disclosure)

## Authentifizierung & Autorisierung

- **Passworthashing:** Django verwendet den `Argon2PasswordHasher` als primären Hasher. Bei der Migration bestehender Installationen werden Passwörter beim nächsten Login automatisch auf Argon2 aktualisiert. Fallback-Hasher (PBKDF2, BCrypt, Scrypt) sind für Legacy-Kompatibilität vorhanden.
- **JWT-Konfiguration:**
  - Access-Token Gültigkeit: 15 Minuten (reduziert für bessere Sicherheit)
  - Refresh-Token Gültigkeit: 7 Tage, inklusive Rotation & Blacklisting (`ROTATE_REFRESH_TOKENS=True`, `BLACKLIST_AFTER_ROTATION=True`)
  - Tokens werden ausschließlich als httpOnly-/SameSite-Cookies gesetzt (konfigurierbare Cookie-Namen: `emmatresor_access_token`, `emmatresor_refresh_token`), wodurch kein Zugriff per JavaScript möglich ist
  - Cookie-Pfade: Access-Token auf `/`, Refresh-Token auf `/api/` limitiert
  - Logout-Endpoint (`POST /api/auth/logout/`) invalidiert Refresh Tokens über Blacklist und löscht alle Cookies
  - Custom Authentication: `CookieJWTAuthentication` prüft zuerst Authorization Header, dann Cookies (Fallback-Mechanismus)
- **Benutzerregistrierung:** 
  - `UserRegistrationViewSet` limitiert HTTP-Methoden auf `POST` und validiert Passwörter serverseitig
  - Standardmäßig deaktiviert (`ALLOW_USER_REGISTRATION=False`), muss explizit aktiviert werden
  - Passwortvalidierung: Ähnlichkeit zu Nutzerdaten, Mindestlänge, häufige Passwörter, rein numerische Passwörter werden blockiert

## Transport- & Sitzungs-Sicherheit

- **SSL/TLS-Konfiguration:**
  - `DJANGO_FORCE_SSL`: Aktiviert Secure-Flags für Cookies (Standard: `True` in Produktion)
  - `DJANGO_SSL_REDIRECT`: Optional für automatische HTTP→HTTPS Umleitung (Standard: `False`, da meist Reverse Proxy dies übernimmt)
  - `SECURE_PROXY_SSL_HEADER`: Akzeptiert `X-Forwarded-Proto` Header von Reverse Proxy
  - `USE_X_FORWARDED_HOST=True`: Ermöglicht korrektes Handling hinter Proxy
- **Cookies:**
  - `SESSION_COOKIE_SECURE`: Dynamisch basierend auf `FORCE_SSL`
  - `CSRF_COOKIE_SECURE`: Dynamisch basierend auf `FORCE_SSL`
  - `CSRF_COOKIE_HTTPONLY=True`: Schutz vor XSS-Zugriff
  - `CSRF_COOKIE_SAMESITE`: `'None'` bei HTTPS (mit `FORCE_SSL`), sonst `'Lax'`
  - JWT-Cookies: `httponly=True`, `secure` basierend auf `JWT_COOKIE_SECURE`, `samesite='None'` bei HTTPS, sonst `'Lax'`
- **Security-Header (Django):**
  - `SECURE_BROWSER_XSS_FILTER=True`
  - `SECURE_CONTENT_TYPE_NOSNIFF=True`
  - `SECURE_REFERRER_POLICY='strict-origin-when-cross-origin'`
  - HSTS: `SECURE_HSTS_PRELOAD=True`, `SECURE_HSTS_INCLUDE_SUBDOMAINS=True` (inaktiv bei `DEBUG=True`)
- **Content Security Policy (CSP):**
  - Implementiert via `django-csp` Middleware
  - `default-src 'self'`: Nur eigene Domain erlaubt
  - `script-src 'self'`: JavaScript nur von eigener Domain (kein `unsafe-inline`, kein `unsafe-eval` in Produktion)
  - `img-src 'self' data: blob:`: Bilder von eigener Domain, Data-URLs und Blobs
  - `connect-src`: Dynamisch erweitert um CORS-Origins
  - `object-src 'none'`, `frame-ancestors 'self'`, `form-action 'self'`
  - Nginx-CSP: Doppelte Absicherung auf Reverse-Proxy-Ebene
- **CORS/CSRF:** 
  - Entwicklung: `http://localhost:5173`, `http://127.0.0.1:5173`
  - Produktion: Konfigurierbar via `CORS_ALLOWED_ORIGINS` und `CSRF_TRUSTED_ORIGINS` (nur HTTPS erlaubt)
  - `CORS_ALLOW_CREDENTIALS=True`: Ermöglicht Cookie-basierte Authentication
  - URL-Validierung: Automatische Prüfung, dass CORS/CSRF-Origins nur HTTP für localhost/127.0.0.1 erlauben

## Frontend-Schutzmaßnahmen (React + TypeScript)

- **Technologie-Stack:**
  - React 19 + TypeScript mit Vite Build-Tool
  - Axios für HTTP-Requests mit automatischem Cookie-Handling
  - Zustand für State Management
  - React Hook Form + Zod für Formular-Validierung
- **Sitzungsverwaltung:**
  - Vollständig Cookie-basiert; keine Tokens in `localStorage`/`sessionStorage`
  - `useAuthStore` ruft beim Initialisieren `/api/auth/me/` auf, prüft vorhandene Cookies und steuert Refresh-/Logout-Aufrufe
  - Axios ist mit `withCredentials: true` konfiguriert für automatisches Cookie-Senden
- **Route Guards:** 
  - `ProtectedRoute`: Blockiert unauthentifizierte Zugriffe, leitet zu `/login` weiter
  - `PublicRoute`: Verhindert Login-Seiten-Zugriff mit aktivem Token
- **Form-Validierung:** 
  - Client-seitig: Zod Schemas + React Hook Form
  - Server-seitig: Django REST Framework Serializers als finale Absicherung
- **Build-Konfiguration:**
  - Produktions-Build wird in Docker-Image eingebunden (Multi-Stage Build)
  - Vite optimiert und minimiert alle Assets (Terser für JS-Minification)
  - CSP-konforme Ausgabe (kein `unsafe-inline`, kein `unsafe-eval`)

## Rate Limiting & DDoS-Schutz

EmmaTresor implementiert Rate Limiting auf zwei Ebenen:

### Django REST Framework Throttling
- **Anonym:** 100 Requests/Stunde
- **Authentifiziert:** 1000 Requests/Stunde
- **Spezifische Endpoints:**
  - Login: 5/Minute
  - Registration: 3/Minute
  - Logout: 10/Minute
  - Item Create: 50/Stunde
  - Item Update: 100/Stunde
  - Item Delete: 20/Stunde
  - QR-Code Generation: 30/Minute

### Nginx Rate Limiting (Zusätzliche Absicherung)
- **API allgemein:** 10 req/s mit burst=20
- **Auth-Endpoints:** 5 req/s mit burst=20
- **Registration:** 3 req/s mit burst=10
- Konfiguriert in `nginx/emmatresor.conf` mit `limit_req_zone` Direktiven

## Infrastruktur & Deployment

### Docker-Architektur
- **3-Container-Setup:**
  1. `postgres`: PostgreSQL 16 Alpine mit Health Checks
  2. `backend`: Django/Gunicorn mit Volume Mounts für Media/Static
  3. `nginx`: Reverse Proxy + Frontend Serving (Multi-Stage Build)
- **Volumes:**
  - `postgres_data`: Persistente Datenbank
  - `backend_static`: Django Admin & REST Framework Static Files
  - `backend_media`: Hochgeladene Bilder (ItemImage)
  - `backend_private_media`: Private Dateien (zukünftige Nutzung)
- **Health Checks:**
  - PostgreSQL: `pg_isready` alle 10s
  - Backend: `python manage.py check --deploy` alle 30s
  - Automatisches Neustart bei Fehlern (`restart: unless-stopped`)

### Nginx-Konfiguration (`nginx/emmatresor.conf`)
- **Zusätzliche Security-Header:**
  - `X-Frame-Options: SAMEORIGIN`
  - `X-Content-Type-Options: nosniff`
  - `X-XSS-Protection: 1; mode=block`
  - `Referrer-Policy: strict-origin-when-cross-origin`
- **Datei-Upload Schutz:**
  - Blockiert ausführbare Dateien in `/media/` (PHP, ASP, JSP, Python, etc.)
  - `deny all` für `.env`, `.git`, WordPress-Pfade
- **Caching:**
  - Frontend-Assets: 1 Jahr (immutable)
  - Media Files: 30 Tage
  - HTML: Kein Cache (für Development)
- **Proxy-Timeouts:** 30s für connect/send/read

### Produktions-Setup

1. **Umgebungsvariablen (`.env.production`):**
   - `DEBUG=False`: Deaktiviert Debug-Modus
   - `DJANGO_SECRET_KEY`: Mindestens 50 Zeichen, kryptographisch sicher
   - `DJANGO_FORCE_SSL=1`: Aktiviert Secure-Cookies
   - `DJANGO_ALLOWED_HOSTS`: Komma-separierte Liste erlaubter Domains
   - `ALLOW_USER_REGISTRATION=false`: Deaktiviert öffentliche Registrierung
   - `DB_VENDOR=postgres`: PostgreSQL statt SQLite

2. **Datenbank:**
   - PostgreSQL 16 mit starkem Passwort (`POSTGRES_PASSWORD`)
   - Automatische Health Checks und Dependency Management
   - Backup-Verzeichnis: `./db_backups` gemountet

3. **SSL/TLS:**
   - Empfohlen: Caddy oder Let's Encrypt vor Nginx
   - Nginx hört auf Port 80, externe TLS-Terminierung
   - `SECURE_PROXY_SSL_HEADER` für korrekte HTTPS-Detection

4. **Secrets Management:**
   - Nie `.env` Dateien committen
   - Verwende `env.example` als Template
   - Rotation der `SECRET_KEY` bei Verdacht auf Kompromittierung
   - Automatisches Superuser-Setup: `AUTO_CREATE_SUPERUSER=false` in Produktion

5. **Dependency Management:**
   - Regelmäßige Updates: `npm audit`, `pip-audit`, `npm outdated`, `pip list --outdated`
   - Python: `requirements.txt` mit Version Pinning (z.B. `Django>=5.0.0,<6.0.0`)
   - Frontend: `package-lock.json` für deterministische Builds
   - Wichtige Security-relevante Pakages:
     - `argon2-cffi`: Passwort-Hashing
     - `djangorestframework-simplejwt`: JWT-Authentication
     - `django-csp`: Content Security Policy
     - `django-cors-headers`: CORS-Handling
     - Alle Packages mit bekannten CVEs sofort updaten!

6. **Logging & Monitoring:**
   - Aktivieren von strukturiertem Logging (z.B. `django-structlog`)
   - Sensible Daten (Passwörter, Tokens) nicht protokollieren
   - Nginx Access/Error Logs überwachen
   - PostgreSQL Query-Performance tracken

7. **Tests:**
   - Backend: `python manage.py test`
   - Frontend: `npm run typecheck`
   - Zukünftig: Playwright/Cypress für E2E-Tests

8. **Weiterentwicklung:**
   - MFA/2FA (TOTP)
   - Gerätegebundene Refresh Tokens
   - Audit Logs für alle Item-Änderungen
   - Erweiterte RBAC (Role-Based Access Control)
   - S3-kompatibler Storage für Media Files

## Bekannte Einschränkungen

- **Kein integriertes MFA/2FA**: Multi-Faktor-Authentifizierung ist derzeit nicht implementiert
- **Keine Audit Logs**: Änderungen an Items werden nicht automatisch protokolliert
- **Basis-Zugriffskontrolle**: Alle authentifizierten Benutzer haben gleiche Rechte (keine Rollen)
- **Lokaler Media-Storage**: Bilder werden lokal gespeichert, kein S3/Cloud-Storage integriert
- **Session-Verwaltung**: Keine Übersicht über aktive Sessions pro Benutzer
- **Brute-Force Schutz**: Rate Limiting vorhanden, aber keine automatische Account-Sperrung nach fehlgeschlagenen Login-Versuchen

## Incident Response

### Bei Verdacht auf Kompromittierung:

1. **Token-Invalidierung:**
   - Betroffener Benutzer: Logout über `/api/auth/logout/` → Blacklist des Refresh Tokens
   - Alle Benutzer: Django Admin → Token Blacklist → Massenaktionen
   - Cookies werden client-seitig automatisch gelöscht

2. **Account-Sperrung:**
   - Django Admin: Benutzer deaktivieren (`is_active=False`)
   - Temporär: Passwort zurücksetzen erzwingen (manuell)

3. **Log-Analyse:**
   - Nginx Access Logs: Verdächtige IP-Adressen, ungewöhnliche Request-Patterns
   - Django Logs: Failed Authentication Attempts, 40x/50x Errors
   - PostgreSQL Logs: Ungewöhnliche Query-Patterns

4. **Secret Rotation:**
   - `DJANGO_SECRET_KEY` ändern → Alle Sessions ungültig
   - `POSTGRES_PASSWORD` rotieren
   - JWT-Tokens automatisch ungültig nach Ablauf (max. 7 Tage)

5. **Notfall-Maßnahmen:**
   - Nginx-Regeln: Temporär IPs blocken
   - Docker-Container neustarten: `docker-compose restart`
   - Datenbank-Backup einspielen: `./backup_db.sh`

## Checkliste: Vor dem Go-Live

- [ ] `DEBUG=False` gesetzt
- [ ] `DJANGO_SECRET_KEY` mit 64+ Zeichen kryptographisch sicher generiert
- [ ] `ALLOW_USER_REGISTRATION=false` (außer gewünscht)
- [ ] `DJANGO_ALLOWED_HOSTS` auf Produktions-Domain(s) limitiert
- [ ] `CORS_ALLOWED_ORIGINS` und `CSRF_TRUSTED_ORIGINS` nur HTTPS-URLs
- [ ] PostgreSQL mit starkem Passwort konfiguriert
- [ ] Nginx hinter TLS-Terminierung (Caddy, Let's Encrypt)
- [ ] HSTS Header aktiv (via Caddy oder `SECURE_HSTS_SECONDS`)
- [ ] Automatische Backups konfiguriert (`backup_db.sh` als Cronjob)
- [ ] `.env` Dateien nicht in Git committed
- [ ] Dependencies aktualisiert (`npm audit fix`, `pip-audit`)
- [ ] Health Checks funktionstüchtig (`docker-compose ps`)
- [ ] Logging konfiguriert und getestet
- [ ] Admin-Zugang mit starkem Passwort gesichert
- [ ] Rate Limiting getestet (Nginx + DRF)
- [ ] CSP Header ohne Fehler im Browser (DevTools Console prüfen)

## Kontakt & Responsible Disclosure

**Sicherheitslücken bitte verantwortungsvoll melden:**

1. **Keine öffentliche Offenlegung** vor Behebung
2. **Kontakt:** Erstelle ein Issue auf GitHub mit dem Label `security` (privat) oder kontaktiere die Maintainer direkt
3. **Erwartete Response-Zeit:** 48-72 Stunden
4. **Koordinierte Offenlegung:** Nach Fix und angemessener Update-Zeit (90 Tage Standard)

**Umfang:**
- Code auf GitHub: https://github.com/zerox80/Emma-Tresor
- Offizielle Docker Images (falls vorhanden)
- Dokumentierte Deployment-Methoden

**Ausgeschlossen:**
- Self-Hosted Instanzen mit eigenen Modifikationen
- Social Engineering oder physischer Zugriff
- DDoS-Angriffe
