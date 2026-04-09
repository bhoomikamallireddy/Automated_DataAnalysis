import { defineConfig, devices } from '@playwright/test';

const skipMobile = process.env.SKIP_MOBILE === 'true';
const skipGlobalSetup = process.env.SKIP_HEALTH_CHECK === 'true';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'html',
  use: {
    baseURL: process.env.E2E_FRONTEND_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15000,
    navigationTimeout: 60000,
    launchOptions: {
      args: ['--disable-web-security'],
    },
  },
  globalSetup: skipGlobalSetup ? undefined : './tests/e2e/global-setup.js',
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    ...(skipMobile ? [] : [{
      name: 'chromium-mobile',
      use: { ...devices['Pixel 5'] },
    }]),
  ],
  webServer: process.env.CI ? {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: false,
    timeout: 120000,
    stdout: 'ignore',
    stderr: 'pipe',
  } : undefined,
});
