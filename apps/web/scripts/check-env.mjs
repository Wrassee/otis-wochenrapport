#!/usr/bin/env node
/**
 * Pre-build environment validator (Vite).
 *
 * Vite inlines every VITE_* variable into the client bundle at build time.
 * If a variable is missing, empty, or (on Vercel) marked "Sensitive" — in
 * which case the build receives the literal placeholder `[SENSITIVE]` — the
 * shipped app is broken (e.g. a white screen because createClient() throws
 * "Invalid supabaseUrl" at module load).
 *
 * This script runs before every production build and fails fast so a bad
 * configuration can never silently go live again.
 *
 * Usage:
 *   npm run check:env          # validate (part of `npm run build`)
 *   npm run check:env -- --skip   # or SKIP_ENV_CHECK=1 to bypass
 *
 * Exit code 0 = OK, 1 = at least one hard error.
 */

import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const skip = process.argv.includes('--skip') || process.env.SKIP_ENV_CHECK === '1'
if (skip) {
  console.log('ℹ️  check:env skipped (--skip / SKIP_ENV_CHECK=1)')
  process.exit(0)
}

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url))) // apps/web

// GitHub Actions sets CI=true + GITHUB_ACTIONS=true. In CI the repo checkout
// has no .env files (gitignored) and no process VITE_* vars, so the required
// values are EXPECTED to be missing — the CI build is a compile check only
// (the real production bundle is built by Vercel with its own env, and the
// APK job below receives the values from repo secrets). Missing required
// values become warnings there instead of hard failures; placeholders and
// invalid values still fail everywhere.
const isCi = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true'

// ── Load .env files with Vite precedence (lowest → highest) ────────────────
const envFiles = ['.env', '.env.local', '.env.production', '.env.production.local']

function parseEnvFile(file) {
  const p = path.join(root, file)
  if (!existsSync(p)) return {}
  const out = {}
  for (const rawLine of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    let value = line.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    out[line.slice(0, eq).trim()] = value
  }
  return out
}

const merged = {}
for (const f of envFiles) Object.assign(merged, parseEnvFile(f))
// Real process env (CI runners, Vercel build injection) always wins.
for (const [k, v] of Object.entries(process.env)) {
  if (k.startsWith('VITE_')) merged[k] = v
}

// ── Rules ──────────────────────────────────────────────────────────────────
// Placeholder values that must NEVER reach the bundle. `[SENSITIVE]` is what
// Vercel substitutes when an env var is marked Sensitive; `[REDACTED]` is the
// build-log redaction form.
const PLACEHOLDERS = ['[SENSITIVE]', '[REDACTED]', 'YOUR_SUPABASE_URL', 'YOUR_SUPABASE_ANON_KEY']

const RULES = {
  VITE_SUPABASE_URL: { required: true, kind: 'url' },
  VITE_SUPABASE_ANON_KEY: { required: true, kind: 'key' },
  VITE_RENDER_URL: { required: false, kind: 'url' },
}

const errors = []
const warnings = []

for (const [name, rule] of Object.entries(RULES)) {
  const value = (merged[name] ?? '').trim()

  if (PLACEHOLDERS.includes(value)) {
    errors.push(
      `${name} is set to the placeholder "${value}". ` +
        (value === '[SENSITIVE]'
          ? 'On Vercel: remove the variable and re-add it with the "Sensitive" toggle OFF — VITE_* values must be visible to the build so Vite can inline them into the bundle.'
          : 'Set the real value in .env / Vercel Environment Variables.'),
    )
    continue
  }

  if (!value) {
    if (rule.required) {
      if (isCi) {
        warnings.push(
          `${name} is missing in CI (no .env, no process env) — compile-only check, skipping the hard requirement.`,
        )
      } else {
        errors.push(
          `${name} is missing or empty. The app cannot boot without it. Set it in .env / Vercel Environment Variables.`,
        )
      }
    } else {
      warnings.push(
        `${name} is missing or empty — the export falls back to http://localhost:8000 (fine locally, wrong in production).`,
      )
    }
    continue
  }

  if (rule.kind === 'url' && !/^https?:\/\/\S+$/.test(value)) {
    errors.push(`${name} is not a valid HTTP(S) URL: "${value.slice(0, 80)}"`)
  }

  // Classic copy-paste trap: the Supabase dashboard shows the REST endpoint
  // (…/rest/v1) — pasting THAT as the base URL makes the SDK double the path
  // (…/rest/v1/rest/v1/…) and every request 404s. The code strips it, but
  // warn so the dashboard value can be fixed at the source.
  if (name === 'VITE_SUPABASE_URL' && /\/rest\/v1\/?$/.test(value)) {
    warnings.push(
      `${name} ends with "/rest/v1" — the SDK appends that itself. Use the base URL without the suffix (e.g. https://xxx.supabase.co).`,
    )
  }
}

// ── Report ──────────────────────────────────────────────────────────────────
for (const w of warnings) console.warn(`⚠️  ${w}`)
if (errors.length) {
  console.error(`\n❌ check:env failed — ${errors.length} error(s):\n`)
  for (const e of errors) console.error(`   • ${e}`)
  console.error(`\nFix the configuration above, then re-run the build.`)
  console.error(`(Bypass with: npm run check:env -- --skip)`)
  process.exit(1)
}

console.log(`✅ check:env OK — ${Object.keys(RULES).length} VITE_* variables valid`)
