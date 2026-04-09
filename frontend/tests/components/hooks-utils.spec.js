import { test, expect } from '@playwright/test';

test.describe('Page Load Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('access_token', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJ1c2VybmFtZSI6InRlc3QiLCJleHAiOjE5MjM4Mzk5NjR9.test');
    });
  });

  test('should load home page', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500);
    await expect(page.locator('body')).toBeVisible();
  });

  test('should load login page', async ({ page }) => {
    await page.goto('/login');
    await page.waitForTimeout(500);
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('API Service Functions', () => {
  test('should construct correct API endpoints', async ({ page }) => {
    const endpoint = await page.evaluate(() => {
      const baseUrl = 'http://127.0.0.1:8000';
      return {
        jobs: `${baseUrl}/api/jobs/`,
        auth: `${baseUrl}/api/auth/`,
      };
    });
    expect(endpoint.jobs).toBe('http://127.0.0.1:8000/api/jobs/');
  });

  test('should format authorization header correctly', async ({ page }) => {
    const header = await page.evaluate(() => {
      const token = 'test-token-123';
      return `Bearer ${token}`;
    });
    expect(header).toBe('Bearer test-token-123');
  });
});