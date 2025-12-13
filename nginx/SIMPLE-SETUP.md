# 🚀 EmmaTresor - EINE Nginx Datei für alles!

## 📁 Die ultimative Nginx-Konfiguration

Ich habe **eine einzige Datei** erstellt, die alles kann:
- ✅ Entwicklung (separate Ports)
- ✅ Produktion (gebautes Frontend)
- ✅ Frontend + Backend Reverse Proxy
- ✅ Security Features
- ✅ Performance Optimierungen
- ✅ Einfache Einrichtung

## 📋 Schnelle Einrichtung:

### 1. Nginx installieren:
```bash
sudo apt install nginx
```

### 2. Eine Datei kopieren:
```bash
# Kopiere die komplette Konfiguration
sudo cp nginx/emmatresor.conf /etc/nginx/sites-available/emmatresor

# Aktiviere sie
sudo ln -s /etc/nginx/sites-available/emmatresor /etc/nginx/sites-enabled/

# Deaktiviere Standard-Site
sudo rm /etc/nginx/sites-enabled/default

# Teste und lade neu
sudo nginx -t && sudo systemctl reload nginx
```

### 3. Anpassen für deine Umgebung:

**FÜR ENTWICKLUNG** (Frontend auf Port 5173):
```nginx
# In /etc/nginx/sites-available/emmatresor
# Kommentiere diese Zeile AUS:
# root /path/to/your/project/frontend/dist;

# Kommentiere diese Zeile EIN:
proxy_pass http://127.0.0.1:5173;
```

**FÜR PRODUKTION** (gebautes Frontend):
```nginx
# Kommentiere diese Zeile EIN:
root /path/to/your/project/frontend/dist;

# Kommentiere diese Zeile AUS:
# proxy_pass http://127.0.0.1:5173;
```

**Pfade anpassen:**
```nginx
# Ersetze diese Pfade mit deinen echten Pfaden:
root /path/to/your/project/frontend/dist;
alias /path/to/your/project/staticfiles/;
alias /path/to/your/project/media/;
```

## 🌐 URLs nach Setup:

- **Hauptseite**: `http://localhost/`
- **API**: `http://localhost/api/`
- **Admin**: `http://localhost/admin/`
- **Direkt Backend**: `http://localhost:8000/`
- **Direkt Frontend**: `http://localhost:5173/` (Entwicklung)

## ⚡ Services starten:

```bash
# Terminal 1 - Django Backend
python backend/manage.py runserver 0.0.0.0:8000

# Terminal 2 - React Frontend (Entwicklung)
cd frontend && npm run dev

# Terminal 3 - Nginx läuft bereits
```

## 🔧 Features:

✅ **Eine Datei** für alles
✅ **Entwicklung & Produktion** in einer Konfiguration
✅ **Frontend & Backend** Reverse Proxy
✅ **Security Headers** (XSS, CSRF, etc.)
✅ **Rate Limiting** für API
✅ **Caching** für Performance
✅ **HTTPS Support** (optional)
✅ **Health Check** für Monitoring
✅ **File Security** (blockiert gefährliche Dateien)

## 📊 Monitoring:

```bash
# Nginx Logs
sudo tail -f /var/log/nginx/access.log

# Health Check
curl http://localhost/health/

# Test API
curl http://localhost/api/
```

## 🎯 Das ist alles!

**Eine Datei** - **alle Features** - **super einfach**! 🚀

Kopiere einfach `nginx/emmatresor.conf` nach `/etc/nginx/sites-available/emmatresor` und passe die Pfade an. Fertig! 🎉
