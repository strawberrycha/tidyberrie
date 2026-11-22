import process from 'node:process'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const phrase = 'sample test passphrase'

async function signIn(page: Page, email: string, create: boolean) {
  await page.goto('/settings/sync')
  const pending = page.waitForEvent('popup')
  await page.getByRole('button', { name: 'Sign in with Google' }).click()
  const popup = await pending
  await expect.poll(() => page.frames().find(frame => {
    const url = new URL(frame.url())
    return url.origin === 'http://127.0.0.1:9099' && url.pathname === '/emulator/auth/iframe'
  })?.url().length ?? 0).toBeGreaterThan(0)
  await page.frameLocator('iframe[src*="/emulator/auth/iframe"]').locator('body').waitFor({ state: 'attached' })
  if (create) {
    await popup.getByRole('button', { name: /Add new account/ }).click()
    await popup.locator('#email-input').fill(email)
    await popup.locator('#display-name-input').fill('Sync fixture')
    await popup.getByRole('button', { name: /Sign in with Google/i }).click()
  } else {
    await popup.getByText(email, { exact: true }).click()
  }
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible({ timeout: 15_000 })
}

async function addTask(page: Page, title: string) {
  await page.getByRole('link', { name: 'Tasks', exact: true }).click()
  await page.getByRole('button', { name: 'Add task' }).click()
  await page.getByLabel('Title').fill(title)
  await page.getByRole('button', { name: 'Save task' }).click()
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
}

async function openSync(page: Page) {
  await page.getByRole('link', { name: 'Settings', exact: true }).click()
  await page.getByRole('link', { name: 'Open sync settings' }).click()
}

async function ready(page: Page) {
  await expect(page.getByText(/Last completed sync:/)).toBeVisible({ timeout: 20_000 })
  await expect(page.getByRole('status').filter({ hasText: /^Sync is on/ })).toBeVisible({ timeout: 20_000 })
}

test('two offline browser profiles merge encrypted edits and a deletion', async ({ browser, baseURL }) => {
  test.skip(process.env.VITE_SYNC_EMULATOR !== 'true', 'Run against the local Auth and Firestore emulators.')
  test.setTimeout(120_000)
  const address = 'sync-' + Math.floor(Date.now() / 1000) + '@example.invalid'
  const a = await browser.newContext({ baseURL })
  const b = await browser.newContext({ baseURL })
  try {
    const first = await a.newPage()
    const second = await b.newPage()
    await signIn(first, address, true)
    await addTask(first, 'Shared offline task')
    await openSync(first)
    await first.getByRole('checkbox', { name: 'Encrypt cloud record contents' }).check()
    await first.getByLabel('Sync passphrase').fill(phrase)
    await first.getByRole('button', { name: 'Turn on sync' }).click()
    await ready(first)

    await signIn(second, address, false)
    await expect(second.getByText(/Cloud payload encryption is on/)).toBeVisible()
    await second.getByLabel('Sync passphrase').fill(phrase)
    await second.getByRole('button', { name: 'Turn on sync' }).click()
    await ready(second)
    await second.getByRole('link', { name: 'Tasks', exact: true }).click()
    await expect(second.getByRole('heading', { name: 'Shared offline task' })).toBeVisible()
    for (const page of [first, second]) {
      await page.waitForFunction(() => !!navigator.serviceWorker.controller)
    }

    await a.setOffline(true)
    await b.setOffline(true)
    await first.getByRole('link', { name: 'Tasks', exact: true }).click()
    await first.getByRole('button', { name: 'Edit', exact: true }).click()
    await first.getByLabel('Title').fill('First device edited offline')
    await first.getByRole('button', { name: 'Save task' }).click()
    await expect(first.getByRole('heading', { name: 'First device edited offline' })).toBeVisible()
    await addTask(first, 'First device independent task')
    await second.getByRole('button', { name: 'Delete', exact: true }).click()
    await expect(second.getByRole('heading', { name: 'Shared offline task' })).toHaveCount(0)
    await addTask(second, 'Second device independent task')
    await first.reload()
    await expect(first.getByRole('heading', { name: 'First device edited offline' })).toBeVisible()

    await b.setOffline(false)
    await openSync(second)
    await second.getByRole('button', { name: 'Sync now' }).click()
    await ready(second)
    await a.setOffline(false)
    await openSync(first)
    await first.getByLabel('Sync passphrase').fill(phrase)
    await first.getByRole('button', { name: 'Unlock sync' }).click()
    await ready(first)
    await expect(first.getByText(/concurrent change resolved/)).toBeVisible()
    await first.getByRole('link', { name: 'Tasks', exact: true }).click()
    await expect(first.getByRole('heading', { name: 'Second device independent task' })).toBeVisible()
    await expect(first.getByRole('heading', { name: 'First device edited offline' })).toHaveCount(0)

    await second.getByRole('button', { name: 'Sync now' }).click()
    await ready(second)
    await second.getByRole('button', { name: 'Turn off sync and keep local data' }).click()
    await expect(second.getByRole('status').filter({ hasText: /^Sync is off/ })).toBeVisible()
    await second.getByRole('button', { name: 'Sign out' }).click()
    await expect(second.getByRole('button', { name: 'Sign in with Google' })).toBeVisible()
    await second.getByRole('link', { name: 'Tasks', exact: true }).click()
    await expect(second.getByRole('heading', { name: 'First device independent task' })).toBeVisible()
    await expect(second.getByRole('heading', { name: 'Second device independent task' })).toBeVisible()
  } finally {
    await a.close()
    await b.close()
  }
})
