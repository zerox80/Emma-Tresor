# EmmaTresor Frontend Dokumentation
# ==================================
# Vollständige Übersicht der Frontend-Architektur und aller Komponenten

## Architekturübersicht

Das EmmaTresor Frontend ist eine moderne React-Anwendung mit TypeScript, die folgende Technologien nutzt:

- **React 18** - UI-Framework mit Hooks
- **TypeScript** - Typsichere Entwicklung
- **React Router** - Client-seitiges Routing
- **Zustand** - State Management mit Persistence
- **Axios** - HTTP-Client für API-Kommunikation
- **React Hook Form** - Formular-Management
- **Zod** - Schema-Validierung
- **Tailwind CSS** - Utility-First CSS Framework

## Verzeichnisstruktur

```
frontend/src/
├── api/                    # API-Client und HTTP-Logik
│   ├── client.ts          # Axios-Konfiguration mit CSRF
│   ├── authInterceptor.ts # Auto-Token-Refresh
│   └── inventory.ts       # Alle Inventory-API-Funktionen
│
├── components/            # React-Komponenten
│   ├── common/           # Wiederverwendbare UI-Komponenten
│   │   ├── Button.tsx
│   │   └── LoadingScreen.tsx
│   ├── items/            # Item-spezifische Komponenten
│   │   ├── ItemsGrid.tsx
│   │   ├── ItemsTable.tsx
│   │   ├── FilterSection.tsx
│   │   ├── SelectionToolbar.tsx
│   │   └── StatisticsCards.tsx
│   ├── layout/           # Layout-Komponenten
│   │   ├── AppLayout.tsx
│   │   └── AuthLayout.tsx
│   ├── AddItemDialog.tsx
│   ├── EditItemForm.tsx
│   ├── ItemDetailView.tsx
│   ├── ItemChangeHistory.tsx
│   ├── ItemScanView.tsx
│   ├── AssignToListSheet.tsx
│   └── ListItemsPreviewSheet.tsx
│
├── hooks/                 # Custom React Hooks
│   ├── useAuth.ts        # Authentication Hook
│   └── useDebouncedValue.ts # Debouncing Hook
│
├── pages/                 # Seiten-Komponenten (Routen)
│   ├── DashboardPage.tsx
│   ├── ItemsPage.tsx
│   ├── LoginPage.tsx
│   ├── RegisterPage.tsx
│   ├── ScanItemPage.tsx
│   ├── ListsPage.tsx
│   └── SettingsPage.tsx
│
├── routes/                # Route Guards
│   ├── ProtectedRoute.tsx # Authentifizierung erforderlich
│   └── PublicRoute.tsx    # Nur für nicht-authentifizierte Nutzer
│
├── store/                 # State Management
│   └── authStore.ts      # Zustand Store für Authentication
│
├── types/                 # TypeScript Type Definitions
│   ├── auth.ts           # Auth-Typen
│   └── inventory.ts      # Inventory-Typen
│
├── App.tsx               # Haupt-App-Komponente mit Routing
├── main.tsx              # Einstiegspunkt
└── index.css             # Globale Styles
```

## Vollständig kommentierte Dateien

### ✅ API Layer (100% kommentiert)
- `api/client.ts` - Axios HTTP-Client mit CSRF-Token-Handling
- `api/authInterceptor.ts` - Automatisches JWT-Token-Refresh-System
- `api/inventory.ts` - Alle API-Funktionen für Items, Tags, Locations, Lists

### ✅ State Management (100% kommentiert)
- `store/authStore.ts` - Zustand Store mit Login, Logout, Token-Refresh
- `hooks/useAuth.ts` - Auth-State-Hook für Komponenten
- `hooks/useDebouncedValue.ts` - Debouncing für Performance-Optimierung

### ✅ Core Application (100% kommentiert)
- `main.tsx` - App-Initialisierung mit Auth-Interceptor-Setup
- `App.tsx` - React Router Konfiguration

### ✅ Routes & Guards (100% kommentiert)
- `routes/ProtectedRoute.tsx` - Route-Guard für authentifizierte Nutzer
- `routes/PublicRoute.tsx` - Route-Guard für Login/Register

