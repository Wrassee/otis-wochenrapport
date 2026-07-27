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
