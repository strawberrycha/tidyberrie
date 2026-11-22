import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

async function addRepeatingTask(page: Page) {
  await page.getByRole('button', { name: 'Add task' }).click()
  await page.getByLabel('Title').fill('Water the plants')
  await page.getByRole('button', { name: 'More options' }).click()
  await page.getByRole('combobox', { name: 'Repeat', exact: true }).selectOption('daily')
  await page.getByRole('button', { name: 'Add subtask' }).click()
  await page.getByLabel('Subtask 1', { exact: true }).fill('Check the soil')
  await page.getByRole('button', { name: 'Save task' }).click()
}

test('completes a single repeat and restores the series from Trash', async ({ page }) => {
  await page.goto('/tasks?list=today')
  await addRepeatingTask(page)
  await page.getByRole('button', { name: 'Today', exact: true }).click()
  await page.getByRole('button', { name: 'Show subtasks' }).click()
  const subtask = page.getByRole('checkbox', { name: 'Check the soil' })
  await subtask.click()
  await expect(subtask).toBeChecked()
  await page.getByRole('button', { name: 'Complete Water the plants' }).click()
  await page.getByRole('button', { name: 'Completed', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Reopen Water the plants' })).toBeVisible()
  await page.getByRole('button', { name: 'Delete', exact: true }).click()
  await page.getByRole('button', { name: 'All occurrences' }).click()
  await page.getByRole('link', { name: 'Trash', exact: true }).click()
  await page.getByRole('button', { name: 'Restore', exact: true }).click()
  await page.getByRole('link', { name: 'Back to tasks' }).click()
  await page.getByRole('button', { name: 'Completed', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Water the plants' })).toBeVisible()
})

test('calculates Budget cards from an account, income, and an expense', async ({ page }) => {
  await page.goto('/budget')
  await page.getByRole('button', { name: /^monthly$/i }).click()
  const add = async (kind: string) => {
    await page.getByRole('button', { name: 'Add budget record' }).click()
    await page.getByRole('dialog').getByRole('button', { name: kind, exact: true }).click()
  }
  await add('Account')
  await page.getByLabel('Name', { exact: true }).fill('Wallet')
  await page.getByLabel('Opening balance (PHP)').fill('1000.01')
  await page.getByRole('button', { name: 'Save account' }).click()

  await add('Income')
  await page.getByLabel('Amount (PHP)').fill('300')
  await page.getByRole('combobox', { name: 'Source', exact: true }).selectOption('sahod')
  await page.getByRole('dialog').getByRole('combobox', { name: 'Account', exact: true }).selectOption({ label: 'Wallet' })
  await page.getByRole('button', { name: 'Save income' }).click()

  await add('Expense')
  await page.getByLabel('Amount (PHP)').fill('200')
  await page.getByRole('dialog').getByRole('combobox', { name: 'Category', exact: true }).selectOption('Food')
  await page.getByRole('dialog').getByRole('combobox', { name: 'Account', exact: true }).selectOption({ label: 'Wallet' })
  await page.getByRole('button', { name: 'Save expense' }).click()

  const left = page.locator('article').filter({ hasText: 'Left this month' })
  await expect(left).toContainText('₱1,100.01')
  await page.getByRole('button', { name: 'Mark paid' }).click()
  await page.getByRole('combobox', { name: 'Settlement account' }).selectOption({ label: 'Wallet' })
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm paid' }).click()
  await expect(left).toContainText('₱1,100.01')
})

test('exports, previews, and replaces a backup, then keeps the task and theme on reload', async ({ page }) => {
  await page.goto('/tasks')
  await addRepeatingTask(page)
  await page.getByRole('heading', { name: 'Water the plants' }).waitFor()
  await page.getByRole('link', { name: 'Settings', exact: true }).click()
  await page.getByLabel('Theme', { exact: true }).selectOption('sakura')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'sakura')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'sakura')
  const pending = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export JSON', exact: true }).click()
  const file = await (await pending).path()
  await page.getByLabel('Import JSON').setInputFiles(file)
  await expect(page.getByRole('group', { name: 'Import preview' })).toContainText('tasks: 1')
  await page.getByRole('combobox', { name: 'How to import' }).selectOption('replace')
  await page.getByLabel('Type REPLACE').fill('REPLACE')
  await page.getByRole('button', { name: 'Confirm import' }).click()
  await expect(page.getByText('Backup imported.')).toBeVisible()
  await expect(page.getByText(/Safety snapshot ·/)).toBeVisible()
  await page.getByRole('link', { name: 'Tasks', exact: true }).click()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Water the plants' })).toBeVisible()
})

test('PIN gate survives reload and unlocks locally', async ({ page }) => {
  await page.goto('/settings')
  await page.getByLabel('PIN (6–12 digits)').fill('135791')
  await page.getByLabel('Confirm PIN').fill('135791')
  await page.getByRole('button', { name: 'Save App Lock' }).click()
  await expect(page.getByText('App Lock saved.')).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Tidyberrie is locked' })).toBeVisible()
  await expect(page.getByRole('navigation')).toBeHidden()
  await page.getByLabel('PIN', { exact: true }).fill('135791')
  await page.getByRole('button', { name: 'Unlock' }).click()
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible()
})

test('Axe and 200% text scaling across screens in both themes', async ({ page }) => {
  test.setTimeout(60_000)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/budget')
  await page.getByRole('button', { name: /^monthly$/i }).click()
  await page.getByRole('heading', { name: 'Accounts', exact: true }).waitFor()
  await page.goto('/settings')
  for (const theme of ['strawberry', 'sakura']) {
    await page.getByLabel('Theme', { exact: true }).selectOption(theme)
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
    for (const route of ['/settings', '/', '/tasks', '/calendar', '/budget', '/budget/extras', '/budget/summary', '/settings/reminders']) {
      await page.goto(route)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
      await expect(page.getByText('Loading…', { exact: true })).toHaveCount(0)
      const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
      expect.soft(audit.violations.map(({ id, nodes }) => ({ id, count: nodes.length, example: nodes[0].target })), route + ' ' + theme).toEqual([])
      await page.evaluate(() => { document.documentElement.style.fontSize = '200%' })
      expect.soft(await page.evaluate(() => document.documentElement.scrollWidth), route + ' at 200%').toBeLessThanOrEqual(390)
    }
    await page.goto('/settings')
  }
})

test('reserved palettes meet text, focus and control contrast targets', async ({ page }) => {
  await page.goto('/')
  for (const theme of ['cozy-cat-cafe', 'matcha-berry', 'lavender-cloud', 'mono-blush']) {
    const results = await page.evaluate(theme => {
      const root = document.documentElement
      root.dataset.theme = theme
      const styles = getComputedStyle(root)
      function luminance(token: string) {
        const raw = styles.getPropertyValue(token).trim().slice(1)
        const hex = raw.length === 3 ? raw.replace(/./g, character => character.repeat(2)) : raw
        const channels = [0, 2, 4].map(offset => {
          const channel = parseInt(hex.slice(offset, offset + 2), 16) / 255
          return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
        })
        return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
      }
      function contrast(a: string, b: string) {
        const values = [luminance(a), luminance(b)].sort((x, y) => y - x)
        return (values[0] + 0.05) / (values[1] + 0.05)
      }
      const surfaces = ['--bg', '--surface', '--soft']
      return {
        text: Math.min(...surfaces.flatMap(surface => ['--text', '--text-muted'].map(color => contrast(color, surface))), contrast('--on-primary', '--primary')),
        controls: Math.min(...surfaces.flatMap(surface => ['--primary', '--control-border'].map(color => contrast(color, surface)))),
      }
    }, theme)
    expect(results.text, theme).toBeGreaterThanOrEqual(4.5)
    expect(results.controls, theme).toBeGreaterThanOrEqual(3)
  }
})

test('restores a daily snapshot and recovers from the safety snapshot', async ({ page }) => {
  await page.goto('/settings')
  const daily = page.locator('#backups details').first()
  await daily.locator('summary').click()
  await expect(daily).toContainText('tasks: 0')
  await page.getByRole('link', { name: 'Tasks', exact: true }).click()
  await addRepeatingTask(page)
  await expect(page.getByRole('heading', { name: 'Water the plants' })).toBeVisible()
  await page.getByRole('link', { name: 'Settings', exact: true }).click()
  await daily.locator('summary').click()
  await daily.getByRole('button', { name: /^Restore / }).click()
  await page.getByRole('button', { name: 'Confirm restore' }).click()
  await expect(page.getByText(/Safety snapshot ·/)).toBeVisible()
  await page.getByRole('link', { name: 'Tasks', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'No tasks to show' })).toBeVisible()
  await page.getByRole('link', { name: 'Settings', exact: true }).click()
  await page.getByText(/Safety snapshot ·/).click()
  await page.getByRole('button', { name: 'Restore Safety snapshot' }).click()
  await page.getByRole('button', { name: 'Confirm restore' }).click()
  await expect(page.getByText('Snapshot restored. The previous data is in the safety snapshot.')).toBeVisible()
  await page.getByRole('link', { name: 'Tasks', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Water the plants' })).toBeVisible()
})
