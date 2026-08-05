# OTIS Wochenrapport — Architecture

## Overview

A React PWA (Vite + Tailwind + shadcn/ui) wrapped with Capacitor for Android, backed by a Supabase cloud database and a Python microservice for Excel generation. The guiding principle is **Offline-First**: all data is written locally to IndexedDB before any network call, and a background sync process pushes changes to Supabase when connectivity is available.

```
┌──────────────────────────────────────────────────────────────────┐
│                        Capacitor (Android)                        │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                    React PWA (Vite)                         │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │  │
│  │  │ Erfassung│  │ Woche    │  │ Spesen   │  │ Export   │  │  │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  │  │
│  │       │              │              │              │        │  │
│  │  ┌────▼──────────────▼──────────────▼──────────────▼────┐  │  │
│  │  │              Zustand Store (useAppStore)              │  │  │
│  │  └──────────────────────┬───────────────────────────────┘  │  │
│  │                         │                                   │  │
│  │  ┌──────────────────────▼───────────────────────────────┐  │  │
│  │  │          IndexedDB (Local — Source of Truth)           │  │  │
│  │  │   time_entries │ locations │ profile │ favorites │   │  │  │
│  │  │   sync_queue (background sync queue)                  │  │  │
│  │  └──────────────────────┬───────────────────────────────┘  │  │
│  │                         │                                   │  │
│  │  ┌──────────────────────▼───────────────────────────────┐  │  │
│  │  │          Background Sync (30s interval)               │  │  │
│  │  └──────────────────────┬───────────────────────────────┘  │  │
│  └─────────────────────────┼───────────────────────────────────┘  │
│                            │                                      │
│  ┌─────────────────────────▼───────────────────────────────────┐  │
│  │                   Supabase (Cloud)                           │  │
│  │   auth │ profiles │ time_entries │ locations │ expenses     │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │              Python Backend (Render / Local)                  │  │
│  │         Raw XML manipulation → OTIS Wochenrapport .xlsx     │  │
│  └─────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Layer Map

| Layer | Directory | Purpose |
|---|---|---|
| **1. UI / Pages** | `apps/web/src/pages/` | Route-level components (Dashboard, Woche, Spesen, Export, Settings) |
| **2. Components** | `apps/web/src/components/` | Reusable UI — layout, form controls, charts, pickers |
| **3. State (Zustand)** | `apps/web/src/stores/` | `useAppStore` — global reactive state |
| **4. Hooks** | `apps/web/src/hooks/` | React hooks that bridge store + lib (consumer-friendly API) |
| **5. DB / Sync** | `apps/web/src/db/` | IndexedDB (local) + Supabase (remote) + background sync orchestrator |
| **6. Lib / Utils** | `apps/web/src/lib/` | Pure utility functions, translations, types, constants |
| **7. Services** | `apps/web/src/services/` | Offline-first Excel generator (JSZip + raw XML) |

---

## Core Principles

### Offline-First

1. **Write locally first** — every mutation writes to IndexedDB before anything else
2. **Optimistic UI** — the store updates instantly (no waiting for network)
3. **Background sync** — a 30-second interval pushes unsynced data to Supabase
4. **Queue-based retry** — failed syncs stay in the sync queue and retry on the next interval

### Three-Layer Architecture

The app follows a consistent three-layer pattern for every data domain. The pattern separates **pure logic (lib)** from **React bindings (hooks)** from **UI / state (store + components)**. Three implementations exist today:

- **Spesen** (daily expenses) — the original refactored domain
- **TimeEntries** (work hours) — followed the same pattern
- **Holidays** (hypothetical) — documented in [CONTRIBUTING.md](./CONTRIBUTING.md) as a walkthrough example

---

#### Spesen — useDailyExpenses hook

The daily expenses system was the first to be refactored from monolithic store calls into three clean layers.

```
┌─────────────────────────────────────────────────────────────┐
│                Layer 1: Pure Function (lib)                   │
│  lib/syncExpenses.ts                                          │
│  ───────────────────────                                      │
│  export function syncExpenses(all, userId, ms?)               │
│    • Zero dependencies on React / Zustand                    │
│    • Can be called from any context — component,              │
│      store action, service worker, event handler              │
│    • Module-level debounce timer (shared across call sites)  │
│    • Writes to IndexedDB sync queue                           │
│    • Testable in isolation                                    │
├─────────────────────────────────────────────────────────────┤
│                Layer 2: React Hook (hook)                      │
│  hooks/useExpensesSync.ts                                    │
│  ─────────────────────────                                    │
│  export function useExpensesSync(delayMs?)                     │
│    • Reads current state from the store                        │
│    • Collects data and passes it to the pure lib function     │
│    • Returns a memoized `syncExpenses()` function             │
│    • Provides a convenient API for components                  │
│  ★                                                           │
│  hooks/useDailyExpenses.ts                                   │
│  ────────────────────────                                     │
│  export function useDailyExpenses(dates, options?)             │
│    • Bundles: auto-refresh from IndexedDB, toggleExpense,     │
│      setExpenseValue, manual refreshFromLocalDB, syncExpenses │
│    • Unified API that eliminates duplicate IndexedDB code     │
│      across SpesenPage, ExpenseEditor, DashboardPage          │
├─────────────────────────────────────────────────────────────┤
│                Layer 3: State + UI (store + components)         │
│  stores/appStore.ts                                           │
│  ────────────────────                                         │
│    • Holds the reactive dailyExpenses state                   │
│    • toggleExpense / setExpenseValue actions                   │
│    • Delegates sync to lib/syncExpenses                       │
│                                                               │
│  pages/SpesenPage.tsx                                         │
│  components/weekly/ExpenseEditor.tsx                           │
│  pages/DashboardPage.tsx                                       │
│    • All three use useDailyExpenses(dates)                     │
│    • Explicit syncExpenses() calls at the component level      │
└─────────────────────────────────────────────────────────────┘
```

---

#### TimeEntries — useTimeEntries hook

The TimeEntries domain follows the same pattern as Spesen but differs in one important way: the **pure logic (Layer 1)** already existed in `db/indexeddb.ts` (`saveEntry`, `updateEntry`, `deleteEntry`), so only the **hook layer** was extracted. The store actions remain, but now components consume them through the unified hook.

```
┌─────────────────────────────────────────────────────────────┐
│                Layer 1: Pure functions (db)                   │
│  db/indexeddb.ts                                              │
│  ──────────────────                                           │
│  saveEntry / updateEntry / deleteEntry / getAllEntries        │
│    • No React / Zustand dependency — pure IndexedDB ops      │
│    • Already existed before the refactor                     │
│    • Called by both the store AND the hook                    │
├─────────────────────────────────────────────────────────────┤
│                Layer 2: React Hook (hook)                      │
│  hooks/useTimeEntries.ts (★ NEW)                              │
│  ─────────────────────────────                                │
│  export function useTimeEntries()                              │
│    • Bundles subscription + all mutations in one API          │
│    • Returns: timeEntries, weekSummary, isLoading              │
│    • Mutations: addEntry, updateEntry, deleteEntry,            │
│      quickAdd, loadWeek, recalculate                          │
│    • Each mutation is useCallback-wrapped                     │
│    • Components no longer need to know about store internals  │
├─────────────────────────────────────────────────────────────┤
│                Layer 3: State + UI (store + components)         │
│  stores/appStore.ts                                           │
│    • Still holds timeEntries, weekSummary state                │
│    • addTimeEntry / updateTimeEntry actions remain            │
│    • Hook delegates to these actions internally               │
│                                                               │
│  pages/DashboardPage.tsx                                      │
│  pages/WeeklyPage.tsx                                         │
│    • Both now use: const { addEntry, updateEntry,             │
│      deleteEntry, loadWeek } = useTimeEntries()               │
│    • No direct useAppStore() for time entry operations        │
└─────────────────────────────────────────────────────────────┘
```

**Key difference from Spesen:** Unlike Spesen which has a dedicated pure function layer (`lib/syncExpenses.ts`) for the sync logic, TimeEntries reuses the existing IndexedDB functions directly. The hook provides the React-friendly wrapper without adding a new pure lib file. This demonstrates that the three-layer pattern is **flexible** — you can follow all three layers when you need to (Spesen), or just extract the hook layer when the pure logic already exists (TimeEntries).

---

#### Holidays — cross-reference to CONTRIBUTING.md

The `CONTRIBUTING.md` file contains a complete walkthrough for adding a new domain called "Holidays" from scratch, following the same three-layer pattern:

```
How to Add a New Data Domain (Holidays example)

