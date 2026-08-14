# Sentry beállítási útmutató (magyar)

Rövid, lépésről lépésre haladó útmutató a hibamonitorozás bekapcsolásához.
**Becsült idő: ~10–15 perc.** Az ingyenes Developer-csomag bőven elegendő.

---

## 1. Sentry fiók létrehozása

1. Nyisd meg a **[sentry.io](https://sentry.io)** oldalt → **Sign up** (GitHub-bal
   vagy e-maillel). Az ingyenes csomag automatikus, **nincs bankkártya**.
2. Hozz létre **két projektet** (a webes és a backend hibák külön kezelendők):
   - **`otis-web`** — platform: **React**
   - **`otis-backend`** — platform: **Python → FastAPI**
3. Minden projekthez másold ki a **DSN**-t:
   **Settings → Client Keys (DSN)** (vagy a projekt setup lapján). A DSN így
   néz ki: `https://<hash>@o<org>.ingest.sentry.io/<project>`
4. *(Opcionális, source map feltöltéshez)* Hozz létre egy API tokent:
   **Settings → Auth Tokens → Create New Token** — jogosultságok:
   `project:write`, `project:releases:write` (ez a minimum).

---

## 2. Vercel (frontend)

**Projekt → Settings → Environment Variables → Add New:**

| Változó | Érték | Sensitive jelölés? |
|---|---|---|
| `VITE_SENTRY_DSN` | az **otis-web** DSN-je | ❌ **NEM** |
| `SENTRY_AUTH_TOKEN` | az 1.4-es token | ❌ **NEM** |
| `SENTRY_ORG` | szervezet neve (pl. `otis`) | ❌ NEM |
| `SENTRY_PROJECT` | `otis-web` | ❌ NEM |

> ⚠️ **Fontos — egyik változót se jelöld „Sensitive"-nak!**
> A Vercel Sensitive-jelölés `[SENSITIVE]`-re cseréli az értéket a buildben:
> - a `VITE_SENTRY_DSN` hibásan kerülne a bundle-be → **fehér képernyő** (a
>   korábbi Supabase-incidens ugyanez volt),
> - a `SENTRY_AUTH_TOKEN` nem tudná feltölteni a source map-eket.
>
> Ha a team-en be van kapcsolva az **„Enforce Sensitive Environment
> Variables"** házirend (Settings → Security & Privacy → Environment Variable
> Policies), kapcsold ki — különben minden automatikusan Sensitive lesz.
>
> A token **csak a build-folyamatban él, soha nem kerül a böngészőbe**; a
> publikus bundle-ben egyedül a DSN van benne, ami amúgy is publikus.

---

## 3. Render (backend)

**Backend service → Environment → Add:**

| Változó | Érték |
|---|---|
| `SENTRY_DSN` | az **otis-backend** DSN-je |

A `RENDER` env var (amit a Render automatikusan beállít) gondoskodik arról,
hogy az események `production` környezetként kerüljenek be a Sentry-be.

---

## 4. Deploy + ellenőrzés

1. **Deploy:** push egy commitot a main-re (a CI így a Vercel + Render
   deployot és az `apk-latest` draftot is frissíti), vagy kézi Redeploy.
2. **Source map ellenőrzés:** a Vercel build logjában keresd a
   **„Sentry: Uploading source maps…"** sort. Ha nincs, a token/org/project
   beállítás hibás.
3. **Hiba-küldés teszt:** a Sentry projekt **Setup** lapján a
   **„Send test event"** gomb — vagy egyszerűen használd az appot: bármelyik
   elkapott hiba (pl. egy lefagyott oldal az ErrorBoundary-jel) automatikusan
   bekerül.
4. **Éles ellenőrzés:** Sentry dashboard → **Issues**: itt kell megjelenniük
   az eseményeknek, a **Release** mezőben a git commit SHA-val (source map
   esetén stack trace helyett eredeti forráskód látszik).

---

## 5. Hasznos tippek

- **Ingyenes keret:** 5 000 hiba-esemény / hó — egy technikusi csapatnak
  bőven elég (a hasonló hibák egy csoportba vannak vonva).
- **Kikapcsolás:** ha nem kell, csak töröld a `VITE_SENTRY_DSN` / `SENTRY_DSN`
  változókat — a kód DSN nélkül teljesen kikapcsol, nulla költség és nulla
  bundle-növekedés (a Rollup kitree-shake-eli a könyvtárat).
- **Ki látja:** csak neked kell Sentry-fiók — a technikusoknak nem kell
  belépniük, ők csak küldik a hibákat, te nézed a dashboardot.
