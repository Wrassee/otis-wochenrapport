# Contributing to OTIS Wochenrapport

Welcome! This guide explains how to extend the application following the established architecture patterns. First read [ARCHITECTURE.md](./ARCHITECTURE.md) for the full system overview — this guide assumes familiarity with the three-layer model.

---

## Quick Start

```bash
# Install frontend dependencies
cd apps/web && npm install

# Install backend dependencies (Python)
cd apps/backend && pip install -r requirements.txt

# Start everything (frontend + backend concurrently)
cd apps/web && npm run dev

# Or with Docker for backend isolation
docker compose up -d
```

**Prerequisites:** Node.js 22+, Python 3.12+, Docker (optional).

---

## Development Commands

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server (port 5173) + Python backend (port 8000) |
| `npm run build` | TypeScript check + Vite production build |
| `npm run lint` | oxlint |
| `npm run preview` | Preview production build locally |
| `cd android && ./gradlew assembleDebug` | Build Android APK |
| `npx cap sync android` | Sync web build to Android project |

---

## Project Structure (the 7 layers)

```
apps/web/src/
├── pages/         # Route-level page components (Layer 3 — UI)
├── components/    # Reusable UI (Layer 3 — UI)
│   ├── ui/        #   Base kit: Card, Button, BottomSheet, Input...
│   ├── daily/     #   Erfassung page: TimeEntryForm, ActivityPicker...
│   ├── weekly/    #   Woche page: WeekOverview, DayCard, ExpenseEditor...
│   ├── auth/      #   Login/Register/ProfileSetup
│   └── export/    #   ExportSummary
├── hooks/         # React hooks (Layer 2 — bridge)
├── stores/        # Zustand store (Layer 3 — state)
├── db/            # IndexedDB + Supabase + sync orchestrator
├── lib/           # Pure utilities, types, translations (Layer 1)
│   ├── syncExpenses.ts   # 🏆 Example: pure function layer
│   ├── types.ts           # All TypeScript interfaces
│   ├── translations.ts    # DE/FR/IT/HU dictionary
│   ├── utils.ts           # Time math, Haversine, formatters
│   └── ...
└── services/      # Offline Excel generator
```

---

## How to Add a New Component

### 1. Base UI Component (e.g., a new `Toggle`)

```tsx
// components/ui/Toggle.tsx
import { cn } from '@/lib/cn'

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
}

export function Toggle({ checked, onChange, label }: ToggleProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        'w-12 h-7 rounded-full transition-all duration-200',
        checked
          ? 'bg-otis-500 shadow-sm'
          : 'bg-gray-200 dark:bg-otis-800'
      )}
    >
      <div className={cn(
        'w-5 h-5 rounded-full bg-white shadow transition-transform duration-200',
        checked ? 'translate-x-6' : 'translate-x-1'
      )} />
      {label && <span>{label}</span>}
    </button>
  )
}
```

**Rules:**
- Use `cn()` for conditional Tailwind classes
- Accept standard props (`className` via `cn()`)
- Use `glass` / `glass-dark` / `glass-input` CSS classes for the glassmorphism theme
- Support dark mode via `dark:` prefix

### 2. Feature Component (e.g., a new `DaySummaryCard`)

```tsx
// components/weekly/DaySummaryCard.tsx
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { useTranslation } from '@/lib/useTranslation'

interface DaySummaryCardProps {
  date: string
  totalHours: number
  isValid: boolean
}

export function DaySummaryCard({ date, totalHours, isValid }: DaySummaryCardProps) {
  const { t } = useTranslation()
  return (
    <Card variant={isValid ? 'default' : 'danger'}>
      {/* ... use t('some.key') for all user-facing text ... */}
    </Card>
  )
}
```

**Rules:**
- Use `useTranslation()` for all user-facing text
- Follow the naming convention: existing patterns are `*Card`, `*Form`, `*Picker`, `*Editor`

---

## How to Add a New Hook (Three-Layer Pattern)

This is the most important pattern. Always think in three layers.

### 🏆 Example: Adding a new data domain "Holidays"

#### Layer 1 — Pure function (`lib/`)

Pure utility that does ONE thing. No React, no Zustand.

```ts
// lib/syncHolidays.ts
import { addToSyncQueue } from '@/db/indexeddb'

let timer: ReturnType<typeof setTimeout> | null = null

export function syncHolidays(holidays: Holiday[], userId: string) {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    timer = null
    addToSyncQueue({ type: 'holidays_sync', userId, holidays })
  }, 2000)
}
```

**Why:** Testable in isolation, callable from anywhere (service workers, events, timeouts).

#### Layer 2 — React Hook (`hooks/`)

Bridges the store and the pure lib layer.

