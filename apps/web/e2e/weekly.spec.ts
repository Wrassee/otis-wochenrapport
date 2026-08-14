import { test, expect } from '@playwright/test'
import { forceGerman, loginAsTestUser } from './helpers'

test.describe('Woche page', () => {
  test('renders the five week days with the week header', async ({ page }) => {
    forceGerman(page)
    await loginAsTestUser(page)

    await page.goto('/weekly')

    // Week navigation header.
    await expect(page.getByText('Woche').first()).toBeVisible({ timeout: 20_000 })

    // The five day cards (Montag…Freitag). A fresh test user has an empty
    // week, so the days show the missing-hours state — but they must render.
    for (const day of ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag']) {
      await expect(page.getByText(day, { exact: true }).first()).toBeVisible()
    }
  })
})
