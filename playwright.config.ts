import process from 'node:process'
import { defineConfig } from '@playwright/test'

const executablePath = process.env.TIDY_CHROME_PATH

export default defineConfig({
  testDir: './e2e',
  workers: 2,
  use: { baseURL: 'http://127.0.0.1:4188', launchOptions: { executablePath } },
  webServer: {
    command: 'npm run preview -- --strictPort --host 127.0.0.1 --port 4188',
    url: 'http://127.0.0.1:4188',
  },
})
