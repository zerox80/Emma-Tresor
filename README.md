# EmmaTresor Inventory

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)
[![Python 3.12](https://img.shields.io/badge/python-3.12%2B-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![React 19](https://img.shields.io/badge/react-19-61DAFB?logo=react&logoColor=white)](https://react.dev/)

EmmaTresor ist eine minimalistische, sichere Inventar-Anwendung mit einem Django REST Backend und einem modernen React-Frontend. Der Fokus liegt auf robuster Authentifizierung, solider Sicherheitskonfiguration, einem vollständigen QR-Code-Workflow und einer einfach erweiterbaren Architektur für Team- und Einzelprojekte.

## Inhaltsverzeichnis

- [Überblick](#überblick)
- [Highlights](#highlights)
- [Funktionen](#funktionen)
- [Technologien](#technologien)
- [Architektur](#architektur)
- [Schnellstart](#schnellstart)
  - [Setup über Skripte](#setup-über-skripte)
  - [Manuelle Einrichtung](#manuelle-einrichtung)
  - [Frontend-Entwicklung](#frontend-entwicklung)
- [QR-Workflows](#qr-workflows)
- [Docker-Compose Deployment](#docker-compose-deployment)
- [Konfiguration](#konfiguration)
- [Tests & Qualitätssicherung](#tests--qualitätssicherung)
- [Projektstruktur](#projektstruktur)
- [Sicherheit](#sicherheit)
- [Troubleshooting](#troubleshooting)
- [Roadmap](#roadmap)
- [Beitragen](#beitragen)
- [Lizenz](#lizenz)

## Überblick

EmmaTresor hilft Teams, Inventar und Assets zentral zu verwalten. Die Plattform ist auf zuverlässige Authentifizierung, rollenbasierte Erweiterbarkeit und einen klaren Technologie-Stack ausgelegt. Ziel ist eine stabile Grundlage, die sowohl lokal als auch containerisiert schnell lauffähig ist.

## Highlights

- **Ende-zu-Ende QR-Codes** mit automatischen UUID-Asset-Tags, dynamischer QR-Code-Generierung (`inventory/views.py`) und integriertem Scanner im Frontend (`frontend/src/pages/ItemsPage.tsx`).
- **Sicherheitsfokus** mit Argon2-Hashing, strengen Cookie- und CSP-Einstellungen sowie CSRF/CORS-Härtung.
- **Token-basierte Authentifizierung** via `djangorestframework-simplejwt` mit erweitertem Logout und Metadaten.
- **Moderne Frontend-Experience** mit React 19, Zustand, React Hook Form und Zod für valide Formulare.
- **Nahtlose Entwicklungs-Workflows** dank Setup-/Run-Skripten, Vite-Dev-Server und automatisierten Collectstatic-Prozessen.
- **Docker-First Deployment** für Backend, Frontend, Postgres und Nginx via `docker compose`.

## Funktionen

- **Inventarverwaltung:** CRUD für Gegenstände inklusive Mengen, Kaufdatum, monetärem Wert sowie Standorten und Tags. Alle Einträge sind pro Benutzer gekapselt (`inventory/models.py`).
- **QR-Codes:** Jedes Item erhält automatisch einen stabilen `asset_tag` (UUID). QR-Codes lassen sich per Klick generieren und herunterladen (`fetchItemQrCode()`), Scanner-Ergebnisse öffnen die Bearbeitung direkt.
- **Listen & Dashboard:** Benutzerdefinierte Listen gruppieren Items für Projekte oder Übergaben (`frontend/src/pages/ListsPage.tsx`). Das Dashboard aggregiert Kennzahlen und Wertberechnungen (`frontend/src/pages/DashboardPage.tsx`).
- **Sicherheit & Auth:** SimpleJWT-Login mit Rate-Limits, Logout-Blacklisting und gehärteter CSRF/CORS-Konfiguration (`inventory/views.py`, `EmmaTresor/settings.py`).
- **Performance & UX:** Debouncte Suche, Pagination (20 Items pro Seite), informative Fehlermeldungen und modale Dialoge sorgen für eine reibungslose Nutzung (`frontend/src/pages/ItemsPage.tsx`).

## Technologien

- **Backend:** Django 5, Django REST Framework, SimpleJWT, Argon2, qrcode[pil], Gunicorn
- **Frontend:** React 19, Vite, TypeScript, Tailwind (PostCSS), Zustand, React Router, React Hook Form, Zod, `@yudiel/react-qr-scanner`, `@zxing/browser`
- **DevOps:** Docker, Docker Compose, Nginx, PostgreSQL, python-dotenv

## Architektur

- `inventory/` stellt die zentrale Django-App mit API-Endpunkten für Authentifizierung und Inventarverwaltung bereit.
- `frontend/` enthält den Vite/React-Code mit modularen Komponenten, Hooks und Stores.
- Das Deployment trennt statische Assets (`backend_static`, `backend_media`) und nutzt Nginx als Reverse Proxy für `/api/*` und als Asset-Server.
- Sicherheitsrelevante Einstellungen liegen in `EmmaTresor/settings.py`, zusätzliche Hinweise unter `docs/SECURITY.md`.

## Schnellstart

### Setup über Skripte

**Voraussetzungen:** Python 3.12, Node 20+, npm, (optional) Docker.

- **Windows (PowerShell):**
  ```powershell
  py -3.12 setup_backend.py --use-venv
  py -3.12 run_backend.py --use-venv --start-frontend
  ```
- **Linux/macOS (Bash):**
  ```bash
  python3.12 setup_backend.py --use-venv
  python3.12 run_backend.py --use-venv --start-frontend
  ```

Der erste Befehl erstellt `.venv/`, installiert Abhängigkeiten, führt Migrationen aus und optional Tests. Der zweite startet den Django-Server unter `http://127.0.0.1:8000/` und – bei `--start-frontend` – den Vite-Dev-Server unter `http://127.0.0.1:5173/`.

Virtuelle Umgebung manuell aktivieren:

- **Windows:** `\.venv\Scripts\Activate.ps1`
- **Linux/macOS:** `source .venv/bin/activate`

### Manuelle Einrichtung

1. Virtuelle Umgebung erzeugen: `python -m venv .venv`
2. Aktivieren (siehe oben)
3. Abhängigkeiten installieren: `pip install -r requirements.txt`
4. Migrationen ausführen: `python manage.py migrate`
5. Entwicklungsserver starten: `python manage.py runserver`

Die API ist anschließend unter `http://127.0.0.1:8000/` erreichbar.

### Frontend-Entwicklung

1. Abhängigkeiten installieren:
   ```bash
   cd frontend
   npm install
   ```
2. Entwicklungsserver starten:
   ```bash
   npm run dev
   ```
   Der Vite-Dev-Server läuft unter `http://127.0.0.1:5173/` und proxyt API-Calls an das Django-Backend.
3. Produktionsbuild erstellen:
   ```bash
   npm run build
   npm run preview
   ```
4. Für mobile Tests des QR-Scanners über HTTPS arbeiten (z. B. `npm run dev -- --host --https`) oder die App über einen Reverse Proxy mit TLS bereitstellen. Desktop-Browser akzeptieren Kamera-Zugriffe auch auf `localhost`.

## QR-Workflows

### QR-Code generieren

1. **Item-Liste öffnen:** Navigiere zu `Inventar` → `QR-Code` neben dem gewünschten Eintrag (`frontend/src/pages/ItemsPage.tsx`).
2. **Code erzeugen:** EmmaTresor ruft `inventory/views.py::ItemViewSet.generate_qr_code` auf und liefert ein PNG mit dem `asset_tag`.
3. **Weiterverwenden:** Lade den Code als Label herunter oder drucke ihn direkt aus, um Gegenstände vor Ort zu markieren.

### QR-Code scannen

1. **Scanner starten:** Klicke auf `QR-Code scannen` in der Inventarübersicht. Der integrierte `QrScanner` nutzt `@zxing/browser`, um Kamerastreams auszulesen.
2. **Code erfassen:** Richte die Kamera auf den Code. Nach erfolgreichem Scan wird `fetchItemByAssetTag()` aufgerufen, das Item geladen und automatisch im Bearbeiten-Modal geöffnet.
3. **Bearbeiten oder prüfen:** Aktualisiere Mengen, Standorte oder Tags unmittelbar – ideal für Inventuren und Wareneingänge.

> **Hinweis:** Kamerazugriff muss vom Browser bestätigt werden. Auf iOS funktioniert der Scanner nur über HTTPS oder Safari auf `localhost` via USB.

## Docker-Compose Deployment

1. `.env` auf Basis der Vorlage erzeugen:
   ```bash
   cp env.example .env
   ```
2. Wichtige Variablen wie `DJANGO_SECRET_KEY`, `POSTGRES_PASSWORD` und `DJANGO_ALLOWED_HOSTS` setzen.
3. Stack starten:
   ```bash
   docker compose up --build -d
   ```
4. Status & Logs prüfen:
   ```bash
   docker compose ps
   docker compose logs -f backend
   ```
5. Statische Dateien landen via `collectstatic` im Volume `backend_static`; Medien-Dateien werden in `backend_media` persistiert.
6. Stack stoppen:
   ```bash
   docker compose down
   ```

Services im Compose-Stack:

- **postgres** – persistente PostgreSQL-Datenbank
- **backend** – Django + Gunicorn, liefert API & `collectstatic`
- **nginx** – Reverse Proxy, dient das gebaute Frontend aus `/usr/share/nginx/html`

## Konfiguration

Alle Umgebungsvariablen können über `.env` gepflegt werden. Die Vorlage `env.example` enthält empfohlene Defaults.

| Variable | Beschreibung | Standard |
| --- | --- | --- |
| `DJANGO_DEBUG` | Debug-Flag für Django | `True` |
| `DJANGO_ALLOWED_HOSTS` | Komma-separierte Hostnamen | `127.0.0.1,localhost,nginx,backend` |
| `CSRF_TRUSTED_ORIGINS` | Vertrauenswürdige Origins für CSRF | wie in `env.example` |
| `DJANGO_SECRET_KEY` | Geheimschlüssel (unbedingt setzen!) | `your-secret-key-here` |
| `ALLOW_USER_REGISTRATION` | Registrierungen erlauben | `false` |
| `DB_VENDOR` | Datenbank-Backend (`postgres`) | `postgres` |
| `POSTGRES_*` | Datenbank-Credentials & Host | siehe Vorlage |
| `AUTO_CREATE_SUPERUSER` | Automatische Superuser-Erstellung | `false` |
| `DJANGO_SUPERUSER_*` | Superuser-Zugangsdaten | siehe Vorlage |
| `VITE_API_BASE_URL` | API-Basis im Frontend | `/api` |
| `EMMATRESOR_FRONTEND_LOGIN_URL` | Login-URL hinter Proxy | `http://localhost:5173/login` |
| `VITE_ENABLE_QR_SCANNER` | Feature-Flag für den integrierten Scanner (optional, via Vite Env) | nicht gesetzt/`true` |

Weitere Details: `run_backend.py`, `setup_backend.py` und `docker/backend/entrypoint.sh` nutzen diese Variablen beim Start.

## Tests & Qualitätssicherung

- **Backend-Tests:**
  ```bash
  python manage.py test
  ```
- **Frontend-Typecheck:**
  ```bash
  cd frontend
  npm run typecheck
  ```
- **Frontend-Build:**
  ```bash
  npm run build
  ```

Empfohlen: pytest/Jest/Cypress ergänzen (siehe Roadmap) und Continuous Integration konfigurieren.

## Projektstruktur

```text
EmmaTresor/
├── EmmaTresor/            # Django Projektkonfiguration
├── inventory/             # Backend-App inkl. API & Auth
├── frontend/              # React/Vite Frontend
├── docker/                # Compose/Dockerfiles für backend, frontend, nginx
├── nginx/                 # Nginx-Konfigurationen für Deployment
├── docs/                  # Zusätzliche Dokumentation (z. B. SECURITY.md)
├── manage.py              # Django CLI Entry
├── run_backend.py         # Entwicklungsstart (Backend/Frontend)
├── setup_backend.py       # Setup-Skript (venv, Dependencies, Migrationen)
└── requirements.txt       # Python-Abhängigkeiten
```

## Sicherheit

- **Passwörter:** `Argon2PasswordHasher` mit Fallback-Hashing in `EmmaTresor/settings.py`.
- **Cookies & Header:** Secure/HttpOnly/Samesite-Flags, `django-csp`, HSTS und HTTPS-Redirect, sobald `DEBUG=False`.
- **CORS & CSRF:** Restriktive Allowed Hosts/Origins, `CORS_ALLOW_CREDENTIALS=True`, passende CSRF Trusted Origins.
- **Auth-Endpoints:** Erweiterte Token-Response & Logout-Mechanismus in `inventory/views.py` und `inventory/urls.py`.
- **Frontend-Schutz:** Token-Verwaltung in `frontend/src/utils/tokenStorage.ts` und `frontend/src/store/authStore.ts`, Guarded Routes (`ProtectedRoute`, `PublicRoute`).
- **Validierung:** Formulare durch Zod + React Hook Form, Backend-Validierung für Tags/Locations.

Ausführliche Informationen befinden sich in `docs/SECURITY.md`.

## Troubleshooting

- **Kamera-Zugriff verweigert:** Stelle sicher, dass der Browser HTTPS verwendet oder `localhost` ist, und erlaube den Kamerazugriff explizit. Prüfe außerdem Systemeinstellungen (Windows: Datenschutz → Kamera).
- **Scanner findet Item nicht:** Der QR-Code muss einen gültigen `asset_tag` (UUID) enthalten. Bei älteren Codes neue Labels über die Item-Ansicht generieren.
- **QR-Code Download schlägt fehl:** Authentifiziere dich erneut – der Download erfordert ein gültiges JWT. Bei 401-Fehlern hilft ein erneutes Einloggen im Frontend.
- **qrcode[pil] fehlt im Backend:** Stelle sicher, dass `pip install -r requirements.txt` ausgeführt wurde. Ohne die Bibliothek gibt der Endpoint `503` zurück.

## Roadmap

- **Frontend:** Drag & Drop für Listen, Bulk-Importe, mobile-optimierter Scanner, Item-Detailseiten
- **Tests:** Pytest-/Jest-/Cypress-Suites einführen und CI-Pipeline aufsetzen
- **Deployment:** SECRET_KEY-Rotation, HTTPS-Termination, S3/MinIO für Medien, Rate Limiting
- **Dokumentation:** OpenAPI/DRF Spectacular integrieren, API-Dokumentation veröffentlichen

## Beitragen

Beiträge sind willkommen. Bitte vor Pull Requests:

1. Forken und Feature-Branch erstellen
2. Tests und Typechecks lokal ausführen (`python manage.py test`, `npm run typecheck`)
3. Klar dokumentierte Commits verfassen
4. Pull Request mit Beschreibung & Screenshots (falls UI) erstellen

Für Vorschläge oder Bugreports gerne Issues öffnen.

## Lizenz

Dieses Projekt steht unter der **GNU General Public License Version 3.0**. Details siehe [LICENSE](LICENSE).

