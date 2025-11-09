# Sicherheitsübersicht (SECURITY.md)

Dieses Dokument beschreibt die Sicherheitsarchitektur und die implementierten Schutzmaßnahmen der "EmmaTresor"-Anwendung.

## 1. Sicherheitsphilosophie

Das "EmmaTresor"-Projekt wurde nach dem Prinzip **"Security by Design"** entwickelt und weist ein außergewöhnlich hohes professionelles Sicherheitsniveau auf. Anstatt Sicherheit als nachträglichen Einfall zu betrachten, wurden moderne Verteidigungsstrategien ("Defense in Depth") tief in die Architektur integriert, um eine Vielzahl von Angriffsvektoren proaktiv zu adressieren.

Die Architektur ist darauf ausgelegt, Datenintegrität, Vertraulichkeit und Verfügbarkeit auf Anwendungs-, API- und Infrastrukturebene zu gewährleisten.

---

## 2. Backend- & Datenbanksicherheit (Django)

Das Django-Backend implementiert eine robuste Verteidigung gegen gängige Web-Schwachstellen.

* **Strikte Mandantentrennung (Horizontal Privilege Escalation):** Das System stellt durch die Verwendung eines `UserScopedModelViewSet` und validierender Serializer konsequent sicher, dass Benutzer nur ihre eigenen Daten sehen und bearbeiten können. Direkte Objektanfragen (Insecure Direct Object Reference) auf fremde IDs werden auf Datenbankebene blockiert.

* **Schutz vor Stored XSS (Cross-Site Scripting):** Alle Texteingaben, wie z.B. Artikelbeschreibungen, werden serverseitig vor dem Speichern durch `bleach` bereinigt. Dies verhindert, dass bösartiger HTML- oder Skript-Code in der Datenbank gespeichert und für andere Benutzer ausgeführt wird.

* **Schutz vor Timing-Attacks (User Enumeration):** Der `CustomTokenObtainPairSerializer` baut bei fehlerhaften Anmeldeversuchen (ungültiger Benutzer oder falsches Passwort) künstliche Verzögerungen ein. Dies verhindert, dass Angreifer durch Zeitmessung der Serverantwort gültige Benutzernamen erraten können.

* **Schutz vor Decompression Bombs:** Beim Bildupload wird in `inventory/models.py` nicht nur die Dateigröße, sondern auch die tatsächliche Pixelanzahl (`Image.MAX_IMAGE_PIXELS`) geprüft und die Bilddatei mittels `img.load()` validiert. Das verhindert Angriffe, bei denen eine winzige, stark komprimierte Datei (z.B. eine ZIP-Bombe) beim Entpacken den Server-Speicher überlastet.

* **Private Dateianhänge:** Anhänge werden in einem privaten Verzeichnis gespeichert, das nicht öffentlich per URL zugänglich ist (`inventory/storage.py`). Der Abruf erfolgt ausschließlich über eine gesicherte Django-View (`ItemImageDownloadView`), die die Berechtigung des angemeldeten Benutzers prüft.

* **Moderne Passwort-Sicherheit:** Die Anwendung verwendet `Argon2` als Standard-Passwort-Hasher und setzt `django-axes` zur Abwehr von Brute-Force-Angriffen auf das Admin-Interface ein.

---

## 3. Frontend- & API-Sicherheit (React & SPA)

Die Client-Anwendung ist als moderne Single-Page-Application (SPA) konzipiert und implementiert Best Practices für die API-Kommunikation.

* **HttpOnly-Cookie-Authentifizierung:** Die App speichert die Authentifizierungs-Tokens (JWT) in `HttpOnly`-Cookies. Dies ist der Goldstandard für Webanwendungen, da clientseitiges JavaScript (z.B. durch eine XSS-Lücke) diese Tokens nicht auslesen oder stehlen kann.

* **Robuster CSRF-Schutz:** Obwohl es sich um eine tokenbasierte Authentifizierung handelt, wird ein "Double Submit Cookie"-Mechanismus verwendet. Der API-Client (`frontend/src/api/client.ts`) stellt sicher, dass bei jeder zustandsändernden Anfrage (`POST`, `PUT`, `PATCH`, `DELETE`) ein `X-CSRFToken`-Header mitgesendet wird, der serverseitig gegen das `csrftoken`-Cookie geprüft wird.

* **Automatische & sichere Token-Erneuerung:** Ein Axios-Interceptor (`frontend/src/api/authInterceptor.ts`) fängt 401-Fehler (abgelaufenes Token) automatisch ab. Er pausiert alle weiteren Anfragen in einer Warteschlange (`failedQueue`), führt eine einzelne Anfrage zur Token-Erneuerung (Refresh) durch und wiederholt dann die fehlgeschlagenen Anfragen nahtlos, ohne die Benutzererfahrung zu unterbrechen.

---

## 4. Infrastruktur- & Betriebs-Sicherheit (DevOps)

Die Betriebs- und Deployment-Umgebung ist auf Sicherheit und Stabilität ausgelegt.

* **Gehärteter Nginx-Proxy:** Die Nginx-Konfiguration (`nginx/emmatresor.conf`) beinhaltet:
    * **Rate Limiting** (`limit_req_zone`) für API-Endpunkte, um Brute-Force- und Denial-of-Service-Angriffe (DoS) abzuschwächen.
    * Einen expliziten `deny all;`-Block für das `/private_media/`-Verzeichnis, um den direkten Zugriff auf geschützte Dateianhänge zu verhindern.

* **Sicheres Docker-Entrypoint (Privilege Dropping):** Das Start-Skript für den Docker-Container (`docker/backend/entrypoint.sh`) nutzt ein bewährtes Sicherheitsmuster:
    1.  Der Container startet als `root`, um systemwichtige Aufgaben auszuführen (z.B. Warten auf die Datenbank, Ausführen von Migrationen).
    2.  Anschließend übergibt es die Ausführung mittels `exec su appuser -c "..."` an einen unprivilegierten Benutzer (`appuser`), wodurch die Angriffsfläche des laufenden Anwendungsservers minimiert wird.

---

## 5. Meldung von Schwachstellen (Responsible Disclosure)

Wir nehmen die Sicherheit unserer Anwendung ernst. Wenn Sie eine Schwachstelle entdecken, bitten wir Sie, diese verantwortungsvoll offenzulegen.

* **Kontaktadresse:** Sicherheitsrelevante Hinweise bitte an `security@emmatresor.example` senden.
* **PGP-Key:** Für eine verschlüsselte Kommunikation finden Sie unseren öffentlichen Schlüssel unter `docs/pgp/security.asc`.
* **Reaktionszeit:** Wir bemühen uns, innerhalb von 3 Werktagen eine erste Rückmeldung zu geben.

Bitte geben Sie uns eine angemessene Zeitspanne, um die Schwachstelle zu beheben, bevor Sie Informationen darüber veröffentlichen.

---

## 6. Fazit

Das Projekt ist nicht nur "sicher", sondern implementiert eine tiefgreifende, mehrschichtige Verteidigungsstrategie ("Defense in Depth"). Das hohe Sicherheitsbewusstsein der Entwickler wird auch durch die detaillierte Dokumentation in `docs/SECURITY-IMPROVEMENTS.md` deutlich.

Kurz gesagt: Die Architektur dieser Anwendung ist eine der sichersten, die man für ein Projekt dieser Art konzipieren kann, und dient als hervorragendes Beispiel für moderne, sichere Webentwicklung.
