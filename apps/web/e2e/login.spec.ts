import { test, expect } from '@playwright/test'
import { forceGerman, loginAsTestUser } from './helpers'

test.describe('Login', () => {
  test('shows an error for invalid credentials', async ({ page }) => {
    forceGerman(page)
    await page.goto('/login')
    await page.locator('#login-email').fill('no.such.user@example.com')
    await page.locator('#login-password').fill('wrong-password')
    await page.getByRole('button', { name: 'Anmelden' }).click()
    await expect(page.getByText('Anmeldung fehlgeschlagen')).toBeVisible({ timeout: 20_000 })
  })

  test('logs in and reaches the dashboard', async ({ page }) => {
    forceGerman(page)
    await loginAsTestUser(page)
    // The wizard entry card is the dashboard's signature element.
    await expect(page.getByText('Rapport Assistent').first()).toBeVisible()
    await expect(page).toHaveURL(/\/dashboard/)
  })
})
