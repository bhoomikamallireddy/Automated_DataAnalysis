import { chromium } from '@playwright/test';

export default async function globalSetup(config) {
  const backendUrl = process.env.E2E_API_URL || 'http://127.0.0.1:8000';
  const frontendUrl = process.env.E2E_FRONTEND_URL || 'http://localhost:3000';
  const skipHealthCheck = process.env.SKIP_HEALTH_CHECK === 'true';
  
  console.log('E2E Test Setup:');
  console.log(`  Backend: ${backendUrl}`);
  console.log(`  Frontend: ${frontendUrl}`);

  if (skipHealthCheck) {
    console.log('  Skipping health checks (SKIP_HEALTH_CHECK=true)\n');
    return;
  }

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('  Checking backend health...');
    try {
      await page.goto(`${backendUrl}/api/auth/login/`, { 
        waitUntil: 'domcontentloaded',
        timeout: 5000 
      });
      console.log('  Backend: OK');
    } catch (e) {
      console.log('  Backend: Not responding (tests may fail if server is not running)');
    }

    console.log('  Checking frontend health...');
    try {
      await page.goto(frontendUrl, { 
        waitUntil: 'domcontentloaded',
        timeout: 10000 
      });
      console.log('  Frontend: OK');
    } catch (e) {
      console.log('  Frontend: Not responding (tests may fail if server is not running)');
    }

  } finally {
    await browser.close();
  }

  console.log('  Setup complete!\n');
}