```ts
// hooks/useHolidays.ts
import { useCallback, useEffect } from 'react'
import { useAppStore } from '@/stores/appStore'
import * as localDb from '@/db/indexeddb'
import { syncHolidays } from '@/lib/syncHolidays'

export function useHolidays(year: number) {
  const { holidays, setHolidays } = useAppStore()

  // Auto-load on mount / year change
  useEffect(() => {
    localDb.getHolidays(year).then(setHolidays)
  }, [year])

  // Mutation + auto-sync
  const addHoliday = useCallback((h: Holiday) => {
    localDb.saveHoliday(h)
    setHolidays(...)
    syncHolidays([h], userId)
  }, [])

  return { holidays, addHoliday }
}
```

**Why:** Components get a clean API. No need to know about IndexedDB, sync queues, or store internals.

#### Layer 3 — Store + Component

```ts
// In appStore.ts — just the state + basic actions
interface AppState {
  holidays: Holiday[]
  setHolidays: (h: Holiday[]) => void
}
```

```tsx
// In a page component
function HolidaysPage() {
  const { holidays, addHoliday } = useHolidays(2026)
  return <div>{holidays.map(h => <p key={h.id}>{h.name}</p>)}</div>
}
```

### When do you need all three layers?

| You're adding... | Layer 1 (lib) | Layer 2 (hook) | Layer 3 (store) |
|---|---|---|---|
| A new sync operation | ✅ `lib/syncX.ts` | ❌ Optional | ✅ Store action |
| A new UI component | ❌ | ❌ | ✅ Just the component |
| A new data domain | ✅ Pure CRUD | ✅ `useX` hook | ✅ State + actions |
| A new translation | ❌ | ❌ | Add to `translations.ts` |

---

## How to Add a New Data Domain (Full Example)

### Step 1: Types (`lib/types.ts`)

```ts
export interface Holiday {
  id: string
  user_id: string
  date: string
  name: string
  synced: boolean
  created_at: string
}
```

### Step 2: IndexedDB operations (`db/indexeddb.ts`)

```ts
export async function saveHoliday(holiday: Holiday): Promise<void> {
  const db = await getDb()
  await db.put('holidays', holiday)
  await db.add('sync_queue', { type: 'holiday_upsert', entryId: holiday.id })
}
```

(Or add to the existing store upgrade in `getDb()` if you need a new object store.)

### Step 3: Store state + actions (`stores/appStore.ts`)

```ts
interface AppState {
  holidays: Holiday[]
  setHolidays: (holidays: Holiday[]) => void
  addHoliday: (holiday: Omit<Holiday, 'id' | 'synced' | 'created_at'>) => Promise<void>
}
```

### Step 4: Pure sync function (`lib/syncHolidays.ts`)

Pure function, module-level debounce timer, no store dependency.

### Step 5: Hook (`hooks/useHolidays.ts`)

Bundles subscription + mutations + sync.

### Step 6: Component that uses the hook

Just calls `useHolidays()` and uses the returned values/actions.

---

## How to Add a New Page / Route

### 1. Create the page component

```tsx
// pages/HolidaysPage.tsx
export function HolidaysPage() {
  // ...
}
```

### 2. Add the route in `App.tsx`

```tsx
import { HolidaysPage } from './pages/HolidaysPage'
// <Route path="/holidays" element={<HolidaysPage />} />
```

### 3. Update the bottom navigation in `AppShell.tsx`

Add a nav item to the `navItems` array. Use a translation key (add it to `lib/translations.ts` first).

---

## Translation Guide

All user-facing text lives in `lib/translations.ts`. The dictionary maps keys to four languages:

```ts
'holiday.title': { de: 'Urlaub', fr: 'Vacances', it: 'Vacanze', hu: 'Szabadság' },
```

To use in a component:

```tsx
const { t } = useTranslation()
return <h1>{t('holiday.title')}</h1>
```

For dynamic values:

```tsx
t('holiday.count', { n: holidays.length })
// In translations: 'holiday.count': { de: '{n} Urlaubstage', ... }
```

**Always add translations for all four languages** (DE, FR, IT, HU). Use German as the reference, then translate using tools or native speakers.

---

## Code Style

### TypeScript

- **Strict mode** is enabled (`tsconfig.json` → `"strict": true`)
- Prefer `type` over `interface` for props (except exported interfaces)
- Use `as const` for literal union types
- No `any` — use `unknown` and narrow with type guards

### React

- Functional components only (no class components)
- Use `useCallback` / `useMemo` for stable references passed to child components
- Use Zustand's `useAppStore()` for global state (not prop drilling)
- Use `useTranslation()` for text (not hardcoded strings)

### Zustand Selectors (infinite-loop prevention)

Zustand v5 subscribes via `useSyncExternalStore`, which compares the selector
result with `Object.is` on every render. **A selector that returns a fresh
object/array reference on each render causes `Maximum update depth exceeded`
→ white screen.** Always return a stable reference and derive values OUTSIDE
the selector:

```ts
// ❌ NEVER — while the week isn't loaded, `|| []` creates a new array every
//    render, so every snapshot looks "changed" → infinite render loop.
const photos = useAppStore((s) => s.expensePhotos[getWeekKey(year, week)] || [])

// ✅ Select the stable map reference, derive the array in the component body.
//    Reactivity is preserved: the map gets a new reference when it changes.
const expensePhotos = useAppStore((s) => s.expensePhotos)
const photos = expensePhotos[getWeekKey(year, week)] || []
```

