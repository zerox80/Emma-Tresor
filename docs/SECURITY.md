# Sicherheitsleitfaden für EmmaTresor

Dieser Leitfaden fasst die wichtigsten Sicherheitsmaßnahmen und empfohlenen Betriebsrichtlinien für EmmaTresor zusammen.

## Authentifizierung & Autorisierung

- **Passworthashing:** Django verwendet den `Argon2PasswordHasher`. Bei der Migration bestehender Installationen werden Passwörter beim nächsten Login automatisch auf Argon2 aktualisiert.
- **JWT-Konfiguration:**
  - Access-Token Gültigkeit: 5 Minuten.
  - Refresh-Token Gültigkeit: 7 Tage, inklusive Rotation & Blacklisting (`ROTATE_REFRESH_TOKENS=True`, `BLACKLIST_AFTER_ROTATION=True`).
  - Logout-Endpoint (`POST /api/auth/logout/`) invalidiert Refresh Tokens.
- **Benutzerregistrierung:** `UserRegistrationViewSet` limitiert HTTP-Methoden auf `POST` und validiert Passwörter serverseitig.

## Transport- & Sitzungs-Sicherheit

- **Cookies:**
  - `SESSION_COOKIE_SECURE=True`
  - `CSRF_COOKIE_SECURE=True`
  - `CSRF_COOKIE_HTTPONLY=True`
  - `CSRF_COOKIE_SAMESITE='Lax'`
- **Security-Header:** XSS-Filter, No-Sniff, HSTS (aktiv bei `DEBUG=False`) und HTTPS-Redirect.
- **CORS/CSRF:** Nur `http://localhost:5173` & `http://127.0.0.1:5173` als erlaubte Ursprünge in der Entwicklung; `CORS_ALLOW_CREDENTIALS=True`.

## Frontend-Schutzmaßnahmen

- **Token-Storage:**
  - Access-/Refresh-Token werden in `localStorage` nur gespeichert, wenn `rememberMe` aktiv ist.
  - SessionStorage spiegelt Tokens, um Kurzzeit-Sitzungen zu unterstützen (`src/utils/tokenStorage.ts`).
  - `useAuthStore` erzwingt Dekodierung & Plausibilitätsprüfung der JWTs und versucht beim Initialisieren automatisch ein Refresh.
- **Route Guards:** `ProtectedRoute` blockiert unauthentifizierte Zugriffe; `PublicRoute` verhindert Logins mit aktivem Token.
- **Form-Validierung:** Zod + React Hook Form stellen sicher, dass Eingaben (z. B. Passwörter, Tags, Standorte) serverseitig erwarteten Policies entsprechen.

## Betriebsempfehlungen

1. **Produktions-Setup:**
   - `DEBUG=False`, starke `SECRET_KEY`, HTTPS, Reverse-Proxy (Nginx/Caddy) mit HSTS, HTTP/2.
   - PostgreSQL als Datenbank, optional S3-kompatibler Storage für Bilder (`ItemImage`).
   - Automatisierte Backups und Rotationen der Secrets.
2. **Rate Limiting & Monitoring:** Einsatz von `django-ratelimit` oder API-Gateway (z. B. Nginx, Traefik) für Schutz vor Brute-Force.
3. **Logging:** Aktivieren von strukturiertem Logging, z. B. mit `django-structlog`. Sensible Daten nicht protokollieren.
4. **Content Security Policy:** Für Produktion CSP-Header definieren (z. B. via `django-csp`).
5. **Dependency Management:** Regelmäßige Sicherheitsupdates (npm audit, pip-audit) durchführen.
6. **Tests:**
   - Backend: `python manage.py test`
   - Frontend: `npm run typecheck`, später Jest/Playwright/Cypress integrieren.
7. **Weiterentwicklung:** MFA/2FA, gerätegebundene Refresh Tokens, Audit Logs, rollenbasierte Zugriffe.

## Incident Response

- Refresh Tokens können bei Verdacht auf Kompromittierung über den Logout-Endpoint invalidiert werden.
- Tokens in Browser-Speicherung werden nach Logout/Fehlerbereinigungen automatisch entfernt.
- Verwende Log-Analyse, um unübliche Anmeldeversuche zu identifizieren; sperre betroffene Accounts temporär.

## Kontakt

Bitte Sicherheitslücken verantwortungsvoll melden (Responsible Disclosure). Adresse und Verfahren sollten vor öffentlicher Veröffentlichung definiert werden.
