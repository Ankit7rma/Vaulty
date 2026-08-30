import { test, expect } from '@playwright/test'

// Minimal smoke test proving the app boots and serves the home page.
// The real "add login -> lock -> unlock -> decrypt" flow lands in Phase 7.
test('home page loads', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/.+/)
})
