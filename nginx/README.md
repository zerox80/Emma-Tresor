# 🚀 EmmaTresor Nginx Setup - EINFACH!

## 📁 Nur eine Datei: `nginx/emmatresor.conf`

### 1. Nginx installieren:
```bash
sudo apt install nginx
```

### 2. Konfiguration aktivieren:
```bash
sudo cp nginx/emmatresor.conf /etc/nginx/sites-available/emmatresor
sudo ln -s /etc/nginx/sites-available/emmatresor /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

### 3. Pfade anpassen in `/etc/nginx/sites-available/emmatresor`:

**Für Entwicklung** (Frontend Port 5173):
- Kommentiere AUS: `root /path/to/your/project/frontend/dist;`
- Kommentiere EIN: `proxy_pass http://127.0.0.1:5173;`

**Für Produktion** (gebautes Frontend):
- Kommentiere EIN: `root /path/to/your/project/frontend/dist;`
- Kommentiere AUS: `proxy_pass http://127.0.0.1:5173;`

### 4. Services starten:
```bash
# Backend
python manage.py runserver 0.0.0.0:8000 &

# Frontend (Entwicklung)
cd frontend && npm run dev &

# Nginx läuft bereits
```

## 🌐 URLs:
- `http://localhost/` → Frontend
- `http://localhost/api/` → Backend API
- `http://localhost/admin/` → Django Admin

## ✅ Features:
- ✅ Reverse Proxy für Frontend & Backend
- ✅ Security Headers
- ✅ Rate Limiting
- ✅ Caching
- ✅ HTTPS Support

**Das war's! Eine Datei - alles drin!** 🎉
