import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, type Page } from '@playwright/test'

/** Throwaway E2E account — created in global-setup, removed in global-teardown. */
export const E2E_EMAIL = 'e2e.test@otis.local'
export const E2E_PASSWORD = 'E2E-Test-Pass-2026!'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url))) // apps/web

/** Load key=value pairs from a .env file (no interpolation, quotes stripped). */
function parseEnvFile(file: string): Record<string, string> {
  const out: Record<string, string> = {}
  if (!existsSync(file)) return out
  for (const rawLine of readFileSync(file, 'utf8').split(/\r?\n/)) {
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

/** Precedence: process env > apps/web/.env > apps/backend/.env */
export function loadEnv(): Record<string, string> {
  const web = parseEnvFile(path.join(ROOT, '.env'))
  const backend = parseEnvFile(path.join(ROOT, '../backend/.env'))
  return { ...backend, ...web, ...process.env }
}

/** Supabase admin API helpers (service key bypasses RLS). */
export async function supabaseAdminRequest(
  method: 'GET' | 'POST' | 'DELETE',
  pathname: string,
  body?: unknown,
) {
  const env = loadEnv()
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_KEY || env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_KEY missing for E2E setup')
  const res = await fetch(`${url}${pathname}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  return res
}

/** Create the throwaway user (idempotent). Returns the user id. */
export async function ensureTestUser(): Promise<string> {
  const created = await supabaseAdminRequest('POST', '/auth/v1/admin/users', {
    email: E2E_EMAIL,
    password: E2E_PASSWORD,
    email_confirm: true,
  })
  if (created.ok) {
    const json = (await created.json()) as { id: string }
    return json.id
  }
  // 409 = already exists → look it up.
  const list = await supabaseAdminRequest(
    'GET',
    `/auth/v1/admin/users?filter=email=eq.${encodeURIComponent(E2E_EMAIL)}`,
  )
  const json = (await list.json()) as { users?: { id: string }[] }
  const user = json.users?.find((u) => u.id)
  if (!user) throw new Error(`Cannot create or find E2E user: ${created.status}`)
  return user.id
}

/** Remove the throwaway user AND its data rows (idempotent). */
export async function removeTestUser(userId: string) {
  const env = loadEnv()
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_KEY || env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return

  // Data rows first (auth user deletion cascades to `profiles` only).
  const tables = ['time_entries', 'daily_expenses', 'expense_photos', 'user_favorites']
  for (const table of tables) {
    await supabaseAdminRequest('DELETE', `/rest/v1/${table}?user_id=eq.${userId}`)
  }
  await supabaseAdminRequest('DELETE', `/auth/v1/admin/users/${userId}`)
}

/** Log in through the UI with the throwaway account (German UI). */
export async function loginAsTestUser(page: Page) {
  await page.goto('/login')
  await page.locator('#login-email').fill(E2E_EMAIL)
  await page.locator('#login-password').fill(E2E_PASSWORD)
  await page.getByRole('button', { name: 'Anmelden' }).click()
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 })
  // Wait for the app shell to be interactive.
  await expect(page.getByText('Rapport Assistent').first()).toBeVisible()
}

/** Force the German UI for stable selectors, before the app boots. */
export function forceGerman(page: Page) {
  page.addInitScript(() => localStorage.setItem('otis_language', 'de'))
}