### ✅ Pages (Teilweise kommentiert)
- `pages/LoginPage.tsx` - Login-Formular mit Validierung

## Komponenten-Katalog

### Common Components

#### Button.tsx
```typescript
// Wiederverwendbare Button-Komponente mit Varianten
// - Varianten: primary, secondary, danger, ghost
// - Größen: sm, md, lg
// - Loading-State mit Spinner
// - Full TypeScript Support
```

#### LoadingScreen.tsx
```typescript
// Vollbild-Ladebildschirm
// - Zeigt EmmaTresor Logo
// - Animierter Spinner
// - Wird bei Auth-Initialisierung verwendet
```

### Layout Components

#### AppLayout.tsx
```typescript
// Haupt-Layout für authentifizierte Seiten
// - Navigation Sidebar
// - Header mit User-Menu
// - Content-Bereich mit Outlet
// - Responsive Design
```

#### AuthLayout.tsx
```typescript
// Layout für Login/Register-Seiten
// - Zentrierte Karte
// - EmmaTresor Branding
// - Responsive Design
```

### Items Components

#### ItemsGrid.tsx
```typescript
// Grid-Ansicht für Inventory Items
// - Kartenbasierte Darstellung
// - Responsive Grid (1-4 Spalten)
// - Item-Details auf Klick
// - Batch-Auswahl-Modus
```

#### ItemsTable.tsx
```typescript
// Tabellen-Ansicht für Inventory Items
// - Spalten: Name, Anzahl, Standort, Wert, Datum
// - Sortierung per Spalten-Klick
// - Batch-Auswahl mit Checkboxen
// - Mobile-optimiert
```

#### FilterSection.tsx
```typescript
// Filter-UI für Items-Seite
// - Suchfeld mit Debouncing
// - Tag-Filter (Multi-Select)
// - Standort-Filter (Multi-Select)
// - Sortierung-Dropdown
// - View-Mode Toggle (Grid/Table)
```

#### SelectionToolbar.tsx
```typescript
// Toolbar für Batch-Operationen
// - Anzeige der Anzahl ausgewählter Items
// - "Zu Liste hinzufügen"-Button
// - "Alle abwählen"-Button
// - Sticky am oberen Rand
```

#### StatisticsCards.tsx
```typescript
// Dashboard-Statistik-Karten
// - Gesamtanzahl Items
// - Gesamtwert (EUR)
// - Anzahl Standorte
// - Anzahl Tags
// - Responsive Grid-Layout
```

### Dialog/Form Components

#### AddItemDialog.tsx
```typescript
// Modal-Dialog zum Hinzufügen neuer Items
// - React Hook Form mit Zod-Validierung
// - Felder: Name, Beschreibung, Anzahl, Standort, Tags, etc.
// - Rich-Text-Editor für Beschreibung
// - Datums-Picker für Kaufdatum
// - Währungs-Input für Wert
// - Bild-Upload-Funktion
```

#### EditItemForm.tsx
```typescript
// Inline-Formular zum Bearbeiten von Items
// - Gleiche Felder wie AddItemDialog
// - Pre-filled mit existierenden Daten
// - Auto-Save-Funktion (optional)
// - Validation Feedback
```

#### ItemDetailView.tsx
```typescript
// Detail-Ansicht für einzelne Items
// - Alle Item-Informationen
// - Bildergalerie
// - QR-Code-Anzeige
// - Änderungsverlauf (Change Log)
// - Bearbeiten/Löschen-Aktionen
// - Navigation zu vorherigem/nächstem Item
```

#### AssignToListSheet.tsx
```typescript
// Bottom-Sheet zum Zuweisen von Items zu Listen
// - Liste aller vorhandenen Listen
// - Checkbox-Auswahl
// - "Neue Liste erstellen"-Option
// - Batch-Zuweisung für mehrere Items
```

