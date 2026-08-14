import { test, expect } from '@playwright/test'
import { forceGerman, loginAsTestUser } from './helpers'

/**
 * Drives the wizard through one complete Monday lift entry:
 *   worked → workType → anlage → projekt → adresse → activity → start →
 *   duration → moreLifts → spesen → (advances to Dienstag)
 * The wheel steps use their default values via the "Weiter" button.
 */
async function fillMondayLift(page: import('@playwright/test').Page) {
  // "Hast du am Montag gearbeitet?" → Ja
  await expect(page.getByText('Hast du am Montag gearbeitet?')).toBeVisible()
  await page.getByRole('button', { name: 'Ja', exact: true }).click()

  // "Am Lift oder nicht-produktive Arbeit?" → Am Lift
  await expect(page.getByText('Am Lift oder nicht-produktive Arbeit?')).toBeVisible()
  await page.getByRole('button', { name: 'Am Lift', exact: true }).click()

  // Anlagen-Nr.
  await expect(page.getByText('Wie lautet die Anlagen-Nr. des Lifts?')).toBeVisible()
  const input = page.locator('input[enterkeyhint="next"]')
  await input.fill('TEST01')
  await input.press('Enter')

  // Projekt-Nr.
  await expect(page.getByText('Wie lautet die Projekt-Nr.?')).toBeVisible()
  await input.fill('TESTPRJ')
  await input.press('Enter')

  // Adresse
  await expect(page.getByText('Wie lautet die Adresse des Lifts?')).toBeVisible()
  await input.fill('Teststrasse 1')
  await input.press('Enter')

  // Kosten-Code → NK
  await expect(page.getByText('Auf welchen Code wird abgerechnet?')).toBeVisible()
  await page.getByRole('button', { name: 'NK', exact: true }).click()

  // Start (default 07:30) → Weiter
  await expect(page.getByText('Wann hast du begonnen?')).toBeVisible()
  await page.getByRole('button', { name: 'Weiter' }).click()

  // Dauer (default 1h) → Weiter
  await expect(page.getByText('Wie lange warst du dort?')).toBeVisible()
  await page.getByRole('button', { name: 'Weiter' }).click()

  // "Noch weitere Lifte an diesem Tag?" → Nein
  await expect(page.getByText('Noch weitere Lifte an diesem Tag?')).toBeVisible()
  await page.getByRole('button', { name: 'Nein', exact: true }).click()

  // "Hattest du an diesem Tag Spesen?" → Nein → Dienstag
  await expect(page.getByText('Hattest du an diesem Tag Spesen?')).toBeVisible()
  await page.getByRole('button', { name: 'Nein', exact: true }).click()
}

test.describe('Rapport wizard', () => {
  test('fills Monday via the guided flow and persists the draft', async ({ page }) => {
    forceGerman(page)
    await loginAsTestUser(page)

    // Open the wizard from the dashboard card.
    await page.getByRole('button', { name: /Rapport Assistent/ }).click()
    await expect(page.getByText('Hast du am Montag gearbeitet?')).toBeVisible({ timeout: 20_000 })

    await fillMondayLift(page)

    // The day advanced to Dienstag — the Monday block is recorded.
    await expect(page.getByText('Hast du am Dienstag gearbeitet?')).toBeVisible({ timeout: 20_000 })

    // The draft must be persisted to localStorage (the wizard only writes real
    // entries to the DB on "Abschliessen", but the draft survives exits).
    const draft = await page.evaluate(() => {
      const key = Object.keys(localStorage).find((k) => k.startsWith('wizard.draft.'))
      return key ? localStorage.getItem(key) : null
    })
    expect(draft).not.toBeNull()
    expect(draft).toContain('TEST01')
    expect(draft).toContain('TESTPRJ')

    // Exit via the X button — the draft stays.
    await page.getByLabel('Zurück zur App').click()
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test('records an absence day (A03 Krankheit)', async ({ page }) => {
    forceGerman(page)
    await loginAsTestUser(page)

    await page.getByRole('button', { name: /Rapport Assistent/ }).click()
    await expect(page.getByText('Hast du am Montag gearbeitet?')).toBeVisible({ timeout: 20_000 })

    await page.getByRole('button', { name: 'Nein', exact: true }).click()

    // Absence options appear; Krankheit = A03.
    await expect(page.getByText('Was ist der Grund?')).toBeVisible()
    await page.getByRole('button', { name: /Krankheit/ }).click()

    // Advances to Dienstag with the absence recorded.
    await expect(page.getByText('Hast du am Dienstag gearbeitet?')).toBeVisible({ timeout: 20_000 })
    const draft = await page.evaluate(() => {
      const key = Object.keys(localStorage).find((k) => k.startsWith('wizard.draft.'))
      return key ? localStorage.getItem(key) : null
    })
    expect(draft).toContain('A03')
  })
})
