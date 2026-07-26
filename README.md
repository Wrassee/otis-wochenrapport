# OTIS Wochenrapport PWA

**Offline-First** Wochenrapport-App für OTIS-Techniker. Erfasst Arbeitszeiten,
Spesen und generiert den offiziellen OTIS-Excel-Rapport — direkt vom Smartphone,
ohne Internetverbindung in der Liftgrube.

> **Live:** [https://otis-wochenrapport.vercel.app](https://otis-wochenrapport.vercel.app)
>
> **Backend:** [https://otis-wochenrapport.onrender.com/health](https://otis-wochenrapport.onrender.com/health)

---

## 📦 Architektur

```
otis-wochenrapport/
├── apps/
│   ├── web/          ← React + Vite PWA (Frontend)
│   └── backend/      ← Python FastAPI (Excel-Generator)
├── docker-compose.yml
├── .github/workflows/deploy.yml   ← CI/CD
└── README.md
```

### Frontend (`apps/web`)

| Technologie | Zweck |
|---|---|
| **React 19** + TypeScript 6 | UI-Komponenten |
| **Vite 8** + Tailwind CSS 4 | Build-Tool + Styling |
| **shadcn/ui** + Lucide Icons | Designsystem + Icons |
| **Zustand 5** | State-Management |
| **IndexedDB** (idb) | Lokale Offline-Datenbank |
| **JSZip** | Offline-Excel-Generierung (Browser-seitig) |
| **Capacitor 8** | Android-Native-Wrapper |
| **Supabase JS Client** | Cloud-Synchronisation |
| **Vite PWA Plugin** | Service Worker + Offline-Caching |

### Backend (`apps/backend`)

| Technologie | Zweck |
|---|---|
| **Python 3.12** + FastAPI | REST-API |
| **Uvicorn** | ASGI-Server |
| **Raw XML + zipfile** | Excel-Generierung (ohne openpyxl) |
| **Supabase Client** | Datenbank-Zugriff |
| **Deployed on Render** | Cloud-Hosting |

---

## 🚀 Lokale Entwicklung

### Voraussetzungen

- **Node.js 22+** – [nodejs.org](https://nodejs.org)
- **Python 3.12+** – [python.org](https://python.org)
- **Docker Desktop** (optional, für Container-Stack)

### 1. Schnellstart (Frontend + Backend nativ)

```bash
# Repository klonen
git clone https://github.com/wrassee/otis-wochenrapport.git
cd otis-wochenrapport

# Frontend-Abhängigkeiten installieren
cd apps/web && npm install

# Backend-Abhängigkeiten installieren
cd ../backend && pip install -r requirements.txt

# Frontend .env anlegen (siehe Abschnitt Umgebungsvariablen):
# Kopiere diese Vorlage nach apps/web/.env und fülle die Werte ein:
# cat > apps/web/.env << 'EOF'
# VITE_SUPABASE_URL=https://xxx.supabase.co
# VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
# VITE_RENDER_URL=http://localhost:8000
# EOF
#
# Backend .env anlegen:
# cat > apps/backend/.env << 'EOF'
# SUPABASE_URL=https://xxx.supabase.co
# SUPABASE_SERVICE_KEY=eyJhbGciOi...
# FRONTEND_URL=http://localhost:5173
# EOF
#
# Lokales Supabase starten (optional, Docker erforderlich):
# cd apps/web && npx supabase start
```

**Entwicklung starten (Frontend + Backend gleichzeitig):**
```bash
cd apps/web && npm run dev
```

Dies startet:
- **Vite Dev Server** → [http://localhost:5173](http://localhost:5173)
- **Python Backend** → [http://localhost:8000](http://localhost:8000)
- **Health Check** → [http://localhost:8000/health](http://localhost:8000/health)

### 2. Docker Stack (empfohlen für Backend)

```bash
# Nur Backend im Container
docker compose -f docker-compose.backend.yml up -d

# Ganzer Stack (Frontend + Backend)
docker compose up -d

# Stack stoppen
docker compose down
```

### 3. Skripte (Root `package.json`)

| Befehl | Beschreibung |
|---|---|
| `npm run dev` | Frontend + Backend lokal starten |
| `npm run build` | Frontend Production-Build |
| `npm run preview` | Vite Preview (get build) |
| `npm run docker:up` | Docker Stack starten |

---

## 🔧 Umgebungsvariablen

### Frontend (`apps/web/.env`)

| Variable | Beschreibung | Beispiel |
|---|---|---|
| `VITE_SUPABASE_URL` | Supabase Project URL | `https://xxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public Key | `eyJhbGciOi...` |
| `VITE_RENDER_URL` | Backend-URL | `http://localhost:8000` |

### Backend (`apps/backend/.env`)

| Variable | Beschreibung | Beispiel |
|---|---|---|
| `SUPABASE_URL` | Supabase Project URL | `https://xxx.supabase.co` |
| `SUPABASE_SERVICE_KEY` | Supabase service_role Key | `eyJhbGciOi...` |
| `FRONTEND_URL` | CORS-Allow-Origin | `https://otis-wochenrapport.vercel.app` |
| `PORT` | Server-Port | `8000` |

---

## 🗄️ Supabase Setup

### Tabellen (Migration in `supabase/migrations/001_init.sql`)

```sql
-- Kern-Tabellen
profiles      -- Benutzer (Name, Personal-Nr., Supervisor-Email)
locations     -- Lift-Adressen (Anlagenummer, Projekt, Koordinaten, Zone)
activity_codes -- Tätigkeitskatalog (NK, S, T, QI, I04, A01, ...)
time_entries  -- Arbeitszeit-Einträge (Datum, Start, Dauer, Lift, Tätigkeit)
user_settings -- Benutzer-Einstellungen (Default-Startzeit)
```

### Row Level Security (RLS)

- Techniker sehen nur **eigene** Einträge
- Lift-Stammdaten (`locations`) sind für alle lesbar
- Admins/Supervisoren haben erweiterten Zugriff

### Lokales Supabase

```bash
cd apps/web
npx supabase start    # Startet lokale Instanz (Docker erforderlich)
npx supabase stop     # Stoppt Instanz
npx supabase db reset # Setzt DB zurück
```

---

## 📱 Android APK Build (Capacitor)

**Voraussetzung:** Android SDK installiert und `ANDROID_HOME` gesetzt.

```bash
# 1. Frontend bauen
cd apps/web && npm run build

# 2. Capacitor synchronisieren
npx cap sync android

# 3. APK bauen (Debug) — benötigt ANDROID_HOME
cd android && ./gradlew assembleDebug

# Ausgabe: apps/web/android/app/build/outputs/apk/debug/app-debug.apk
```

Alternativ — Android Studio (GUI):
```bash
npx cap open android  # Öffnet Android Studio → Build → Build APK(s)
```

**Release APK:** Für einen signierten Release-Build muss `android/app/build.gradle`
um `signingConfigs` ergänzt werden (siehe [Android Developer Docs](https://developer.android.com/studio/publish/app-signing)).

---

## 🚢 Deployment (CI/CD)

Der Workflow `.github/workflows/deploy.yml` deployt automatisch bei jedem Push
auf `main` oder `master`:

```
push to main/master
        │
        ▼
┌──────────────────┐
│  frontend build  │  ← TypeScript check + Vite build
└────────┬─────────┘
         │
         ▼
┌──────────────────┐     ┌──────────────────┐
│  Deploy Vercel   │     │  Deploy Render   │
│  (npx vercel)    │     │  (Deploy Hook)   │
└────────┬─────────┘     └────────┬─────────┘
         └────────┬───────────────┘
                  ▼
         ┌──────────────────┐
         │  Notify (Status) │
         └──────────────────┘
```

### Vercel Secrets (GitHub → Settings → Secrets → Actions)

| Secret | Beschreibung |
|---|---|
| `VERCEL_TOKEN` | Vercel Dashboard → Settings → Tokens |
| `VERCEL_ORG_ID` | `npx vercel whoami` |
| `VERCEL_PROJECT_ID` | Vercel Project → Settings → Project ID |

### Render Secrets

| Secret | Beschreibung |
|---|---|
| `RENDER_DEPLOY_HOOK_URL` | Render Dashboard → otis-wochenrapport-api → Deploy Hooks → Create Hook |

### Manuelle Deploys

**Frontend (Vercel):** Push auf `main` → automatisch via CI/CD.
Alternativ: `cd apps/web && npx vercel --prod`

**Backend (Render):** Push auf `main` → automatisch via Git-Integration oder
CI/CD Deploy Hook. Dashboard: render.com → otis-wochenrapport-api → Manual Deploy

---

## 🏗️ Projekt-Struktur

```
apps/web/src/
├── components/          ← UI-Komponenten
│   ├── ui/              ← Basis-Komponenten (Card, Button, Input, Badge, BottomSheet, TimelineView)
│   ├── daily/           ← Erfassungs-Komponenten (TimeEntryForm, ActivityPicker, FavoriteLifts)
│   ├── weekly/          ← Wochen-Komponenten (WeekOverview, DayCard, ExpenseEditor)
│   └── export/          ← Export-Komponenten (ExportSummary)
├── pages/               ← Seiten (DashboardPage, WeeklyPage, ExportPage, SettingsPage)
├── stores/              ← Zustand-Stores (appStore.ts)
├── db/                  ← Datenbank (indexeddb.ts, supabase.ts)
├── lib/                 ← Utilities (utils.ts, types.ts, translations.ts, useTranslation.ts)
├── services/            ← Dienste (offlineGenerator.ts, geocode.ts)
├── public/templates/    ← Excel-Template (template.xlsx)
└── src/sw.ts            ← Service Worker

apps/backend/src/
├── excel_generator.py   ← Excel-Generierung (raw XML, kein openpyxl)
├── main.py              ← FastAPI-App (Endpunkte: /generate-excel, /send-email, /health)
├── templates/           ← Excel-Vorlage (template.xlsx)
└── render.yaml          ← Render-Konfiguration
```

---

## 📄 Excel-Generierung

Der Excel-Rapport wird **ohne openpyxl** generiert — stattdessen per raw XML-Manipulation:

1. **Template** wird als ZIP geöffnet (`zipfile`)
2. **sheet1.xml** (Stundenrapport) wird per Regex befüllt:
   - Kopfzeilen: Name, Personal-Nr., Monat, Jahr, KW
   - Datenzeilen (8–22): Datum, Anlagenummer, Projekt, Adresse, Start (OTIS-Format), Dauer (OTIS-Format), Tätigkeitsmarker
3. **sheet2.xml** (Spesenrapport) wird per Regex befüllt:
   - Personalien, Datumsbereich
   - Zonen-Markierungen (Z1–Z4, tagesweise)
   - Spesen-Positionen (Entschädigung, Hotel, Transport, Material, ...)
   - Fußzeile (Datum)
4. **Shared Strings + Wingdings-Legende** bleiben unangetastet

Der gleiche Algorithmus steht auch **Client-seitig** zur Verfügung
(`offlineGenerator.ts` + JSZip) — für den Fall, dass das Backend nicht
erreichbar ist.

---

## 🌍 Sprachen

- **Deutsch** (Standard)
- **Französisch**
- **Italienisch**
- **Englisch** (Fallback)
- **Ungarisch**

Sprachumschaltung: Einstellungen → Sprache

---

## 📋 Features

| Feature | Status |
|---|---|
| 🔒 Email + Passwort Login | ✅ |
| 📍 Automatische Zonenberechnung (Haversine) | ✅ |
| 🏢 Lift-Suche mit Autocomplete | ✅ |
| ⏱️ OTIS-Zeitformat (4.30 = 4h30m) | ✅ |
| 🍽️ Mittagspause (30–60 Min.) | ✅ |
| ⏰ 15-Minuten-Raster | ✅ |
| ⚡ Quick-Add (+30 Min., +1h) | ✅ |
| 🔗 Automatische Startzeit-Verkettung | ✅ |
| 🚨 Kollisionserkennung + -navigation | ✅ |
| ❌ Bearbeiten + Löschen (Dashboard + Woche) | ✅ |
| 📅 Wochenübersicht mit Validierung | ✅ |
| 💰 Spesen pro Tag (Material, Hotel, Pikett, ...) | ✅ |
| 🏆 Letzte 5 Lifte (Häufigkeits-Ranking) | ✅ |
| 📤 Excel-Export (Backend + Offline) | ✅ |
| 📧 E-Mail-Versand (mit Offline-Fallback) | ✅ |
| 🌙 Dark Mode | ✅ |
| 📱 Sprachauswahl (DE/FR/IT/HU) | ✅ |
| 🤖 Android APK (Capacitor) | ✅ |
| 🚀 CI/CD (Vercel + Render + GitHub Actions) | ✅ |

---

## 📝 Lizenz

MIT — siehe [LICENSE](LICENSE)

---

*Entwickelt mit ❤️ für die OTIS-Techniker im Außendienst.*
