import { test, expect } from '@playwright/test'
import { forceGerman, loginAsTestUser } from './helpers'

test.describe('Excel export', () => {
  test('generates the weekly Excel file', async ({ page }) => {
    forceGerman(page)
    await loginAsTestUser(page)

    await page.goto('/export')
    await expect(page.getByRole('button', { name: 'Excel Exportieren' })).toBeVisible({
      timeout: 20_000,
    })

    // The export may hit the local backend OR fall back to offline generation —
    // both must end in a success status. The download (if the browser allows a
    // programmatic save) is captured as a bonus assertion.
    const downloadPromise = page
      .waitForEvent('download', { timeout: 60_000 })
      .then((d) => d.suggestedFilename())
      .catch(() => null)

    await page.getByRole('button', { name: 'Excel Exportieren' }).click()

    await expect(page.getByText(/Excel erfolgreich exportiert/)).toBeVisible({ timeout: 90_000 })

    const filename = await downloadPromise
    if (filename) {
      expect(filename).toMatch(/Wochenrapport_KW\d+_\d{4}/)
    }
  })
})
