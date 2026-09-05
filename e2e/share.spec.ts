import { test, expect } from '@playwright/test'

// Creates a one-time share link, opens it (decrypting via the key in the URL
// fragment), and confirms a second open fails because the link self-destructs.
test('share a login via a one-time link and consume it', async ({ page }) => {
  const email = `e2e-share-${Date.now()}@example.com`
  const master = 'master-password-456'

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
  await page.getByLabel('Title').fill('Shared Login')
  await page.getByLabel('Username', { exact: true }).fill('sharee')
  await page.getByLabel('Password', { exact: true }).fill('shared-secret')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Shared Login')).toBeVisible()

  // Open it and create a one-time share link.
  await page.getByRole('button', { name: /Shared Login/ }).click()
  await page.getByRole('button', { name: 'Share via one-time link' }).click()
  const codeLoc = page.locator('code').filter({ hasText: '/share/' })
  await expect(codeLoc).toBeVisible()
  const url = await codeLoc.textContent()
  expect(url).toBeTruthy()

  // Open the link: decrypts client-side using the key from the fragment.
  await page.goto(url!)
  await expect(page.getByText('Shared Login')).toBeVisible()
  await expect(page.getByText('sharee')).toBeVisible()

  // Opening again in a fresh page fails: the share was one-time and is now gone.
  const secondVisit = await page.context().newPage()
  await secondVisit.goto(url!)
  await expect(
    secondVisit.getByText('One-time links work exactly once.'),
  ).toBeVisible()
})
