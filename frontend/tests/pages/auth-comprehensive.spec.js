import { test, expect } from '@playwright/test';

test.describe('Login Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('should display login form elements', async ({ page }) => {
    await expect(page.getByText('Secure Access')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Welcome Back' })).toBeVisible();
    await expect(page.getByPlaceholder('Enter your username')).toBeVisible();
    await expect(page.getByPlaceholder('••••••••')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
  });

  test('should have registration link', async ({ page }) => {
    await expect(page.getByText('New here?')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Create Account' })).toBeVisible();
  });

  test('should have forgot password link', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'Forgot Password?' })).toBeVisible();
  });

  test('should navigate to register page', async ({ page }) => {
    await page.getByRole('link', { name: 'Create Account' }).click();
    await expect(page).toHaveURL('/register');
  });

  test('should navigate to forgot password page', async ({ page }) => {
    await page.getByRole('link', { name: 'Forgot Password?' }).click();
    await expect(page).toHaveURL('/forgot-password');
  });

  test('should redirect to home if already logged in', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('access_token', 'fake-token');
      localStorage.setItem('refresh_token', 'fake-refresh');
    });
    await page.goto('/login');
    await expect(page).toHaveURL('/');
  });
});

test.describe('Register Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/register');
  });

  test('should display registration form elements', async ({ page }) => {
    await expect(page.getByText('Join the Lab')).toBeVisible();
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

test.describe('Forgot Password Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/forgot-password');
  });

  test('should display form elements', async ({ page }) => {
    await expect(page.getByText('Security')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Reset Password' })).toBeVisible();
    await expect(page.getByPlaceholder('email@example.com')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send Reset Link' })).toBeVisible();
  });

  test('should have login link', async ({ page }) => {
    await expect(page.getByText('Remembered it?')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Log In' })).toBeVisible();
  });

  test('should navigate to login page', async ({ page }) => {
    await page.getByRole('link', { name: 'Log In' }).click();
    await expect(page).toHaveURL('/login');
  });
});

test.describe('Password Reset Confirm Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/password-reset-confirm/test-uid/test-token');
  });

  test('should display form elements', async ({ page }) => {
    await expect(page.getByText('Security')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'New Password' })).toBeVisible();
  });
});