Step 1 — Types:          lib/types.ts              → Holiday interface
Step 2 — IndexedDB:      db/indexeddb.ts           → saveHoliday / getHolidays
Step 3 — Store actions:  stores/appStore.ts        → holidays state + actions
Step 4 — Pure lib:       lib/syncHolidays.ts       → module-level debounce timer
Step 5 — Hook:           hooks/useHolidays.ts      → subscribes + mutations + sync
Step 6 — Component:      pages/HolidaysPage.tsx    → just calls useHolidays()
```

See [CONTRIBUTING.md — How to Add a New Data Domain](./CONTRIBUTING.md#how-to-add-a-new-data-domain-full-example) for the full code examples and explanation.

### Why separate a pure function from the hook?

| Concern | Pure function (`lib/`) | Hook (`hooks/`) |
|---|---|---|
| **Testability** | ✅ Can test with mock IndexedDB | Requires React renderer |
| **Use outside React** | ✅ Service workers, events, timeouts | ❌ Requires component context |
| **Debounce sharing** | ✅ Module-level timer shared by all callers | ✅ Reuses lib's timer |
| **Convenience** | Manual data collection needed | ✅ Reads store automatically |

---

## Data Flow: Spesen (End-to-End)

### Happy path (online)

```
User taps "Material → 50 CHF"
  │
  ▼
