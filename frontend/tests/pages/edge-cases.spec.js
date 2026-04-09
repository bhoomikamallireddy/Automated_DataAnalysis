import { test, expect } from '@playwright/test';

test.describe('Boundary Conditions', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('access_token', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJ1c2VybmFtZSI6InRlc3QiLCJleHAiOjE5MjM4Mzk5NjR9.test');
    });
    await page.goto('/');
    await page.waitForTimeout(500);
  });

  test('should handle very long filename', async ({ page }) => {
    const longFilename = 'a'.repeat(200) + '.csv';
    await page.locator('input[type="file"]').setInputFiles({
      name: longFilename,
      mimeType: 'text/csv',
      buffer: Buffer.from('col1\n1')
    });
    await expect(page.getByText(longFilename)).toBeVisible();
  });
});

test.describe('Performance', () => {
  test('should load page within reasonable time', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/');
    await page.waitForTimeout(500);
    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(10000);
  });
});

test.describe('Browser Navigation', () => {
  test('should handle rapid page navigation', async ({ page }) => {
    await page.goto('/login');
    await page.goto('/register');
    await page.goto('/forgot-password');
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Welcome Back' })).toBeVisible();
  });

  test('should handle browser back button', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('link', { name: 'Create Account' }).click();
    await page.waitForTimeout(500);
    await page.goBack();
    await expect(page.getByRole('heading', { name: 'Welcome Back' })).toBeVisible();
  });
});

test.describe('Security', () => {
  test('should work with localStorage', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('access_token', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJ1c2VybmFtZSI6InRlc3QiLCJleHAiOjE5MjM4Mzk5NjR9.test');
    });
    await page.goto('/');
    await page.waitForTimeout(500);
    const hasToken = await page.evaluate(() => localStorage.getItem('access_token') !== null);
    expect(hasToken).toBe(true);
  });
});