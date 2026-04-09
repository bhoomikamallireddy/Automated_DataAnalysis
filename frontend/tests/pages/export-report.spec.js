import { test, expect } from '@playwright/test';

test.describe('Page Load Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('access_token', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJ1c2VybmFtZSI6InRlc3QiLCJleHAiOjE5MjM4Mzk5NjR9.test');
    });
    await page.goto('/');
    await page.waitForTimeout(500);
  });

  test('should load page without critical errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.waitForTimeout(1000);
    const criticalErrors = errors.filter(e => !e.includes('Warning') && !e.includes('fetch'));
    expect(criticalErrors).toHaveLength(0);
  });

  test('should render main content', async ({ page }) => {
    await expect(page.locator('main')).toBeVisible();
  });

  test('should render sidebar', async ({ page }) => {
    await expect(page.locator('aside')).toBeVisible();
  });
});