handleToggle / handleValueChange
  │
  ├─▶ toggleExpense(date, type)      [store action]
  │     ├─▶ set()                      [zustand — immediate UI update]
  │     ├─▶ localDb.saveDailyExp()     [IndexedDB — offline persistence]
  │     └─▶ syncExpensesToSupabase()   [store → lib/syncExpenses.ts]
  │           └─▶ addToSyncQueue()     [IndexedDB sync_queue store]
  │
  └─▶ syncExpenses()                  [hook → lib/syncExpenses.ts]
        └─▶ timer reset (2s)          [same module-level timer]

... 2 seconds later (debounce) ...

lib/syncExpenses.ts timer fires
  └─▶ addToSyncQueue({ type: 'expenses_sync', expenses: [...] })

... next background sync cycle (30s) ...

db/sync.ts performSync()
  └─▶ getSyncQueue()
  └─▶ syncExpenses(userId, expenses)  [Supabase: DELETE ALL + INSERT FRESH]
  └─▶ clearSyncQueue()
```

### Offline path

```
User taps "Hotel" in a lift shaft (no signal)
  │
  ├─▶ toggleExpense() — store updates immediately ✓
  ├─▶ localDb.saveDailyExp() — saved to phone ✓
  └─▶ syncExpenses() — debounce starts
        └─▶ timer fires
              └─▶ addToSyncQueue() — queued locally ✓

... technician exits building, phone reconnects ...
  │
  ▼
Background sync (30s interval or 'online' event)
  └─▶ performSync() — processes sync_queue
  └─▶ syncExpenses(userId, expenses) — pushed to Supabase ✓
```

### Live cross-device sync (Supabase Realtime)

The Spesen domain's **Belege photos** are live-synced: a photo captured on another device appears in the ReceiptPhotos strip within ~1 second — no manual sync, no app restart. (Requires migration `006_expense_photos_realtime.sql` — run it in the Supabase SQL Editor.)

```
Device B: camera capture → addExpensePhoto(file, year, week)   [store action]
              ├─▶ saveExpensePhoto()               [IndexedDB]
              └─▶ upsertExpensePhoto()             [Supabase — if online]
                          │
                          ▼  (postgres_changes — INSERT event)
Device A: channel "expense-photos-<userId>"   [filter: user_id=eq.<userId>]
                          │
                          ▼
              appStore realtime handler
                          │
              ├─▶ INSERT / UPDATE
              │     └─▶ 300ms debounce
              │           └─▶ loadExpensePhotos(year, week, force=true)
              │                 [full week reload: cloud + local merge]
              │
              └─▶ DELETE
                    └─▶ direct: localDb.deleteExpensePhoto(id)
                          + store filter → can't resurrect via merge
                          │
                          ▼
        ReceiptPhotos strip re-renders instantly
        (Dashboard / Woche / Spesen / Export all share the store)
