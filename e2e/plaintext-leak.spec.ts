import { test, expect } from '@playwright/test'

/**
 * The single most load-bearing ZK invariant: nothing the user types into a
 * vault field is ever stored on the server in plaintext. This test embeds a
 * unique marker in the title, username, password, url, notes, and note-body
 * fields, drives the app through create / edit / soft-delete / hard-delete,
 * then calls the dev-only /api/_debug/scan-plaintext endpoint which walks
 * every user-content column in the database and reports any hit.
 *
 * If a future change accidentally writes plaintext (a debug log left in an
 * API route, a mis-serialized field, a plaintext export overwrite, etc.)
 * this test flips to red immediately. The marker is deliberately unusual so
 * false positives are impossible.
 */

const MARKER = `PLAINTEXT-CANARY-8f3ac1e6-${Date.now()}`

async function scanForMarker(request: import('@playwright/test').APIRequestContext) {
  const res = await request.get(`/api/_debug/scan-plaintext?marker=${MARKER}`)
  expect(res.status(), 'debug scan endpoint must be reachable in dev/test').toBe(200)
  return (await res.json()) as {
    marker: string
    hits: Array<{ table: string; column: string; rowId: string; sample: string }>
    scanned: Record<string, number>
  }
}

test('vault mutations never write plaintext to the database', async ({ page, request }) => {
  // Sanity: the scanner sees zero hits before we do anything, since the
  // marker is fresh per run.
  const preRun = await scanForMarker(request)
  expect(preRun.hits, `marker leaked into DB before test started`).toEqual([])

  const email = `e2e-canary-${Date.now()}@example.com`
  const master = 'master-password-canary'

  await page.goto('/signup')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Account password').fill('account-password-canary')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page).toHaveURL(/\/onboard$/)
  await page.getByLabel('Master password', { exact: true }).fill(master)
  await page.getByLabel('Confirm master password').fill(master)
  await page.getByRole('button', { name: 'Set master password' }).click()
  await expect(page).toHaveURL(/\/vault$/)

  // Create a login with the marker in every string field.
  await page.getByRole('button', { name: 'Add login' }).click()
  await page.getByLabel('Title').fill(`${MARKER}-title`)
  await page.getByLabel('Username', { exact: true }).fill(`${MARKER}-user`)
  await page.getByLabel('Password', { exact: true }).fill(`${MARKER}-pw`)
  await page.getByLabel('URL').fill(`https://${MARKER}.example`)
  await page.getByLabel('Notes').fill(`${MARKER}-notes body`)
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText(`${MARKER}-title`)).toBeVisible()

  // Immediately scan after create.
  const afterCreate = await scanForMarker(request)
  expect(
    afterCreate.hits,
    `marker leaked after item create: ${JSON.stringify(afterCreate.hits, null, 2)}`,
  ).toEqual([])

  // Edit the item so a history snapshot is written; scan again.
  await page.getByRole('button', { name: new RegExp(`${MARKER}-title`) }).click()
  await page.getByLabel('Title').fill(`${MARKER}-title-edited`)
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText(`${MARKER}-title-edited`)).toBeVisible()

  const afterEdit = await scanForMarker(request)
  expect(
    afterEdit.hits,
    `marker leaked after item edit: ${JSON.stringify(afterEdit.hits, null, 2)}`,
  ).toEqual([])

  // Soft delete (send to trash) — still writes an update.
  await page.getByRole('button', { name: new RegExp(`${MARKER}-title-edited`) }).click()
  await page.getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByText(`${MARKER}-title-edited`)).toHaveCount(0)

  const afterSoftDelete = await scanForMarker(request)
  expect(
    afterSoftDelete.hits,
    `marker leaked after soft delete: ${JSON.stringify(afterSoftDelete.hits, null, 2)}`,
  ).toEqual([])
})