| Selector returns... | Safe? | Notes |
|---|---|---|
| Primitive (`string`/`number`/`boolean`) | ✅ | e.g. `s.isAuthenticated`, `s.language` |
| Stored reference, no derivation | ✅ | e.g. `s.syncStatus`, `s.expensePhotos`, `s.user` — the stored object/map/array reference only changes when `set()` replaces it |
| Store action (function) | ✅ | defined once inside `create()` |
| Derived value (`arr.map/filter`, `|| fallback`, object literal, `[a, b]`) | ❌ | fresh reference per render → infinite loop |

**Need multiple values in one call?** Use `useShallow` from
`zustand/react/shallow`. It caches the last selector result and returns the
previous (stable) reference whenever the new result is shallow-equal — so an
object-literal selector like the one below neither re-renders on unrelated
store updates nor triggers an infinite loop. The "derive outside the
selector" rule still applies when derived values change identity on every
render (e.g. `.map(e => ({ ...e }))` creating new objects — shallow
comparison can't deduplicate those):

```ts
import { useShallow } from 'zustand/react/shallow'

const { theme, language } = useAppStore(useShallow((s) => ({ theme: s.theme, language: s.language })))
```

### Flags (language selector icons)

Language flags are rendered as **inline SVG** in `components/ui/Flag.tsx` —
**never as flag emoji** (🇩🇪/🇫🇷/…). Flag emoji render natively on Android but
NOT on Windows desktop Chrome/Firefox (the OS font has no flag glyphs), which
caused blank language pills on the web. SVG renders identically on every
platform.

Supported codes (typed union `FlagCode`): `de fr it hu` (current app
languages) + `at ch gb` (pre-added for future language extensions).

**To add a new flag:**

1. Extend the `FlagCode` union in `Flag.tsx` (e.g. `| 'es'`).
2. Add one entry to the `FLAG_RENDERERS` record. The `Record<FlagCode, …>`
   type makes TypeScript fail the build if any code lacks a renderer — the
   compiler enforces completeness.
3. Use the country's **official colors**. For simple 3-stripe flags reuse the
   `Stripes` helper (`vertical` for left→right columns, e.g. FR/IT; default is
   top→bottom rows, e.g. DE/HU/AT). For complex patterns add a small renderer
   function (e.g. `SwissCross`, `UnionJack`) — all coordinates live in the
   24×16 viewBox.
4. Use it in components: `<Flag code="…" />` (or `<Flag code={lang.code} />`
   with a `Language` value).

Rules: no flag emoji in UI code; official color values; keep `aria-hidden`
on the decorative SVG (the adjacent text label carries the meaning).

### CSS / Tailwind

- Use `cn()` utility for conditional class merging
- Use `glass`, `glass-dark`, `glass-input` CSS classes for the glassmorphism theme
- Use `otis-*` color palette for OTIS branding
- Support dark mode with `dark:` prefix on every color class
- Respect the minimum touch target: `min-h-[48px]` for interactive elements

### Naming Conventions

| Thing | Pattern | Example |
|---|---|---|
| Component file | PascalCase | `TimeEntryForm.tsx` |
| Hook file | camelCase with `use` prefix | `useDailyExpenses.ts` |
| Lib file | camelCase | `syncExpenses.ts` |
| Store file | camelCase | `appStore.ts` |
| CSS class | kebab-case | `glass-dark` |
| Translation key | dot-separated section | `entry.beginn.hint` |

---

## Error Handling Patterns

### Offline-first operations

```ts
try {
  await localDb.saveEntry(entry)   // Always succeeds locally
  set(...)                          // Optimistic UI update
  // Sync happens in background — no await needed
} catch (err) {
  // Local IndexedDB write should never fail, but if it does:
  console.error('Critical: local save failed', err)
}
```

### Network operations (optional, best-effort)

```ts
if (navigator.onLine) {
  try {
    await supabase.from('...').upsert(data)
  } catch {
    // Silently fail — local data is the source of truth
  }
}
```

---

## PR Workflow

1. **Create a branch** from `main`: `git checkout -b feat/my-feature`
2. **Make changes** following the patterns above
3. **TypeScript check**: `cd apps/web && npm run build` (runs `tsc -b`)
4. **Lint**: `npm run lint`
5. **Test on mobile**: Build APK via `cd android && ./gradlew assembleDebug`
6. **Commit**: Use clear commit messages (German or English)
7. **Push + PR**: Open a PR to `main`

---

## Need Help?

- Read [ARCHITECTURE.md](./ARCHITECTURE.md) for the full system overview
- Look at the `useDailyExpenses` / `useTimeEntries` hooks as reference implementations of the three-layer pattern
- Check `lib/syncExpenses.ts` for the pure-function layer pattern
- Search for existing patterns: keyboard shortcuts in VS Code: `Ctrl+P` → `#` search the codebase

---

*Last updated: July 2026*
