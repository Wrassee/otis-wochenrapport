import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { ensureTestUser } from './helpers'

const ROOT = path.dirname(fileURLToPath(import.meta.url))

/**
 * Creates the throwaway E2E account before the suite runs. The user id is
 * written to a temp file so global-teardown can remove the user + data rows.
 */
export default async function globalSetup() {
  try {
    const userId = await ensureTestUser()
    process.env.E2E_TEST_USER_ID = userId
    // Persist for the teardown process (Playwright runs it in a fresh process).
    const { writeFileSync } = await import('node:fs')
    writeFileSync(path.join(ROOT, '.e2e-user-id'), userId, 'utf8')
    console.log(`[e2e] test user ready: ${userId}`)
  } catch (err) {
    console.error('[e2e] global setup failed (tests will fail with clear errors):', err)
    throw err
  }
}
