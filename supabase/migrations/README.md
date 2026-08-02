# Supabase Migrations — OTIS Wochenrapport

Az összes adatbázis-objektum (táblák, indexek, RLS-policy-k, realtime-bekötés) ebben a mappában él. A migrációkat a **Supabase Dashboard → SQL Editor**-ban kell futtatni, számozási sorrendben.

## ⚡ Gyors útmutató (futtatási sorrend)

Futtasd mind a 9 fájlt **növekvő sorrendben**:

```text
001_init.sql                    ← alapséma (profilok, helyek, időkódok, időbejegyzések)
002_favorites.sql               ← kedvenc/utoljára használt liftek + REALTIME bekötés
003_expenses.sql                ← napi költségek (Spesen) + REALTIME bekötés
004_expense_photos.sql          ← számlafotók (Belege) + REALTIME bekötés
005_expense_photo_notes.sql     ← megjegyzés oszlop a fotókhoz
006_expense_photos_realtime.sql ← fotó-realtime (idempotens, általában no-op)
007_daily_expenses_realtime.sql ← költség-realtime (idempotens, általában no-op)
008_user_favorites_realtime.sql ← kedvenc-realtime (idempotens, általában no-op)
009_locations_write_policies.sql ← locations INSERT/UPDATE RLS-policy (kézi lift-szinkron)
```

> **💡 Egy fájl = egy futtatás.** Minden fájl teljes tartalmát másold be a SQL Editorba, és futtasd le. Ha egy fájl hibát dob, ne folytasd a következővel, amíg meg nem értetted az okot — a függőségek miatt a korábbi lépések nélkül a későbbiek elhasalhatnak.

## 📋 Migrációs mátrix

| # | Fájl | Mit csinál? | Idempotens? | Order-safe? |
|---|---|---|---|---|
| 001 | `001_init.sql` | `profiles`, `locations`, `activity_codes`, `time_entries`, `user_settings` táblák + indexek + RLS + seed adatok (24 tevékenységkód) + `update_updated_at_column()` trigger-függvény | ✅ | ✅ |
| 002 | `002_favorites.sql` | `user_favorites` tábla (kedvenc liftek, `UNIQUE(user_id, anlagenummer)`) + **realtime publikáció + REPLICA IDENTITY FULL** | ✅ | ✅ — mindig a 001 után, de a többihez képest szabad sorrendben |
| 003 | `003_expenses.sql` | `daily_expenses` tábla + RLS + trigger + **realtime publikáció + REPLICA IDENTITY FULL** | ✅ | ✅ |
| 004 | `004_expense_photos.sql` | `expense_photos` tábla (base64 `data_url` + `note`) + RLS + **realtime publikáció + REPLICA IDENTITY FULL** | ✅ | ✅ |
| 005 | `005_expense_photo_notes.sql` | `note` oszlop hozzáadása (`ADD COLUMN IF NOT EXISTS`) — csak a 004 korábbi verzióját futtatók miatt kell | ✅ | ✅ |
| 006 | `006_expense_photos_realtime.sql` | Fotó-realtime **biztosíték**: ha a 004 még nem kapcsolta be, itt bekapcsolja | ✅ | ✅ (tábla hiányában csendben kihagy) |
| 007 | `007_daily_expenses_realtime.sql` | Költség-realtime **biztosíték**: ha a 003 még nem kapcsolta be, itt bekapcsolja | ✅ | ✅ (tábla hiányában csendben kihagy) |
| 008 | `008_user_favorites_realtime.sql` | Kedvenc-realtime **biztosíték**: ha a 002 még nem kapcsolta be, itt bekapcsolja | ✅ | ✅ (tábla hiányában csendben kihagy) |
| 009 | `009_locations_write_policies.sql` | `locations` INSERT + UPDATE RLS-policy — a kézi/offline liftek felhőbe szinkronjához (`upsertLocation`); a 001 csak SELECT-et adott, ami nélkül minden lift-push `new row violates row-level security policy` hibát dob | ✅ idempotens (`DROP POLICY IF EXISTS` + `CREATE POLICY`) | ✅ |

**Jelmagyarázat:**