#### ListItemsPreviewSheet.tsx
```typescript
// Bottom-Sheet zur Vorschau von Listen-Inhalten
// - Zeigt alle Items in einer Liste
// - Anzahl der Items
// - Export-Funktion
// - Link zur Detail-Ansicht
```

### Page Components

#### DashboardPage.tsx
```typescript
// Dashboard-Übersichtsseite
// - Statistik-Karten (Anzahl Items, Gesamtwert, etc.)
// - Kürzlich hinzugefügte Items
// - Quick-Actions (Neues Item, Scan QR)
// - Willkommensnachricht
```

#### ItemsPage.tsx
```typescript
// Haupt-Inventarseite
// - Filter-Sektion (Suche, Tags, Standorte)
// - View-Mode-Toggle (Grid/Table)
// - Pagination
// - Batch-Selection-Modus
// - Add-Item-Dialog
// - Item-Detail-View
// - Export-Funktion
// - Umfangreichste Page-Komponente (~1000+ Zeilen)
```

#### LoginPage.tsx
```typescript
// Login-Seite (VOLLSTÄNDIG KOMMENTIERT)
// - Email/Password-Formular
// - "Remember Me"-Checkbox
// - Zod-Validierung
// - Error-Handling
// - Auto-Redirect nach Login
```

#### RegisterPage.tsx
```typescript
// Registrierungs-Seite
// - Username, Email, Password-Felder
// - Password-Bestätigung
// - Starke Passwort-Validierung (12+ Zeichen, Groß/Klein, Ziffer, Sonderzeichen)
// - AGB-Checkbox
// - Auto-Login nach Registrierung
```

#### ScanItemPage.tsx
```typescript
// QR-Code-Scan-Ergebnis-Seite
// - Lädt Item per Asset-Tag
// - Zeigt Item-Details
// - Redirect zu Item-Detail-View
```

#### ListsPage.tsx
```typescript
// Listen-Verwaltungsseite
// - Alle benutzerdefinierten Listen
// - Liste erstellen/löschen
// - Items zu Listen hinzufügen
// - Listen-Export-Funktion
```

#### SettingsPage.tsx
```typescript
// Einstellungsseite
// - Benutzer-Profil
// - Passwort ändern
// - Theme-Auswahl (falls implementiert)
// - Logout-Button
```

## Datenfluss

### Authentication Flow
```
1. User öffnet App
2. main.tsx initialisiert Auth-Interceptor
3. useAuth Hook lädt gespeicherten Auth-State
4. authStore.initialise() prüft Session
   ├─ Session gültig → User eingeloggt
   └─ Session ungültig → User auf Login-Page
5. Bei API-Requests:
   ├─ CSRF-Token wird automatisch hinzugefügt (client.ts)
   ├─ Bei 401-Fehler → Auto-Refresh (authInterceptor.ts)
   └─ Refresh erfolgreich → Request wiederholen
```

### Item-Management Flow
```
1. ItemsPage lädt:
   ├─ fetchItems() → Paginierte Items
   ├─ fetchTags() → Alle Tags
   └─ fetchLocations() → Alle Standorte
2. User filtert/sucht:
   ├─ Debounced Search (useDebouncedValue)
   └─ fetchItems() mit Parametern
3. User erstellt Item:
   ├─ AddItemDialog öffnet
   ├─ Form-Validierung (Zod)
   ├─ createItem() API-Call
   └─ Liste aktualisieren
4. User bearbeitet Item:
   ├─ ItemDetailView öffnet
   ├─ EditItemForm mit Pre-filled Data
   ├─ updateItem() API-Call
   └─ Detail-View aktualisieren
```

## API-Endpunkte

Alle API-Funktionen sind in `api/inventory.ts` definiert:

### Items
- `fetchItems(options)` - Liste mit Filtern/Pagination
- `fetchItem(id)` - Einzelnes Item
- `fetchItemByAssetTag(tag)` - Item per QR-Code
- `createItem(data)` - Neues Item erstellen
- `updateItem(id, data)` - Item aktualisieren
- `deleteItem(id)` - Item löschen
- `exportItems(options)` - CSV-Export
- `fetchItemQrCode(id)` - QR-Code generieren
- `fetchItemChangelog(id)` - Änderungsverlauf

