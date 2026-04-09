import { test, expect } from '@playwright/test';

test.describe('Home Page - Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('access_token', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJ1c2VybmFtZSI6InRlc3QiLCJleHAiOjE5MjM4Mzk5NjR9.test');
      localStorage.setItem('refresh_token', 'test-refresh-token');
    });
    await page.goto('/');
  });

  test('should display dashboard after auth check', async ({ page }) => {
    await page.waitForTimeout(500);
    await expect(page.getByRole('heading', { name: 'AutoEDA' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Project Workspace' })).toBeVisible();
  });

  test('should display sidebar with workspace options', async ({ page }) => {
    await page.waitForTimeout(500);
    await expect(page.getByText('Workspace', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '📊 Current Analysis' })).toBeVisible();
    await expect(page.getByRole('button', { name: '🕒 History' })).toBeVisible();
  });

  test('should display upload controls', async ({ page }) => {
    await page.waitForTimeout(500);
    await expect(page.getByText('Choose CSV')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Run Analysis' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'New' })).toBeVisible();
  });

  test('should display zero state when no job', async ({ page }) => {
    await page.waitForTimeout(500);
    await expect(page.getByText('Ready for Insights?')).toBeVisible();
  });

  test('should display sign out button', async ({ page }) => {
    await page.waitForTimeout(500);
    await expect(page.getByRole('button', { name: 'Sign Out' })).toBeVisible();
  });

  test('should navigate to login on sign out', async ({ page }) => {
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: 'Sign Out' }).click();
    await expect(page).toHaveURL('/login');
  });

  test('should switch between Current Analysis and History via sidebar', async ({ page }) => {
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: '🕒 History' }).click();
    await expect(page.getByText('Active Session')).toBeVisible();
    await page.getByRole('button', { name: '📊 Current Analysis' }).click();
    await expect(page.getByText('Ready for Insights?')).toBeVisible();
  });

  test('should handle file selection', async ({ page }) => {
    await page.waitForTimeout(500);
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toBeAttached();
  });
});

test.describe('Home Page - Unauthorized', () => {
  test('should redirect to login when not authenticated', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL('/login');
  });
});