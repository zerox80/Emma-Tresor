# 📦 EmmaTresor - Modern Inventory Management

<div align="center">
  <img width="1489" height="669" alt="EmmaTresor Dashboard Screenshot" src="https://github.com/user-attachments/assets/bb06fc46-2eef-4ef7-aa99-af33cd00eaa9" />
  
  <p><em>Minimalistische und sichere Inventarverwaltung mit QR-Code-Integration</em></p>
</div>

<div align="center">

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/python-3.12%2B-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![React](https://img.shields.io/badge/react-19-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![Django](https://img.shields.io/badge/django-5.x-092E20?logo=django&logoColor=white)](https://www.djangoproject.com/)
[![TypeScript](https://img.shields.io/badge/typescript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/docker-ready-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)

</div>

---

**EmmaTresor** ist eine moderne, sichere Inventar-Anwendung mit Django REST Framework Backend und React Frontend. Die Anwendung bietet eine vollständige QR-Code-Integration, robuste Authentifizierung und eine skalierbare Architektur für Teams und Einzelprojekte.

## ✨ Hauptmerkmale

- 🔐 **Sicherheit**: Argon2-Hashing, JWT-Authentifizierung, CSRF/CORS-Schutz
- 📱 **QR-Code-Integration**: Automatische Generierung und Scanner-Funktionalität
- 🚀 **Moderne Technologien**: React 19, Django 5, TypeScript, Tailwind CSS
- 🐳 **Docker-Ready**: Vollständige Containerisierung mit Docker Compose
- 📊 **Dashboard**: Übersichtliche Statistiken und Inventarauswertungen
- 🏷️ **Asset-Management**: UUID-basierte Asset-Tags für eindeutige Identifikation

## 📋 Inhaltsverzeichnis

- [🚀 Schnellstart](#-schnellstart)
  - [📦 Setup über Skripte](#-setup-über-skripte)
  - [🔧 Manuelle Einrichtung](#-manuelle-einrichtung)
  - [⚛️ Frontend-Entwicklung](#️-frontend-entwicklung)
- [📱 QR-Code-Integration](#-qr-code-integration)
  - [🏷️ QR-Code generieren](#️-qr-code-generieren)
  - [📸 QR-Code scannen](#-qr-code-scannen)
- [🐳 Docker Deployment](#-docker-deployment)
- [⚙️ Konfiguration](#️-konfiguration)
- [🧪 Tests & Qualitätssicherung](#-tests--qualitätssicherung)
- [📁 Projektstruktur](#-projektstruktur)
- [🔐 Sicherheit](#-sicherheit)
- [🛠️ Troubleshooting](#️-troubleshooting)
- [🗺️ Roadmap](#️-roadmap)
- [🤝 Beitragen](#-beitragen)
- [📄 Lizenz](#-lizenz)

## 📖 Detaillierte Funktionen

### 🏢 Inventarverwaltung
- **CRUD-Operationen** für alle Inventargegenstände
- **Mengen- und Werttracking** mit Kaufdatum und monetärem Wert
- **Standort- und Tag-Management** für bessere Organisation
- **Benutzerspezifische Trennung** der Daten

### 🏷️ QR-Code-System
- **Automatische UUID-Asset-Tags** für jeden Gegenstand
- **Dynamische QR-Code-Generierung** als PNG-Download
- **Integrierter Scanner** mit Kamerazugriff
- **Direkte Bearbeitung** nach dem Scannen

### 📊 Listen und Dashboard
- **Benutzerdefinierte Listen** für Projekte und Übergaben
- **Aggregierte Statistiken** und Wertberechnungen
- **Performance-optimiert** mit Pagination und Suche
- **Responsive Design** für alle Geräte

### 🔒 Sicherheit und Authentifizierung
- **JWT-basierte Authentifizierung** mit SimpleJWT
- **Rate-Limiting** und Logout-Blacklisting
- **CSRF/CORS-Schutz** mit gehärteter Konfiguration
- **Sichere Token-Verwaltung** im Frontend

## 🛠️ Technologie-Stack

<table>
<tr>
<td><strong>🔧 Backend</strong></td>
<td>
<img src="https://img.shields.io/badge/Django-5.x-092E20?logo=django&logoColor=white" alt="Django" />
<img src="https://img.shields.io/badge/DRF-3.x-red?logo=django&logoColor=white" alt="DRF" />
<img src="https://img.shields.io/badge/JWT-SimpleJWT-000000" alt="JWT" />
<img src="https://img.shields.io/badge/Argon2-Hashing-blue" alt="Argon2" />
<img src="https://img.shields.io/badge/QRCode-PIL-green" alt="QRCode" />
</td>
</tr>
<tr>
<td><strong>⚛️ Frontend</strong></td>
<td>
<img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white" alt="React" />
<img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
<img src="https://img.shields.io/badge/Vite-5.x-646CFF?logo=vite&logoColor=white" alt="Vite" />
<img src="https://img.shields.io/badge/Tailwind-3.x-06B6D4?logo=tailwindcss&logoColor=white" alt="Tailwind" />
<img src="https://img.shields.io/badge/Zustand-Store-orange" alt="Zustand" />
</td>
</tr>
<tr>
<td><strong>🐳 DevOps</strong></td>
<td>
<img src="https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white" alt="Docker" />
<img src="https://img.shields.io/badge/Nginx-Proxy-009639?logo=nginx&logoColor=white" alt="Nginx" />
<img src="https://img.shields.io/badge/PostgreSQL-15+-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL" />
<img src="https://img.shields.io/badge/Gunicorn-WSGI-499848" alt="Gunicorn" />
</td>
</tr>
</table>

## 🏗️ Architektur-Übersicht

```mermaid
graph TB
    subgraph "Client Layer"
        U[👤 Benutzer]
        B[🌐 Browser]
    end
    
    subgraph "Frontend Layer"
        R[⚛️ React App<br/>TypeScript + Vite]
        S[📱 QR Scanner<br/>@zxing/browser]
    end
     
    subgraph "Proxy Layer"
        N[Nginx<br/>Reverse Proxy]
    end
     
    subgraph "Backend Layer"
        D[Django + DRF<br/>Python 3.12]
        A[JWT Auth<br/>SimpleJWT]
        Q[QR Generator<br/>qrcode-pil]
    end
    
    subgraph "Data Layer"
        DB[PostgreSQL<br/>Database]
        ST[Static Files<br/>Media Storage]
    end
    
    U --> B
    B --> R
    R --> S
    R --> N
    N --> D
    D --> A
    D --> Q
    D --> DB
    D --> ST
```

### 🔧 Komponentenstruktur

- **`inventory/`** - Django-App mit REST-APIs für Authentifizierung und Inventarverwaltung
- **`frontend/`** - React/Vite-Anwendung mit TypeScript und modernen UI-Komponenten
- **`docker/`** - Container-Konfigurationen für alle Services
- **Nginx** - Reverse Proxy für API-Calls und statische Asset-Bereitstellung

## 🚀 Schnellstart

> 💡 **Tipp**: Für die schnellste Einrichtung verwende die automatisierten Skripte!

### 📦 Setup über Skripte

**📋 Voraussetzungen:**
- 🐍 Python 3.12+
- 📦 Node.js 20+
- 📋 npm
- 🐳 Docker (optional)

#### Windows (PowerShell)
```powershell
# 1️⃣ Backend-Setup (erstellt .venv, installiert deps, führt Migrationen aus)
py -3.12 setup_backend.py --use-venv

# 2️⃣ Starte Backend + Frontend
py -3.12 run_backend.py --use-venv --start-frontend
```

#### Linux/macOS (Bash)
```bash
# 1️⃣ Backend-Setup
python3.12 setup_backend.py --use-venv

# 2️⃣ Starte Backend + Frontend
python3.12 run_backend.py --use-venv --start-frontend
```

**🎯 Ergebnis:**
- 🔧 Django Backend: `http://127.0.0.1:8000/`
- ⚛️ React Frontend: `http://127.0.0.1:5173/`

<details>
<summary>🔧 Virtuelle Umgebung manuell aktivieren</summary>

**Windows:**
```powershell
.\.venv\Scripts\Activate.ps1
```

**Linux/macOS:**
```bash
source .venv/bin/activate
```
</details>

### 🔧 Manuelle Einrichtung

<details>
<summary>📋 Schritt-für-Schritt Anleitung</summary>

#### Backend Setup
```bash
# 1️⃣ Virtuelle Umgebung erstellen
python -m venv .venv

# 2️⃣ Aktivieren (siehe oben)
# Windows: .venv\Scripts\Activate.ps1
# Linux/macOS: source .venv/bin/activate

# 3️⃣ Dependencies installieren
pip install -r requirements.txt

# 4️⃣ Datenbank migrieren
python manage.py migrate

# 5️⃣ Entwicklungsserver starten
python manage.py runserver
```

**✅ Backend läuft auf:** `http://127.0.0.1:8000/`

</details>

### ⚛️ Frontend-Entwicklung

#### Schnellstart
```bash
cd frontend
npm install          # Dependencies installieren
npm run dev          # Dev-Server starten
```

**🌐 Frontend URLs:**
- 🔧 Development: `http://127.0.0.1:5173/`
- 📡 API Proxy: Automatisch zu Django Backend

#### Produktionsbuild
```bash
npm run build        # Build erstellen
npm run preview      # Build testen
npm run typecheck    # TypeScript prüfen
```

> 📱 **QR-Scanner auf mobilen Geräten:** 
> Für HTTPS-Tests verwende `npm run dev -- --host --https` 
> oder nutze einen Reverse Proxy mit TLS-Terminierung.

## 📱 QR-Code-Integration

### 🏷️ QR-Code generieren

```mermaid
sequenceDiagram
    participant U as 👤 Benutzer
    participant F as ⚛️ Frontend
    participant B as 🐍 Backend
    participant Q as 🏷️ QR-Generator
    
    U->>F: Klick auf "QR-Code"
    F->>B: GET /api/inventory/items/{id}/generate_qr_code/
    B->>Q: Generiere QR mit asset_tag (UUID)
    Q->>B: PNG-Datei
    B->>F: QR-Code als Download
    F->>U: Automatischer Download
```

**📋 Schritte:**
1. 📝 **Item auswählen** in der Inventarliste
2. 🏷️ **QR-Code Button** klicken
3. 📥 **PNG herunterladen** für Labels/Etiketten
4. 🖨️ **Ausdrucken** und an Gegenstand anbringen

### 📸 QR-Code scannen

**🎥 Scanner starten:**
- 📷 Klicke "QR-Code scannen" in der Inventarübersicht
- 🗺️ Browser-Kamerazugriff bestätigen
- 🎯 Code mit Kamera erfassen

**⚙️ Automatischer Workflow:**
```
QR-Code erkannt → Asset-Tag extrahiert → Item geladen → Bearbeiten-Modal geöffnet
```

**📝 Direkte Bearbeitung:**
- 📊 Mengen aktualisieren
- 📍 Standorte ändern  
- 🏷️ Tags hinzufügen
- 💰 Werte anpassen

> ⚠️ **Kamera-Hinweise:**
> - 🔒 HTTPS erforderlich (außer localhost)
> - 📱 iOS: Safari oder HTTPS obligatorisch
> - 🖥️ Desktop: localhost funktioniert ohne HTTPS

## 🐳 Docker Deployment

### 🚀 Schnelles Deployment

```bash
# 1️⃣ Umgebungsvariablen konfigurieren
cp env.example .env
# ✏️ .env bearbeiten (siehe Konfiguration)

# 2️⃣ Stack starten
docker compose up --build -d

# 3️⃣ Status prüfen
docker compose ps
```

### 📊 Monitoring & Logs

```bash
# 🔍 Live-Logs anzeigen
docker compose logs -f backend
docker compose logs -f nginx

# 📊 Container-Status
docker compose ps

# 🚯 Stack stoppen
docker compose down

# 🗑️ Volumes löschen (Achtung: Datenverlust!)
docker compose down -v
```

### 🏢 Service-Architektur

| Service | Port | Beschreibung | Volumes |
|---------|------|--------------|----------|
| 🐘 **postgres** | 5432 | PostgreSQL Datenbank | `postgres_data` |
| 🐍 **backend** | 8000 | Django + Gunicorn API | `backend_static`, `backend_media` |
| 🌐 **nginx** | 80 | Reverse Proxy + Frontend | `backend_static`, `backend_media` |

**🌐 Zugriff nach Deployment:**
- Frontend: `http://localhost/`
- API: `http://localhost/api/`
- Admin: `http://localhost/admin/`

## ⚙️ Konfiguration

> 📝 **Basis:** Kopiere `env.example` nach `.env` und passe die Werte an.

### 🔑 Sicherheits-Variablen

| Variable | Beschreibung | ⚠️ Wichtigkeit |
|----------|--------------|----------------|
| `DJANGO_SECRET_KEY` | Django Geheimschlüssel | 🔴 **KRITISCH** |
| `POSTGRES_PASSWORD` | Datenbank-Passwort | 🔴 **KRITISCH** |
| `DJANGO_SUPERUSER_PASSWORD` | Admin-Passwort | 🗽 **HOCH** |

### 🌐 Host & Netzwerk

| Variable | Beschreibung | Standard |
|----------|--------------|----------|
| `DJANGO_ALLOWED_HOSTS` | Erlaubte Hostnamen | `127.0.0.1,localhost` |
| `CSRF_TRUSTED_ORIGINS` | CSRF-Origins | siehe `env.example` |
| `VITE_API_BASE_URL` | Frontend API-Basis | `/api` |

### 📊 Entwicklung & Features

| Variable | Beschreibung | Standard |
|----------|--------------|----------|
| `DJANGO_DEBUG` | Debug-Modus | `True` |
| `ALLOW_USER_REGISTRATION` | Nutzerregistrierung | `false` |
| `AUTO_CREATE_SUPERUSER` | Auto-Admin erstellen | `false` |
| `VITE_ENABLE_QR_SCANNER` | QR-Scanner aktivieren | `true` |

### 📦 Datenbank

| Variable | Beschreibung | Standard |
|----------|--------------|----------|
| `DB_VENDOR` | Datenbank-Typ | `postgres` |
| `POSTGRES_DB` | Datenbank-Name | `emmatresor` |
| `POSTGRES_USER` | DB-Benutzer | `emmatresor` |
| `POSTGRES_HOST` | DB-Host | `localhost` |
| `POSTGRES_PORT` | DB-Port | `5432` |

## 🧪 Tests & Qualitätssicherung

### 🐍 Backend-Tests
```bash
# Django Tests ausführen
python manage.py test

# Mit Coverage (optional)
pip install coverage
coverage run --source='.' manage.py test
coverage report
```

### ⚛️ Frontend-Qualität
```bash
cd frontend

# TypeScript Prüfung
npm run typecheck

# Build-Test
npm run build

# Build-Vorschau
npm run preview
```

### 🔄 CI/CD Empfehlungen
- **GitHub Actions** für automatisierte Tests
- **pytest** für erweiterte Backend-Tests  
- **Jest/Vitest** für Frontend-Unit-Tests
- **Cypress/Playwright** für E2E-Tests

## 📁 Projektstruktur

```text
📁 EmmaTresor/
├── 🐍 EmmaTresor/            # Django Projektkonfiguration
│   ├── settings.py        # ⚙️ Hauptkonfiguration
│   ├── urls.py            # 🌐 URL-Routing
│   └── wsgi.py/asgi.py     # 🚀 Server-Schnittstellen
├── 📦 inventory/             # Backend-App (Kern)
│   ├── models.py          # 📊 Datenmodelle
│   ├── views.py           # 🔌 API-Endpunkte
│   ├── serializers.py     # 🔄 JSON-Serialisierung
│   └── urls.py            # 🌐 App-URLs
├── ⚛️ frontend/              # React/Vite Frontend
│   ├── src/
│   │   ├── components/    # 🧩 UI-Komponenten
│   │   ├── pages/         # 📱 Seiten-Komponenten
│   │   ├── api/           # 📡 API-Client
│   │   └── store/         # 💾 Zustand-Management
│   ├── package.json       # 📦 Dependencies
│   └── vite.config.ts     # ⚙️ Vite-Konfiguration
├── 🐳 docker/                # Container-Setup
│   ├── backend/Dockerfile # 🐍 Backend-Image
│   ├── frontend/Dockerfile# ⚛️ Frontend-Image
│   └── nginx/Dockerfile   # 🌐 Proxy-Image
├── 📄 docs/                  # Dokumentation
│   └── SECURITY.md        # 🔐 Sicherheitshinweise
├── 🚀 Setup & Scripts
│   ├── setup_backend.py   # 🔧 Auto-Setup
│   ├── run_backend.py     # ▶️ Dev-Server
│   └── manage.py          # 🐍 Django CLI
└── 📄 Konfiguration
    ├── requirements.txt   # 🐍 Python-Deps
    ├── docker-compose.yml # 🐳 Services
    └── env.example        # ⚙️ Umgebungsvariablen
```

## 🔐 Sicherheit

### 🔑 Authentifizierung & Autorisierung
- **💪 Argon2-Hashing** für Passwörter (state-of-the-art)
- **🎩 JWT-Token** mit SimpleJWT und Refresh-Mechanismus
- **🚪 Rate-Limiting** für Login-Versuche
- **🚫 Logout-Blacklisting** verhindert Token-Wiederverwendung

### 🌐 Web-Sicherheit
- **🍪 Secure Cookies** (HttpOnly, Secure, SameSite)
- **🔒 CSP-Header** (Content Security Policy)
- **🔐 HSTS** für HTTPS-Erzwingung (Produktion)
- **🚫 CORS-Schutz** mit restriktiven Origins

### 🛡️ Frontend-Schutz
- **🔑 Token-Storage** in sicherem Local Storage
- **🚪 Route Guards** (`ProtectedRoute`, `PublicRoute`)
- **✅ Form-Validation** mit Zod + React Hook Form
- **🔄 Auto-Logout** bei Token-Ablauf

### 📊 Backend-Validierung
- **🏷️ Input-Sanitization** für alle API-Endpunkte
- **📝 Schema-Validation** mit DRF-Serializers
- **🚫 SQL-Injection-Schutz** durch Django ORM

> 📜 **Weitere Details:** Siehe `docs/SECURITY.md` für umfassende Sicherheitsrichtlinien.

## 🔧 Troubleshooting

### 📷 QR-Scanner Probleme

| Problem | Lösung |
|---------|--------|
| 🚫 **Kamera-Zugriff verweigert** | ✅ HTTPS verwenden oder localhost nutzen<br/>✅ Browser-Berechtigung erteilen<br/>✅ Systemeinstellungen prüfen (Windows: Datenschutz → Kamera) |
| 🔍 **Scanner findet Item nicht** | ✅ QR-Code muss gültigen `asset_tag` (UUID) enthalten<br/>✅ Neue Labels über Item-Ansicht generieren |
| 📥 **QR-Code Download fehlgeschlagen** | ✅ Erneut einloggen (JWT-Token erneuern)<br/>✅ Browser-Cache leeren |

### 🐍 Backend-Probleme

| Problem | Lösung |
|---------|--------|
| 📦 **qrcode[pil] fehlt** | `pip install -r requirements.txt` ausführen |
| 📊 **Migrationen fehlgeschlagen** | `python manage.py migrate --run-syncdb` |
| 🔑 **Authentifizierung-Fehler** | `.env`-Datei prüfen, `DJANGO_SECRET_KEY` setzen |

### ⚛️ Frontend-Probleme

| Problem | Lösung |
|---------|--------|
| 📡 **API-Verbindung fehlgeschlagen** | Backend-Server läuft auf Port 8000? |
| 🔄 **Build-Fehler** | `npm run typecheck` ausführen |
| 📏 **Routing-Probleme** | Browser-Cache leeren, Hard-Refresh |

## 🗺️ Roadmap

### 🔜 **Kurzfristig (Q1 2025)**
- 📋 **Drag & Drop** für Listen-Management
- 📥 **Bulk-Import** für CSV/Excel-Dateien
- 📱 **Mobile-optimierter** QR-Scanner
- 🖼️ **Item-Detailseiten** mit Bildergalerie

### 🔝 **Mittelfristig (Q2-Q3 2025)**
- 🧪 **Test-Suites** (pytest, Jest, Cypress)
- 🔄 **CI/CD-Pipeline** mit GitHub Actions
- 📈 **Analytics-Dashboard** mit erweiterten Metriken
- 📱 **PWA-Support** für Offline-Nutzung

### 🔞 **Langfristig (Q4 2025+)**
- 🔐 **SECRET_KEY-Rotation** und erweiterte Sicherheit
- 🌐 **Multi-Tenant-Support** für Teams
- ☁️ **Cloud-Storage** (S3/MinIO) für Medien
- 📄 **OpenAPI-Dokumentation** mit DRF Spectacular

## 🤝 Beitragen

Beiträge sind herzlich willkommen! 🎉

### 📝 Contribution Guidelines

1. **🌴 Fork & Branch**
   ```bash
   git fork https://github.com/your-repo/EmmaTresor
   git checkout -b feature/awesome-feature
   ```

2. **🧪 Tests ausführen**
   ```bash
   # Backend
   python manage.py test
   
   # Frontend  
   cd frontend
   npm run typecheck
   npm run build
   ```

3. **✏️ Commit-Standards**
   - 🌟 Verwendung von [Conventional Commits](https://conventionalcommits.org/)
   - 🗺️ Klare, beschreibende Commit-Messages
   - 📈 Ein Feature = Ein Commit (squash wenn nötig)

4. **🚀 Pull Request**
   - 📋 Detaillierte Beschreibung der Änderungen
   - 🖼️ Screenshots bei UI-Änderungen
   - ✅ Alle Tests bestehen

### 🐛 Bug Reports & Feature Requests

- **🐛 Bugs:** [Issues](https://github.com/your-repo/EmmaTresor/issues) mit "bug" Label
- **✨ Features:** [Issues](https://github.com/your-repo/EmmaTresor/issues) mit "enhancement" Label
- **💬 Diskussionen:** [GitHub Discussions](https://github.com/your-repo/EmmaTresor/discussions)

### 🚀 Entwicklungsstandards

- **🐍 Backend:** Django Best Practices, PEP 8
- **⚛️ Frontend:** TypeScript strict mode, ESLint + Prettier
- **📄 Dokumentation:** Inline-Kommentare + README-Updates
- **🔐 Sicherheit:** Keine Secrets in Commits!

---

## 📄 Lizenz

Dieses Projekt steht unter der **GNU General Public License Version 3.0** (GPL-v3).

© 2024 EmmaTresor Contributors

**📜 [Vollständiger Lizenztext](LICENSE)**

---

<div align="center">
  <p>
    <strong>🚀 Erstellt mit ❤️ von der EmmaTresor Community</strong>
  </p>
  <p>
    <a href="#-emmatresor---modern-inventory-management">⬆️ Zurück nach oben</a>
  </p>
</div>

