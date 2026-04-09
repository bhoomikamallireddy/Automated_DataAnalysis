import { test, expect } from '@playwright/test';

test.describe('Login Page Layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('should have centered form container', async ({ page }) => {
    const container = page.locator('.min-h-screen');
    await expect(container).toBeVisible();
  });

  test('should have submit button', async ({ page }) => {
    const button = page.getByRole('button', { name: 'Sign In' });
    await expect(button).toBeVisible();
  });
});

test.describe('Dashboard Layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('access_token', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJ1c2VybmFtZSI6InRlc3QiLCJleHAiOjE5MjM4Mzk5NjR9.test');
    });
    await page.goto('/');
    await page.waitForTimeout(500);
  });

  test('should have flex layout for main container', async ({ page }) => {
    const mainContainer = page.locator('.flex.h-screen');
    await expect(mainContainer).toBeVisible();
  });

  test('should have sidebar', async ({ page }) => {
    const sidebar = page.locator('aside');
    await expect(sidebar).toBeVisible();
  });

  test('should have sticky header', async ({ page }) => {
    const header = page.locator('header');
    await expect(header).toHaveClass(/sticky/);
  });
});

test.describe('Loading States', () => {
  test('should show spinner while checking auth', async ({ page }) => {
    await page.goto('/');
    const spinner = page.locator('.animate-spin');
    await expect(spinner).toBeVisible();
  });

  test('should hide spinner after auth check completes', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('access_token', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJ1c2VybmFtZSI6InRlc3QiLCJleHAiOjE5MjM4Mzk5NjR9.test');
    });
    await page.goto('/');
    await page.waitForTimeout(1000);
    const spinner = page.locator('.animate-spin');
    await expect(spinner).not.toBeVisible();
  });
});