```

> **Note:** `daily_expenses` (migration `007`) uses the same Realtime pattern with one difference — rows are applied **directly** (upsert/remove by `(date, expense_type)` key) instead of a week reload, because the expense sync is full-replace (`DELETE ALL` + `INSERT FRESH`) and a reload would resurrect locally-deleted rows through the merge logic.

---

## Key Data Domains

### Time Entries (work hours)

```
[Component] → addTimeEntry()
                → localDb.saveEntry()     [IndexedDB — immediate]
                → sync_queue entry added  [for background sync]
                → set()                   [store — UI updates]
                → calculateWeekSummary()  [recalculate totals]
```

### Favorites (recent lifts)

```
[Component] → addRecentLocation(location)
                → localDb.addFavoriteLocation()  [IndexedDB]
                → set({ favoriteLocations })     [store]
                → upsertFavorite()               [Supabase — if online]
```

### Locations (elevators)

```
Manual add:  [SettingsPage] → localDb → sync_queue → Supabase
Auto-add:    [TimeEntryForm] → if new anlagenummer → localDb → sync_queue
Zone calc:   [Nominatim geocode] → Haversine formula → Zone 1-5
Manual zone: [SettingsPage] → manual_zone override → localDb → Supabase
```

#### Spesen-Zone calculation rules

Every lift's zone is measured as the **straight-line (Haversine) distance from a reference point** — the technician's home base. The default reference is Dietlikon (`REFERENCE_LAT`/`REFERENCE_LON`), but each technician can override it in Settings (`profile.home_latitude` / `profile.home_longitude`) via `lib/zoneReference.ts` → `getZoneReference()`; every zone consumer resolves the origin through this single helper.

| Zone | Distance (straight line) | Notes |
|---|---|---|
| **Z1** | 0–10 km | |
| **Z2** | 10–30 km | |
| **Z3** | 30–60 km | |
| **Z4** | 60+ km | variable allowance applies (see below) |
| **Z5** | 60+ km + overnight stay | variable allowance applies; only ever set **manually** (`manual_zone`) — auto-computed zones never assume an overnight stay |

Implementation: `lib/utils.ts` → `calculateZone(distanceKm, overnightStay = false)`.

**Zone trust model** — a stored `zone` value is only considered trustworthy when the lift has geocoded coordinates or a manual override. The display/report zone is **always recomputed from the coordinates** via `liftEffectiveZone` (SettingsPage) / `resolveEntryZone` (ExportPage): a stale stored zone — e.g. a leftover of the old `Z0→Z1` default — is never shown or written into the report. Lifts without coordinates honestly display **"Auto"** until the batch recalculation (Settings → "Zonen neu berechnen") geocodes and fixes them.

**Batch recalculation** — `lib/locationZones.ts` → `locationsMissingZone()` collects every lift without a manual override whose zone is not trustworthy: no coordinates at all, **or** coordinates whose recomputed zone differs from the stored one. The recalc then re-geocodes coordinateless lifts (Nominatim, rate-limited to ~1 req/s) and recomputes the zone of geocoded ones from their stored coordinates (no second geocode needed).

#### Z4/Z5 km allowance (variable Spesen)

When the visited lift is **farther than 60 km straight-line** (zone Z4 or Z5), the technician is entitled to an extra **0.10 CHF per actually-driven kilometre** — the trigger is the zone, but the reimbursement is per **driven km**, not straight-line (e.g. 68 km straight-line ≈ 114 km driven one way → 228 km round trip → **22.80 CHF**).

```
Day with max zone ≥ 4 (straight-line 60+ km) + geocoded lift
  │
  ▼
lib/routing.ts → getDrivingDistance(home → lift)   [OSRM public server]
  │  real road route, 5s timeout, never throws
  ├─ online:  one-way km = OSRM driven distance
  └─ offline: one-way km = straight-line (Haversine) estimate
  │
  ▼
CHF per day = 2 × one-way km × 0.10   (round-trip)
  │
  ▼
Spesenrapport sheet → row 24 "Zone 4 + 5 (variable) · CHF -.10 / km"
  (per-day column; both backend excel_generator.py and the offline
   services/offlineGenerator.ts write the same value)
