import { readFileSync, existsSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { removeTestUser } from './helpers'

const ROOT = path.dirname(fileURLToPath(import.meta.url))

/**
 * Removes the throwaway E2E account + all its data rows after the suite.
 */
export default async function globalTeardown() {
  const idFile = path.join(ROOT, '.e2e-user-id')
  if (!existsSync(idFile)) return
  const userId = readFileSync(idFile, 'utf8').trim()
  try {
    if (userId) await removeTestUser(userId)
    console.log(`[e2e] test user removed: ${userId}`)
  } catch (err) {
    // Teardown must not fail the suite — leftover rows are invisible to real users.
    console.warn('[e2e] teardown could not remove test user:', err)
  } finally {
    rmSync(idFile, { force: true })
  }
}
