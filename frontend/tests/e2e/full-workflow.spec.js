import { test, expect } from '@playwright/test';
import { generateTestUser, createTestCSVFile } from '../utils/api.js';

const BACKEND_URL = process.env.E2E_API_URL || 'http://127.0.0.1:8000';
const FRONTEND_URL = process.env.E2E_FRONTEND_URL || 'http://localhost:3000';

test.describe('E2E: Full User Journey', () => {
  test('complete registration → login → dashboard flow', async ({ page }) => {
    const testUser = generateTestUser('journey');
    
    await page.goto(`${FRONTEND_URL}/register`);
    
    await page.getByPlaceholder('Unique username').fill(testUser.username);
    await page.getByPlaceholder('email@example.com').fill(testUser.email);
    await page.getByPlaceholder('••••••••').first().fill(testUser.password);
    await page.getByPlaceholder('••••••••').nth(1).fill(testUser.password);
    await page.getByRole('button', { name: 'Create Account' }).click();
    
    await expect(page).toHaveURL(`${FRONTEND_URL}/login`, { timeout: 5000 });
    
    await page.getByPlaceholder('Enter your username').fill(testUser.username);
    await page.getByPlaceholder('••••••••').fill(testUser.password);
    await page.getByRole('button', { name: 'Sign In' }).click();
    
    await expect(page).toHaveURL(`${FRONTEND_URL}/`, { timeout: 10000 });
    await expect(page.getByText('Ready for Insights?')).toBeVisible({ timeout: 5000 });
  });

  test('login → logout → verify redirect', async ({ page }) => {
    const testUser = generateTestUser('logout');
    
    await page.goto(`${FRONTEND_URL}/register`);
    await page.getByPlaceholder('Unique username').fill(testUser.username);
    await page.getByPlaceholder('email@example.com').fill(testUser.email);
    await page.getByPlaceholder('••••••••').first().fill(testUser.password);
    await page.getByPlaceholder('••••••••').nth(1).fill(testUser.password);
    await page.getByRole('button', { name: 'Create Account' }).click();
    
    await page.waitForURL(`${FRONTEND_URL}/login`);
    
    await page.getByPlaceholder('Enter your username').fill(testUser.username);
    await page.getByPlaceholder('••••••••').fill(testUser.password);
    await page.getByRole('button', { name: 'Sign In' }).click();
    
    await page.waitForURL(`${FRONTEND_URL}/`);
    
    await page.getByRole('button', { name: /Sign Out/i }).click();
    
    await expect(page).toHaveURL(`${FRONTEND_URL}/login`, { timeout: 5000 });
  });
});

test.describe('E2E: File Upload Flow', () => {
  test.beforeEach(async ({ page }) => {
    const testUser = generateTestUser('upload');
    
    await page.goto(`${FRONTEND_URL}/register`);
    await page.getByPlaceholder('Unique username').fill(testUser.username);
    await page.getByPlaceholder('email@example.com').fill(testUser.email);
    await page.getByPlaceholder('••••••••').first().fill(testUser.password);
    await page.getByPlaceholder('••••••••').nth(1).fill(testUser.password);
    await page.getByRole('button', { name: 'Create Account' }).click();
    
    await page.waitForURL(`${FRONTEND_URL}/login`);
    
    await page.getByPlaceholder('Enter your username').fill(testUser.username);
    await page.getByPlaceholder('••••••••').fill(testUser.password);
    await page.getByRole('button', { name: 'Sign In' }).click();
    
    await page.waitForURL(`${FRONTEND_URL}/`);
  });

  test('should upload CSV and trigger analysis', async ({ page }) => {
    const csvFile = createTestCSVFile('test_data.csv', 20, 5);
    
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(csvFile);
    
    await expect(page.getByText('test_data.csv')).toBeVisible();
    
    await page.getByRole('button', { name: 'Run Analysis' }).click();
    
    await expect(page.getByText('Analyzing patterns')).toBeVisible({ timeout: 5000 });
  });

  test('should show analysis results after completion', async ({ page }) => {
    const csvContent = 'x,y,z\n1,2,3\n4,5,6\n7,8,9\n10,11,12\n15,18,21';
    const csvFile = {
      name: 'numeric_test.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csvContent)
    };
    
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(csvFile);
    
    await page.getByRole('button', { name: 'Run Analysis' }).click();
    
    await expect(page.getByText('Analyzing patterns')).toBeVisible({ timeout: 10000 });
    
    await expect(page.getByText('Ready for Insights?')).not.toBeVisible({ timeout: 120000 });
  });

  test('should handle file re-upload after completion', async ({ page }) => {
    const csvFile1 = createTestCSVFile('first.csv', 5, 2);
    const csvFile2 = createTestCSVFile('second.csv', 10, 3);
    
    await page.locator('input[type="file"]').setInputFiles(csvFile1);
    await page.getByRole('button', { name: 'Run Analysis' }).click();
    await page.waitForTimeout(3000);
    
    await page.getByRole('button', { name: /New/i }).click();
    
    await page.locator('input[type="file"]').setInputFiles(csvFile2);
    await expect(page.getByText('second.csv')).toBeVisible();
  });
});

