# EmmaTresor

<img width="1250" height="587" alt="image" src="https://github.com/user-attachments/assets/850fa988-28d1-408a-ab55-93a829ad50ec" />

EmmaTresor ist ein sicheres, mandantenfähiges Inventar- und Asset-Management-System auf Basis von Django (Backend) und React/Vite (Frontend). Es verwaltet Gegenstände, Dateien und Bilder mit strenger Trennung pro Benutzerkonto.

## Funktionen

- Inventarisierung mit Tags, Standorten und Zuständen  
- Vollständige Änderungsprotokolle (Audit Trail)  
- Sichere Dateispeicherung über privaten Storage  
- QR-Code-Unterstützung für Assets  
- Moderne, responsive Weboberfläche

## Entwicklung – Schnellstart

1. Virtuelle Umgebung anlegen und aktivieren: `python -m venv .venv`, dann `pip install -r requirements.txt`.  
2. Beispielkonfiguration kopieren: `cp env.example .env` und Werte anpassen.  
3. Datenbank migrieren: `python manage.py migrate`.  
4. Backend starten: `python manage.py runserver`.  
5. Frontend installieren und starten:  
   - `cd frontend`  
   - `npm install`  
   - `npm run dev`

## Deployment

Für den Produktivbetrieb stehen Docker-Setups mit `docker-compose.yml` (Backend, Frontend, Nginx) bereit. Details zu API, Sicherheit und Fehlersuche befinden sich im Ordner `docs/`.

