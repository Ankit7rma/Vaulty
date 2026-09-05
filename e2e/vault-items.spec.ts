import { test, expect } from '@playwright/test'

// Exercises encrypted item CRUD end-to-end, including the persistence round trip:
// an item added while unlocked survives a re-lock (reload) and decrypts again on
// unlock, proving it was stored as an opaque blob and decrypted client-side.
test('add, persist, edit, and delete a login item', async ({ page }) => {
  const email = `e2e-items-${Date.now()}@example.com`
  const master = 'master-password-456'

  // Sign up and onboard to reach an unlocked vault.
  await page.goto('/signup')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Account password').fill('account-password-123')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page).toHaveURL(/\/onboard$/)
  await page.getByLabel('Master password', { exact: true }).fill(master)
  await page.getByLabel('Confirm master password').fill(master)
  await page.getByRole('button', { name: 'Set master password' }).click()
  await expect(page).toHaveURL(/\/vault$/)

  // Add a login.
  await page.getByRole('button', { name: 'Add login' }).click()
  await page.getByLabel('Title').fill('GitHub')
  await page.getByLabel('Username', { exact: true }).fill('octocat')
  // Fill the password with the generator (proves the generator wiring).
  await page.getByRole('button', { name: 'Generate password' }).click()
  await page.getByRole('button', { name: 'Use password' }).click()
  await expect(page.getByLabel('Password', { exact: true })).not.toHaveValue('')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('GitHub')).toBeVisible()
  await expect(page.getByText('octocat')).toBeVisible()

  // Persistence: reload re-locks; after unlock the item decrypts from the DB.
  await page.reload()
  await expect(page).toHaveURL(/\/unlock$/)
  await page.getByLabel('Master password').fill(master)
  await page.getByRole('button', { name: 'Unlock' }).click()
  await expect(page).toHaveURL(/\/vault$/)
  await expect(page.getByText('GitHub')).toBeVisible()

  // Search filters the decrypted list in memory.
  await page.getByPlaceholder('Search').fill('git')
  await expect(page.getByText('GitHub')).toBeVisible()
  await page.getByPlaceholder('Search').fill('zzz')
  await expect(page.getByText('GitHub')).toHaveCount(0)
  await expect(page.getByText('No matches')).toBeVisible()
  await page.getByPlaceholder('Search').fill('')
  await expect(page.getByText('GitHub')).toBeVisible()

  // Edit the title.
  await page.getByRole('button', { name: /GitHub/ }).click()
  await page.getByLabel('Title').fill('GitHub (work)')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('GitHub (work)')).toBeVisible()

  // Delete it.
  await page.getByRole('button', { name: /GitHub \(work\)/ }).click()
  await page.getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByText('GitHub (work)')).toHaveCount(0)
  await expect(page.getByText('Your vault is empty.')).toBeVisible()
})