- **Idempotens** = nyugodtan újrafuttatható, nem dob hibát és nem duplikál adatot (minden `CREATE ... IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` / guard-elt `DO` blokk).
- **Order-safe** = akkor sem hibázik el, ha a normál sorrendtől eltérően fut (pl. a 006 a 004 előtt). A realtime-migrációk `to_regclass()` guardot használnak: ha a tábla még nem létezik, csendben kihagyják a lépést ahelyett, hogy `relation does not exist` hibát dobnának.

## 🔴 Realtime migrációk — amit tudni érdemes

A 002/003/004 és a 006/007/008 **ugyanazt a célt** szolgálják (a tábla bekerül a `supabase_realtime` publikációba + `REPLICA IDENTITY FULL`), csak **két különböző időpontban**:

| Mikor fut a realtime-bekötés? | Fájl |
|---|---|
| **Tábla létrehozásakor** (ajánlott út) | `002`, `003` és `004` |
| **Utólag, biztosítékként** (régi DB-kre) | `006`, `007` és `008` |

**Ezért sorrendtől független a végeredmény:**

```
004 előbb, 006 később:   004 létrehozza a táblát + bekapcsolja a realtime-ot → 006 no-op
006 előbb, 004 később:   006 csendben kihagy (tábla hiányzik) → 004 létrehozza + bekapcsolja
```

Mindkét irányban **helyes végállapot** jön létre — ez volt a célja annak a javításnak, amikor a `006` futtatása a `004` nélkül `42P01 relation "expense_photos" does not exist` hibát dobott.

### Mit jelent a REPLICA IDENTITY FULL?

Alapértelmezés szerint a Supabase Realtime **törlési (DELETE)** eseményekben csak az elsődleges kulcsot küldi el. A `REPLICA IDENTITY FULL` hatására a DELETE payload **minden oszlopot** tartalmaz (`user_id`, `year`/`week`, illetve `date`/`expense_type`), így a kliens:

1. a saját felhasználójához tudja rendelni az eseményt (a channel `user_id=eq.<userId>` szűrőt használ), és
2. a törlést **közvetlenül** tudja alkalmazni a store-ban (nem „feltámasztva" a merge-logika által).

⚠️ Mellékhatás: a DELETE payload mérete nagyobb lehet (a fotóknál a base64 `data_url` is benne van). A táblák felhasználónként kicsik, így ez elfogadható kompromisszum.

## 🧭 Hibaelhárítás

| Hiba | Ok | Megoldás |
|---|---|---|
| `relation "expense_photos" does not exist` a 006 futtatásakor | A `004` még nem futott (a tábla nem létezik). ⚠️ Ez a hiba a **korábbi, guard nélküli** 006-os verzióknál fordult elő — a jelenlegi fájlok `to_regclass` guarddal csendben kihagyják, nem hibáznak | Futtasd le a `004`-et, utána a `006` már no-op. **Vagy** csak a frissített `004`-et futtasd — az már bekapcsolja a realtime-ot is |
| `relation "daily_expenses" does not exist` a 007 futtatásakor | A `003` még nem futott. ⚠️ Ugyanaz: a jelenlegi 007 guard-elt, nem hibázik, csak kihagy | Futtasd a `003`-at (a frissített verzió a realtime-ot is bekapcsolja) |
| `relation "profiles" does not exist` | A `001` még nem futott | Minden más migráció a `profiles` táblára hivatkozik — a `001`-gyel kell kezdeni |
| A realtime nem érkezik meg az appba | A tábla nincs benne a `supabase_realtime` publikációban | Futtasd le a `006`/`007`/`008`-at (idempotens) vagy a frissített `002`/`003`/`004`-et |

## 🛠️ Új migráció hozzáadása

- Fájlnév: `NNN_leiras.sql` (sorszámozva, a meglévők után).
- **Minden** `CREATE TABLE` / `ALTER TABLE` legyen idempotens (`IF NOT EXISTS`).
- Ha új táblát vezetsz be **és** realtime-ot szeretnél: a realtime-bekötést tedd **ugyanabba a fájlba**, a tábla létrehozása után (így nem kell külön biztosíték-fájl).
- A `006`/`007`/`008` mintája (guard-elt `DO` blokk + `EXECUTE`-os `REPLICA IDENTITY`) követendő, ha egy meglévő táblához adsz realtime-ot utólag.
- Frissítsd ezt a README-et (mátrix + sorrend).
