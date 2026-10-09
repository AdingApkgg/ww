import { defineConfig } from '@playwright/test'
import { existsSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

// Use an already installed browser when available; CI can use playwright install chromium.
function cachedChromium() {
  if (process.env.WW_CHROMIUM_PATH) return process.env.WW_CHROMIUM_PATH
  if (process.platform !== 'darwin') return undefined
  const cache = join(homedir(), 'Library/Caches/ms-playwright')
  if (!existsSync(cache)) return undefined
  for (const dir of readdirSync(cache).filter(x => /^chromium-\d+$/.test(x)).sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]))) {
    for (const arch of ['arm64', 'x64']) {
      const path = join(cache, dir, `chrome-mac-${arch}`, 'Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing')
      if (existsSync(path)) return path
    }
  }
}
export default defineConfig({
  testDir: './e2e', fullyParallel: false, workers: 1, timeout: 30000, reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:5199', browserName: 'chromium', launchOptions: { executablePath: cachedChromium() }, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: { command: 'bun scripts/e2e-server.ts', url: 'http://127.0.0.1:5199', reuseExistingServer: false, timeout: 30000 },
})