### Tags & Locations
- `fetchTags()` - Alle Tags
- `createTag(name)` - Tag erstellen
- `deleteTag(id)` - Tag löschen
- `fetchLocations()` - Alle Standorte
- `createLocation(name)` - Standort erstellen
- `deleteLocation(id)` - Standort löschen

### Lists
- `fetchLists()` - Alle Listen
- `createList(name)` - Liste erstellen
- `deleteList(id)` - Liste löschen
- `updateListItems(id, items)` - Items zuweisen
- `exportListItems(id)` - Listen-CSV-Export

### Images
- `uploadItemImage(itemId, file)` - Bild hochladen

## Typen

### Auth Types (`types/auth.ts`)
```typescript
interface UserProfile {
  id: number;
  username: string;
  email: string;
}

interface LoginRequest {
  email: string;
  password: string;
  username?: string;
  rememberMe: boolean;
}

interface LoginResponse {
  user: UserProfile;
  access_expires: number;
  remember: boolean;
}

interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  password_confirm: string;
}
```

### Inventory Types (`types/inventory.ts`)
```typescript
interface Item {
  id: number;
  name: string;
  description: string | null;
  quantity: number;
  purchase_date: string | null;
  value: string | null;
  asset_tag: string;
  owner: number;
  location: number | null;
  wodis_inventory_number: string | null;
  tags: number[];
  images: ItemImage[];
  created_at: string;
  updated_at: string;
}

interface Tag {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

interface Location {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

interface ItemList {
  id: number;
  name: string;
  owner: number;
  items: number[];
  created_at: string;
  updated_at: string;
}

interface ItemImage {
  id: number;
  item: number;
  image: string;
  download_url: string;
  preview_url: string;
  filename: string;
  content_type: string;
  size: number;
  created_at: string;
  updated_at: string;
}

interface ItemChangeLog {
  id: number;
  item: number | null;
  item_name: string;
  user: number | null;
  user_username: string | null;
  action: 'create' | 'update' | 'delete';
  action_display: string;
  changes: Record<string, { old: unknown; new: unknown }>;
  created_at: string;
}
```

## Sicherheitsfeatures

1. **CSRF-Schutz**: Automatisches Token-Handling in `client.ts`
2. **JWT-Authentication**: Cookie-basierte Tokens mit Auto-Refresh
3. **Route-Guards**: ProtectedRoute & PublicRoute verhindern unbefugten Zugriff
4. **Input-Validation**: Zod-Schemas für alle Formulare
5. **XSS-Schutz**: React escaped automatisch alle Outputs
6. **Secure Cookies**: HTTP-Only, Secure, SameSite-Flags

## Performance-Optimierungen

1. **Debouncing**: Suchfeld nutzt `useDebouncedValue` (400ms)
2. **Pagination**: Nur 20 Items pro Seite laden
3. **Lazy Loading**: Code-Splitting mit React.lazy (potentiell)
4. **Memoization**: useMemo für teure Berechnungen
5. **Optimistic Updates**: Sofortiges UI-Feedback

## Best Practices

1. **TypeScript Strict Mode**: Vollständige Typsicherheit
2. **Komponentenstruktur**: Kleine, wiederverwendbare Komponenten
3. **Custom Hooks**: Logik-Extraktion aus Komponenten
4. **Error Boundaries**: Graceful Fehlerbehandlung
5. **Accessibility**: Semantic HTML, ARIA-Labels
6. **Responsive Design**: Mobile-First mit Tailwind

## Testing (Empfohlen)

Für vollständige Produktionsreife sollten noch folgende Tests hinzugefügt werden:

1. **Unit Tests**: Jest + React Testing Library
2. **Integration Tests**: API-Mock-Tests
3. **E2E Tests**: Cypress für User-Flows
4. **Component Tests**: Storybook für UI-Komponenten

---

**Stand**: Vollständig dokumentiert
**Letzte Aktualisierung**: 2025-11-15
**Entwickler**: EmmaTresor Team
