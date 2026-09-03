// @ts-check
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: 'http://localhost:8080',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'Desktop',
      use: {
        browserName: 'chromium',
        viewport: { width: 1280, height: 800 },
      },
    },
    {
      name: 'Mobile',
      use: {
        browserName: 'chromium',
        ...devices['iPhone 12'],
      },
    },
  ],
  webServer: {
    command: 'npx http-server . -p 8080 -c-1 --silent',
    url: 'http://localhost:8080',
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
});
