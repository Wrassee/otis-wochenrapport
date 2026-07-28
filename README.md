# OTIS Wochenrapport PWA

**Offline-First** Wochenrapport-App für OTIS-Techniker. Erfasst Arbeitszeiten,
Spesen und generiert den offiziellen OTIS-Excel-Rapport — direkt vom Smartphone,
auch ohne Internet in der Liftgrube.

> **Live:** [otis-wochenrapport.vercel.app](https://otis-wochenrapport.vercel.app)
>
> **Backend Health:** [otis-wochenrapport.onrender.com/health](https://otis-wochenrapport.onrender.com/health)

---

## 📚 Dokumentation

| Dokument | Inhalt |
|---|---|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Systemarchitektur, Layer-Modell, Datenflüsse, CI/CD, Umgebungsvariablen |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Entwickler-Guide, Code-Beispiele, drei-Layer-Muster, Übersetzungen |

---

## 🚀 Quick Start

```bash
git clone https://github.com/wrassee/otis-wochenrapport.git
cd apps/web && npm install
cd ../backend && pip install -r requirements.txt
# → Umgebungsvariablen in apps/web/.env und apps/backend/.env setzen
#   (Details: ARCHITECTURE.md → Environment Variables)

# Entwicklung starten (Frontend + Backend parallel):
cd apps/web && npm run dev
```

| Befehl | Beschreibung |
|---|---|
| `npm run dev` | Frontend (Vite) + Backend (Uvicorn) lokal starten |
| `npm run build` | Production-Build |
| `npm run docker:up` | Docker Stack starten |

---

## 🧱 Tech Stack

```
Frontend: React 19 + TypeScript 6 · Vite 8 · Tailwind CSS 4 · Zustand 5
          shadcn/ui · Lucide Icons · IndexedDB (idb) · Capacitor 8 · JSZip

Backend:  Python 3.12 · FastAPI · Uvicorn · raw XML/zipfile (Excel)

Cloud:    Supabase (DB + Auth) · Vercel (Frontend) · Render (Backend)
```

---

## 🏗️ Projekt-Struktur

```
apps/web/src/
├── pages/          ← Seiten (DashboardPage, WeeklyPage, ExportPage, SettingsPage)
├── components/     ← UI-Komponenten (ui/, daily/, weekly/, export/)
├── hooks/          ← React Hooks (useTimeEntries, useDailyExpenses …)
├── stores/         ← Zustand (appStore.ts)
├── db/             ← IndexedDB + Supabase
├── lib/            ← Utils, Types, Übersetzungen, syncExpenses
└── services/       ← offlineGenerator, geocode

apps/backend/src/
├── main.py         ← FastAPI (Endpoints: /health, /generate-excel, /send-email)
├── excel_generator.py
└── templates/
```

---

## 🚢 Deployment

Push auf `main` → automatischer CI/CD via GitHub Actions:

- **Vercel** — Frontend (PWA)
- **Render** — Backend (API)
- **Supabase** — Datenbank + Auth

Details: [ARCHITECTURE.md → Infrastructure & Deployment](./ARCHITECTURE.md#infrastructure--deployment)

---

## 📱 Android APK

```bash
cd apps/web && npm run build && npx cap sync android
cd android && ./gradlew assembleDebug
# → apps/web/android/app/build/outputs/apk/debug/app-debug.apk
```

---

## 🌍 Sprachen

Deutsch (Standard) · Französisch · Italienisch · Ungarisch

---

## 📝 Lizenz

MIT — siehe [LICENSE](./LICENSE)

---

*Entwickelt für die OTIS-Techniker im Außendienst.*
