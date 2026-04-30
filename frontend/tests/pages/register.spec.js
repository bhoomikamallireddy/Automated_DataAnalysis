import { test, expect } from '@playwright/test';

test.describe('Register Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/register');
  });

  test('should display registration form elements', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Create Account' })).toBeVisible();
    await expect(page.getByPlaceholder('Unique username')).toBeVisible();
    await expect(page.getByPlaceholder('email@example.com')).toBeVisible();
  });

  test('should have login link', async ({ page }) => {
    await expect(page.getByText('Already a member?')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Log In' })).toBeVisible();
  });

  test('should navigate to login page', async ({ page }) => {
    await page.getByRole('link', { name: 'Log In' }).click();
    await expect(page).toHaveURL('/login');
  });

  test('should redirect to home if already logged in', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('access_token', 'fake-token');
      localStorage.setItem('refresh_token', 'fake-refresh');
    });
    await page.goto('/register');
    await expect(page).toHaveURL('/');
  });
});
