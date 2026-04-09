import { test, expect } from '@playwright/test';

test.describe('Dashboard - Upload Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('access_token', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJ1c2VybmFtZSI6InRlc3QiLCJleHAiOjE5MjM4Mzk5NjR9.test');
      localStorage.setItem('refresh_token', 'test-refresh-token');
    });
    await page.goto('/');
    await page.waitForTimeout(500);
  });

  test('should have file input with CSV accept attribute', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toHaveAttribute('accept', '.csv');
  });

  test('should show file name after file selection', async ({ page }) => {
    await page.locator('input[type="file"]').setInputFiles({
      name: 'test-data.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('col1,col2\n1,2\n3,4')
    });
    await expect(page.getByText('test-data.csv')).toBeVisible();
  });

  test('should have new analysis button visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'New' })).toBeVisible();
  });

  test('should clear job after clicking new analysis', async ({ page }) => {
    await page.getByRole('button', { name: 'New' }).click();
    await expect(page.getByText('Choose CSV')).toBeVisible();
  });
});

test.describe('Dashboard - History Mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('access_token', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJ1c2VybmFtZSI6InRlc3QiLCJleHAiOjE5MjM4Mzk5NjR9.test');
      localStorage.setItem('refresh_token', 'test-refresh-token');
    });
    await page.goto('/');
    await page.waitForTimeout(500);
  });

  test('should switch to history mode via desktop sidebar', async ({ page }) => {
    await page.getByRole('button', { name: '🕒 History' }).click();
    await expect(page.getByText('Active Session')).toBeVisible();
  });

  test('should switch back to current mode from history', async ({ page }) => {
    await page.getByRole('button', { name: '🕒 History' }).click();
    await expect(page.getByText('Active Session')).toBeVisible();
    await page.getByRole('button', { name: '📊 Current Analysis' }).click();
    await expect(page.getByText('Ready for Insights?')).toBeVisible();
  });
});

test.describe('Dashboard - Responsive', () => {
  test('should show hamburger menu on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.addInitScript(() => {
      localStorage.setItem('access_token', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJ1c2VybmFtZSI6InRlc3QiLCJleHAiOjE5MjM4Mzk5NjR9.test');
    });
    await page.goto('/');
    await page.waitForTimeout(500);
    await expect(page.getByRole('button', { name: 'Open navigation' })).toBeVisible();
  });

  test('should have mobile workspace toggle', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.addInitScript(() => {
      localStorage.setItem('access_token', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJ1c2VybmFtZSI6InRlc3QiLCJleHAiOjE5MjM4Mzk5NjR9.test');
    });
    await page.goto('/');
    await page.waitForTimeout(500);
    await expect(page.getByRole('button', { name: 'Lab' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'History' })).toBeVisible();
  });
});

test.describe('Dashboard - Edge Cases', () => {
  test('should handle no token', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL('/login');
  });

  test('should handle empty localStorage', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear();
    });
    await page.goto('/');
    await expect(page).toHaveURL('/login');
  });
});