import { test, expect } from '@playwright/test'

// The core zero-knowledge journey: create an account, set a master password
// (key derived client-side), land in the unlocked vault, lock it, and unlock
// again. Also asserts wrong-password rejection and that a refresh re-locks,
// proving the key lives only in memory.
test('signup -> onboard -> lock -> unlock', async ({ page }) => {
  const email = `e2e-${Date.now()}@example.com`
  const accountPassword = 'account-password-123'
  const masterPassword = 'master-password-456'

  await page.goto('/signup')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Account password').fill(accountPassword)
  await page.getByRole('button', { name: 'Create account' }).click()

  // Onboarding: set the master password.
  await expect(page).toHaveURL(/\/onboard$/)
  await expect(page.getByText('Two passwords, two jobs')).toBeVisible()
  await page.getByLabel('Master password', { exact: true }).fill(masterPassword)
  await page.getByLabel('Confirm master password').fill(masterPassword)
  await page.getByRole('button', { name: 'Set master password' }).click()

  // Vault is unlocked.
  await expect(page).toHaveURL(/\/vault$/)
  await expect(
    page.getByRole('heading', { name: 'Your vault is unlocked' }),
  ).toBeVisible()

  // Lock wipes the in-memory key and returns to unlock.
  await page.getByRole('button', { name: 'Lock' }).click()
  await expect(page).toHaveURL(/\/unlock$/)

  // Wrong master password is rejected client-side (verified via check blob).
  await page.getByLabel('Master password').fill('not-the-password')
  await page.getByRole('button', { name: 'Unlock' }).click()
  await expect(page.getByText('Incorrect master password.')).toBeVisible()
  await expect(page).toHaveURL(/\/unlock$/)

  // Correct master password unlocks.
  await page.getByLabel('Master password').fill(masterPassword)
  await page.getByRole('button', { name: 'Unlock' }).click()
  await expect(page).toHaveURL(/\/vault$/)
  await expect(
    page.getByRole('heading', { name: 'Your vault is unlocked' }),
  ).toBeVisible()

  // A refresh drops the in-memory key, so the vault re-locks.
  await page.reload()
  await expect(page).toHaveURL(/\/unlock$/)
})