test.describe('E2E: Dashboard Navigation', () => {
  test.beforeEach(async ({ page }) => {
    const testUser = generateTestUser('nav');
    
    await page.goto(`${FRONTEND_URL}/register`);
    await page.getByPlaceholder('Unique username').fill(testUser.username);
    await page.getByPlaceholder('email@example.com').fill(testUser.email);
    await page.getByPlaceholder('••••••••').first().fill(testUser.password);
    await page.getByPlaceholder('••••••••').nth(1).fill(testUser.password);
    await page.getByRole('button', { name: 'Create Account' }).click();
    
    await page.waitForURL(`${FRONTEND_URL}/login`);
    await page.getByPlaceholder('Enter your username').fill(testUser.username);
    await page.getByPlaceholder('••••••••').fill(testUser.password);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForURL(`${FRONTEND_URL}/`);
  });

  test('should switch between workspace modes', async ({ page }) => {
    await page.getByRole('button', { name: '🕒 History' }).click();
    await expect(page.getByRole('button', { name: '📊 Current Analysis' })).toBeVisible();
    
    await page.getByRole('button', { name: '📊 Current Analysis' }).click();
    await expect(page.getByText('Ready for Insights?')).toBeVisible();
  });

  test('should toggle sidebar on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    
    await expect(page.getByRole('button', { name: 'Open navigation' })).toBeVisible();
    
    await page.getByRole('button', { name: 'Open navigation' }).click();
    
    await expect(page.locator('aside')).toBeVisible();
  });

  test('should navigate between analysis tabs', async ({ page }) => {
    const csvFile = createTestCSVFile('tabs_test.csv', 15, 4);
    await page.locator('input[type="file"]').setInputFiles(csvFile);
    await page.getByRole('button', { name: 'Run Analysis' }).click();
    await page.waitForTimeout(3000);
    
    await expect(page.getByRole('button', { name: /Audit/i })).toBeVisible();
    await page.getByRole('button', { name: /Audit/i }).click();
    
    await expect(page.getByText('Data Quality Audit')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('E2E: Error Handling', () => {
  test('should show error on invalid login', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/login`);
    
    await page.getByPlaceholder('Enter your username').fill('nonexistent_user');
    await page.getByPlaceholder('••••••••').fill('wrongpassword');
    await page.getByRole('button', { name: 'Sign In' }).click();
    
    await expect(page.getByText(/invalid|incorrect|could not/i)).toBeVisible({ timeout: 5000 });
  });

  test('should show error on failed registration', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/register`);
    
    await page.getByPlaceholder('Unique username').fill('');
    await page.getByPlaceholder('email@example.com').fill('invalid-email');
    await page.getByRole('button', { name: 'Create Account' }).click();
    
    await expect(page.getByText(/required|valid|error/i)).toBeVisible({ timeout: 3000 });
  });

  test('should redirect unauthenticated users to login', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/`);
    
    await expect(page).toHaveURL(`${FRONTEND_URL}/login`, { timeout: 5000 });
  });

  test('should handle backend connection failure gracefully', async ({ page }) => {
    const testUser = generateTestUser('backend_fail');
    
    await page.goto(`${FRONTEND_URL}/register`);
    await page.getByPlaceholder('Unique username').fill(testUser.username);
    await page.getByPlaceholder('email@example.com').fill(testUser.email);
    await page.getByPlaceholder('••••••••').first().fill(testUser.password);
    await page.getByPlaceholder('••••••••').nth(1).fill(testUser.password);
    await page.getByRole('button', { name: 'Create Account' }).click();
    
    await page.waitForURL(`${FRONTEND_URL}/login`);
    
    await page.getByPlaceholder('Enter your username').fill(testUser.username);
    await page.getByPlaceholder('••••••••').fill(testUser.password);
    await page.getByRole('button', { name: 'Sign In' }).click();
    
    await page.waitForURL(`${FRONTEND_URL}/`);
    
    const fileInput = page.locator('input[type="file"]');
    const csvFile = createTestCSVFile('connection_test.csv');
    await fileInput.setInputFiles(csvFile);
    await page.getByRole('button', { name: 'Run Analysis' }).click();
    
    await page.waitForTimeout(2000);
  });
});

test.describe('E2E: Responsive Design', () => {
  const viewports = [
    { name: 'mobile', width: 375, height: 667 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'desktop', width: 1280, height: 720 }
  ];

  for (const viewport of viewports) {
    test(`should render correctly on ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      
      const testUser = generateTestUser(`responsive_${viewport.name}`);
      
      await page.goto(`${FRONTEND_URL}/register`);
      await page.getByPlaceholder('Unique username').fill(testUser.username);
      await page.getByPlaceholder('email@example.com').fill(testUser.email);
      await page.getByPlaceholder('••••••••').first().fill(testUser.password);
      await page.getByPlaceholder('••••••••').nth(1).fill(testUser.password);
      await page.getByRole('button', { name: 'Create Account' }).click();
      
      await page.waitForURL(`${FRONTEND_URL}/login`);
      
      await page.getByPlaceholder('Enter your username').fill(testUser.username);
      await page.getByPlaceholder('••••••••').fill(testUser.password);
      await page.getByRole('button', { name: 'Sign In' }).click();
      
      await page.waitForURL(`${FRONTEND_URL}/`);
      await expect(page.getByText('Ready for Insights?')).toBeVisible({ timeout: 5000 });
    });
  }
});
