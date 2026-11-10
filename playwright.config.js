// @ts-check
const { defineConfig, devices } = require('@playwright/test');

// BASE_URL=https://moniaulas.vercel.app permite probar contra producción.
const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';

module.exports = defineConfig({
  testDir: './tests',
  timeout: 120_000,
  fullyParallel: true,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'on',
    video: 'on',
    screenshot: 'on',
    launchOptions: { slowMo: Number(process.env.SLOWMO || 0) },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: 'npx http-server . -p 4173 -s -c-1',
        url: baseURL,
        reuseExistingServer: true,
      },
});