```

- Frontend: `ExportPage.collectKmAllowances()` — one candidate per day (the **farthest** lift among the max-zone entries); `lib/routing.ts` fetches the real route from OSRM (parallel, 5 s timeout each).
- The allowance travels to both generators as `km_allowances: dict[int, float]` (weekday → CHF) in the `GenerateRequest` payload.

---

## Key Files Reference

### Frontend (`apps/web/src/`)

| File | Role |
|---|---|
| `stores/appStore.ts` | Zustand store — global state + actions |
| `hooks/useDailyExpenses.ts` | 🏆 Unified expense hook (Layer 2 — Spesen) |
| `hooks/useExpensesSync.ts` | Sync-only hook (Layer 2 — Spesen) |
| `hooks/useTimeEntries.ts` | 🏆 Unified TimeEntry hook (Layer 2 — TimeEntries) |
| `lib/syncExpenses.ts` | 🏆 Pure sync function (Layer 1) |
| `lib/types.ts` | TypeScript interfaces (TimeEntry, ExpenseType, etc.) |
| `lib/translations.ts` | DE/FR/IT/HU/EN multi-language dictionary |
| `lib/constants.ts` | Reference coords, zone thresholds, activity codes |
| `lib/utils.ts` | Time conversion, Haversine, ID generation |
| `lib/geocode.ts` | Nominatim geocoding with rate limiting |
| `lib/routing.ts` | OSRM driving-distance helper (Z4/Z5 km allowance) |
| `lib/zoneReference.ts` | Spesen-zone origin resolver (Dietlikon or profile override) |
| `lib/locationZones.ts` | Geocode + zone apply, batch-recalc candidate selection |
| `lib/cn.ts` | Tailwind class merging utility |
| `db/indexeddb.ts` | Local IndexedDB operations (source of truth) |
| `db/supabase.ts` | Remote Supabase client + CRUD |
| `db/sync.ts` | Background sync orchestrator (30s interval) |
| `services/offlineGenerator.ts` | Offline Excel XLSX generation (JSZip + raw XML) |
| `components/ui/*` | Base UI kit (Card, Button, BottomSheet, Input, Badge, etc.) |
| `components/weekly/*` | Woche page components (WeekOverview, DayCard, ExpenseEditor) |
| `components/daily/*` | Erfassung page components (TimeEntryForm, ActivityPicker, etc.) |

### Backend (`apps/backend/src/`)

| File | Role |
|---|---|
| `main.py` | FastAPI server |
| `excel_generator.py` | Raw XML XLSX generator (pure Python stdlib — no openpyxl) |

### Root

| File | Role |
|---|---|
| `docker-compose.yml` | Multi-service Docker stack (frontend + backend) |
| `apps/web/Dockerfile` | Nginx-served production frontend |
| `apps/backend/Dockerfile` | Python-slim backend image |
| `.github/workflows/deploy.yml` | CI/CD — Vercel (frontend) + Render (backend) |
| `render.yaml` | Render Blueprint for backend deployment |

---

## State Management Pattern

The app uses **Zustand** for global state. Each data type follows the same pattern:

```
Store State
  ├─▶ Component subscribes via useAppStore(selector)
  ├─▶ User action → store action
  │     ├─▶ IndexedDB write (offline-safe)
  │     └─▶ set() → subscribers re-render
  └─▶ Background sync → Supabase write (eventual)
```

### Why not React Query / TanStack Query?

The **Offline-First** requirement means every write must succeed without network. React Query's cache-first pattern is designed for server-state where the server is authoritative. Here, the **local IndexedDB is authoritative** — the server is secondary. Zustand's simple `set()` + manual persistence pattern gives full control over when and how data syncs.

---

## Sync Queue Types

The `sync_queue` IndexedDB store holds pending operations. Types:

| type | Processed by | Action |
|---|---|---|
| `upsert` | `performSync()` | `supabase.from('time_entries').upsert()` |
| `delete` | `performSync()` | `supabase.from('time_entries').delete()` |
| `location_upsert` | `performSync()` | `supabase.from('locations').upsert()` |
| `location_delete` | `performSync()` | `supabase.from('locations').delete()` |
| `expenses_sync` | `performSync()` | `supabase.from('daily_expenses').delete().insert()` |

### Realtime — the incoming direction

The `sync_queue` covers **outgoing** changes (device → cloud, polled every 30s). Supabase **Realtime** covers the **incoming** direction (cloud → device): when another device writes to a subscribed table, `postgres_changes` events stream back over a websocket and the UI updates immediately — no 30s interval, no app restart.

| Table | Migration | Channel | Subscription function |
|---|---|---|---|
| `expense_photos` | `006_expense_photos_realtime.sql` | `expense-photos-${userId}` | `subscribeExpensePhotoChanges()` |
| `daily_expenses` | `007_daily_expenses_realtime.sql` | `daily-expenses-${userId}` | `subscribeDailyExpenseChanges()` |
| `user_favorites` | `008_user_favorites_realtime.sql` | `favorites-${userId}` | `subscribeFavoriteChanges()` |

**Prerequisites (both migrations):**

1. **Publication membership** — the table is added to the `supabase_realtime` publication (idempotent `DO` block in the migration). Without this, no `postgres_changes` events are emitted.
2. **`REPLICA IDENTITY FULL`** — DELETE payloads carry all columns (`user_id` + `year`/`week`, resp. `date`/`expense_type`), so events can be attributed to the right user and applied directly. (Default `REPLICA IDENTITY` only sends the primary key on DELETE.)

**Lifecycle** — subscriptions live in the store, tied to the auth session:

- `initialize(userId)` → subscribes after the initial data load
- `setUser(null)` → unsubscribes + clears any pending debounce timers

Each channel is filtered with `user_id=eq.<userId>` (RLS-friendly), so only the signed-in user's own rows trigger callbacks.

### DELETE special-case (why events aren't just "reload the week")

A naive "reload after every event" would **resurrect** rows the remote deleted: the load-and-merge logic deliberately preserves local-only rows. So the handlers treat DELETE as authoritative and apply it directly:

| Table | INSERT / UPDATE | DELETE |
|---|---|---|
| `expense_photos` | 300ms debounce → `loadExpensePhotos(year, week, force=true)` (full week reload + merge) | Direct removal from store **and** IndexedDB (`localDb.deleteExpensePhoto(id)`) — cannot resurrect on the next merge |
| `daily_expenses` | Direct row upsert on the `(date, expense_type)` key (no reload — the sync is full-replace, a reload would fight the merge) | Direct removal of the `expense_type` from that date's array (store + debounced IndexedDB persist) |
| `user_favorites` | Direct upsert (payload carries every column; `use_count` kept at the max) + top-5 refresh | Direct removal from store + IndexedDB (`localDb.removeFavoriteLocation`) — cannot resurrect on the next merge |

---

## Language Support

Translations in `lib/translations.ts` use a dictionary pattern:

```typescript
type Language = 'de' | 'fr' | 'it' | 'hu' | 'en'  // German, French, Italian, Hungarian, English

translations: Record<string, Record<Language, string>>
```

Components use the `useTranslation()` hook:

```tsx
const { t } = useTranslation()
return <span>{t('entry.beginn')}</span>
```

Language is persisted in localStorage and synced to the Supabase profile for cross-device consistency.

---

## Mobile / Android

The app is wrapped with **Capacitor** for native Android access:

- **GPS**: Geolocation API for zone calculation
- **Notifications**: Local push notifications (Monday reminder)
- **APK build**: `npx cap sync android && cd android && ./gradlew assembleDebug`

---

## Infrastructure & Deployment

### CI/CD Pipeline

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  GitHub Push     │     │  GitHub Actions   │     │   Deploy Targets │
│  main / master   │ ──▶ │  (CI/CD)          │ ──▶ │                  │
└──────────────────┘     │                  │     │  ┌────────────┐  │
                         │  ┌────────────┐  │     │  │  Vercel    │  │
                         │  │ Frontend   │──├─────│──▶ (PWA)      │  │
                         │  │ tsc + vite │  │     │  └────────────┘  │
                         │  └────────────┘  │     │                  │
                         │  ┌────────────┐  │     │  ┌────────────┐  │
                         │  │ Backend    │  │     │  │  Render    │  │
                         │  │ py + deps  │──├─────│──▶ (API)      │  │
                         │  └────────────┘  │     │  └────────────┘  │
                         │  ┌────────────┐  │     │                  │
                         │  │ Deploy     │  │     │  ┌────────────┐  │
                         │  │ Vercel     │──├─────│──▶  APK (GitHub│  │
                         │  │ + Render   │  │     │  │  Releases) │  │
                         │  └────────────┘  │     │  └────────────┘  │
                         └──────────────────┘     └──────────────────┘
```

**Workflow:** `.github/workflows/deploy.yml`

| Step | Job | Action |
|---|---|---|
| 1️⃣ | `frontend` | `npm ci` → `npm run build` (TypeScript check + Vite build + PWA manifest) |
| 2️⃣ | `backend` | `pip install -r requirements.txt` → Verify Python imports |
| 3️⃣ | `deploy-frontend` | `vercel deploy --prod` — pushes `apps/web/dist` to Vercel |
| 4️⃣ | `deploy-backend` | `curl -X POST $RENDER_DEPLOY_HOOK_URL` — triggers Render deploy hook |
| 5️⃣ | `notify` | Prints deployment summary with URLs |

The workflow runs on every push to `main`/`master`. The `deploy-frontend` and `deploy-backend` jobs depend on their respective build/check jobs, so only if the build passes does a deploy happen.

---

### Production URLs

| Service | URL | Notes |
|---|---|---|
| **Frontend (Vercel)** | `https://otis-wochenrapport.vercel.app` | Auto-deployed on push to `main` |
| **Backend (Render)** | `https://otis-wochenrapport.onrender.com` | Cold-start ~15s on free tier |
| **Backend Health** | `https://otis-wochenrapport.onrender.com/health` | Returns `{"status":"healthy"}` |
| **Supabase** | Configured via `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` env vars | Separate project in EU region |

---

### Docker Setup

Two Dockerfiles for local development and production consistency.

#### Frontend (`apps/web/Dockerfile`)

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY . .
RUN npm ci
CMD ["npx", "vite", "--host", "0.0.0.0", "--port", "5173"]
```

- **Dev mode**: Hot-reload via volume mounts (`/app/src`, `/app/public`)
- **Production**: Built via Vercel CI (separate `vite build` step)
- **Port**: 5173

#### Backend (`apps/backend/Dockerfile`)

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY src/ ./src/
COPY templates/ ./templates/
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

- **Slim image**: No C-ext deps needed (pure Python — openpyxl removed in favour of raw XML)
- **Dev mode**: Hot-reload via `uvicorn --reload` + volume mount
- **Port**: 8000

#### docker-compose.yml

```yaml
services:
  frontend:
    build: ./apps/web
    ports: ["5173:5173"]
    volumes: [./apps/web/src:/app/src, ...]  # HMR support
    depends_on: [backend]

  backend:
    build: ./apps/backend
    ports: ["8000:8000"]
    env_file: ./apps/backend/.env
    command: uvicorn src.main:app --reload
    volumes: [./apps/backend/src:/app/src, ./apps/backend/templates:/app/templates]
```

**Start:** `docker compose up -d` (from project root)
**Stop:**  `docker compose down`

---

### Environment Variables

#### Frontend (`apps/web/.env`)

| Variable | Required | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | ✅ Yes | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | ✅ Yes | Supabase anonymous key |
| `VITE_RENDER_URL` | No | Backend URL (default: `http://localhost:8000`) |

#### Backend (`apps/backend/.env`)

| Variable | Required | Description |
|---|---|---|
| `SUPABASE_URL` | No | Supabase URL (for server-side fetches) |
| `SUPABASE_SERVICE_KEY` | No | Supabase service role key (for server-side fetches) |
| `FRONTEND_URL` | No | CORS allowlist (default: `http://localhost:5173`) |
| `PORT` | No | Server port (default: `8000`, Render sets this automatically) |

#### GitHub Secrets (for CI/CD)

| Secret | Where to get it |
|---|---|
| `VERCEL_TOKEN` | Vercel Dashboard → Settings → Tokens |
| `VERCEL_ORG_ID` | Vercel CLI: `vercel whoami` → org ID from `~/.vercel/config.json` |
| `VERCEL_PROJECT_ID` | Vercel CLI: `vercel link` → `~/.vercel/project.json` |
| `RENDER_DEPLOY_HOOK_URL` | Render Dashboard → otis-wochenrapport-api → Deploy Hooks → Create Hook |

---

### Backend API Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Health check (used by Render monitoring) |
| `POST` | `/generate-excel` | Generate OTIS Wochenrapport `.xlsx` — accepts `GenerateRequest` JSON body, returns binary file |
| `POST` | `/send-email` | Generate Excel + send via email (requires SMTP config) |

Both Excel endpoints accept entry data directly or can fetch from Supabase using `user_id` + `week_number`. The PWA's offline generator (`services/offlineGenerator.ts`) mirrors this logic client-side.

---

### Render Blueprint (render.yaml)

A `render.yaml` file at the project root defines the backend service for Render's Blueprint deployment (infrastructure-as-code). The GitHub Action trigger (deploy hook) provides a lighter-weight alternative.

---

##  Made with Freebuff — Codebuff 🤖
