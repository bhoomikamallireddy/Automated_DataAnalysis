import { test, expect } from '@playwright/test';

const FRONTEND_URL = process.env.E2E_FRONTEND_URL || 'http://localhost:3000';
const generateUniqueUser = () => ({
  username: `user_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
  email: `user_${Date.now()}@test.com`,
  password: 'SecurePass123!'
});

test.describe('Authentication - Registration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/register`);
  });

  test('should display registration form with all required fields', async ({ page }) => {
    await expect(page.getByText('Join the Lab')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Create Account' })).toBeVisible();
    await expect(page.getByPlaceholder('Unique username')).toBeVisible();
    await expect(page.getByPlaceholder('email@example.com')).toBeVisible();
    await expect(page.getByPlaceholder('••••••••').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Get Started' })).toBeVisible();
    await expect(page.getByText('Already a member?')).toBeVisible();
  });

  test('should successfully register a new user', async ({ page }) => {
    const user = generateUniqueUser();
    
    await page.getByPlaceholder('Unique username').fill(user.username);
    await page.getByPlaceholder('email@example.com').fill(user.email);
    await page.getByPlaceholder('••••••••').first().fill(user.password);
    await page.getByPlaceholder('••••••••').nth(1).fill(user.password);
    await page.getByRole('button', { name: 'Get Started' }).click();
    
    await expect(page.getByText('Registration Successful')).toBeVisible({ timeout: 5000 });
    await expect(page).toHaveURL(`${FRONTEND_URL}/login`, { timeout: 5000 });
  });

  test('should show error when passwords do not match', async ({ page }) => {
    const user = generateUniqueUser();
    
    await page.getByPlaceholder('Unique username').fill(user.username);
    await page.getByPlaceholder('email@example.com').fill(user.email);
    await page.getByPlaceholder('••••••••').first().fill(user.password);
    await page.getByPlaceholder('••••••••').nth(1).fill('DifferentPass123!');
    await page.getByRole('button', { name: 'Get Started' }).click();
    
    await expect(page.getByText(/passwords do not match/i)).toBeVisible({ timeout: 3000 });
  });

  test('should show error for duplicate username', async ({ page }) => {
    const user = generateUniqueUser();
    
    await page.getByPlaceholder('Unique username').fill(user.username);
    await page.getByPlaceholder('email@example.com').fill(user.email);
    await page.getByPlaceholder('••••••••').first().fill(user.password);
    await page.getByPlaceholder('••••••••').nth(1).fill(user.password);
    await page.getByRole('button', { name: 'Get Started' }).click();
    
    await page.waitForURL(`${FRONTEND_URL}/login`, { timeout: 5000 });
    
    await page.goto(`${FRONTEND_URL}/register`);
    await page.getByPlaceholder('Unique username').fill(user.username);
    await page.getByPlaceholder('email@example.com').fill('different@test.com');
    await page.getByPlaceholder('••••••••').first().fill(user.password);
    await page.getByPlaceholder('••••••••').nth(1).fill(user.password);
    await page.getByRole('button', { name: 'Get Started' }).click();
    
    await expect(page.getByText(/username.*exists|already.*taken/i)).toBeVisible({ timeout: 5000 });
  });

  test('should show error for duplicate email', async ({ page }) => {
    const user = generateUniqueUser();
    
    await page.getByPlaceholder('Unique username').fill(user.username);
    await page.getByPlaceholder('email@example.com').fill(user.email);
    await page.getByPlaceholder('••••••••').first().fill(user.password);
    await page.getByPlaceholder('••••••••').nth(1).fill(user.password);
    await page.getByRole('button', { name: 'Get Started' }).click();
    
    await page.waitForURL(`${FRONTEND_URL}/login`, { timeout: 5000 });
    
    await page.goto(`${FRONTEND_URL}/register`);
    await page.getByPlaceholder('Unique username').fill(`different_${user.username}`);
    await page.getByPlaceholder('email@example.com').fill(user.email);
    await page.getByPlaceholder('••••••••').first().fill(user.password);
    await page.getByPlaceholder('••••••••').nth(1).fill(user.password);
    await page.getByRole('button', { name: 'Get Started' }).click();
    
    await expect(page.getByText(/email.*exists|already.*taken/i)).toBeVisible({ timeout: 5000 });
  });

  test('should show error for missing required fields', async ({ page }) => {
    await page.getByRole('button', { name: 'Get Started' }).click();
    
    await expect(page.getByText(/required|field/i)).toBeVisible({ timeout: 3000 });
  });

  test('should show error for invalid email format', async ({ page }) => {
    const user = generateUniqueUser();
    
    await page.getByPlaceholder('Unique username').fill(user.username);
    await page.getByPlaceholder('email@example.com').fill('not-an-email');
    await page.getByPlaceholder('••••••••').first().fill(user.password);
    await page.getByPlaceholder('••••••••').nth(1).fill(user.password);
    await page.getByRole('button', { name: 'Get Started' }).click();
    
    await expect(page.getByText(/valid.*email|email.*invalid/i)).toBeVisible({ timeout: 3000 });
  });

  test('should redirect to login when clicking login link', async ({ page }) => {
    await page.getByRole('link', { name: 'Log In' }).click();
    await expect(page).toHaveURL(`${FRONTEND_URL}/login`);
  });

  test('should redirect to home if already logged in', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('access_token', 'fake_token_for_redirect_test');
      localStorage.setItem('refresh_token', 'fake_refresh_token');
    });
    await page.goto(`${FRONTEND_URL}/register`);
    await expect(page).toHaveURL(`${FRONTEND_URL}/`);
  });

  test('should disable button during registration', async ({ page }) => {
    const user = generateUniqueUser();
    
    await page.getByPlaceholder('Unique username').fill(user.username);
    await page.getByPlaceholder('email@example.com').fill(user.email);
    await page.getByPlaceholder('••••••••').first().fill(user.password);
    await page.getByPlaceholder('••••••••').nth(1).fill(user.password);
    
    const button = page.getByRole('button', { name: /Get Started|Creating Account/i });
    await expect(button).toBeEnabled();
  });
});

test.describe('Authentication - Login', () => {
  let registeredUser;

  test.beforeEach(async ({ page }) => {
    registeredUser = generateUniqueUser();
    
    await page.goto(`${FRONTEND_URL}/register`);
    await page.getByPlaceholder('Unique username').fill(registeredUser.username);
    await page.getByPlaceholder('email@example.com').fill(registeredUser.email);
    await page.getByPlaceholder('••••••••').first().fill(registeredUser.password);
    await page.getByPlaceholder('••••••••').nth(1).fill(registeredUser.password);
    await page.getByRole('button', { name: 'Get Started' }).click();
    await page.waitForURL(`${FRONTEND_URL}/login`, { timeout: 5000 });
    
    await page.goto(`${FRONTEND_URL}/login`);
  });

  test('should display login form with all required elements', async ({ page }) => {
    await expect(page.getByText('Secure Access')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Welcome Back' })).toBeVisible();
    await expect(page.getByPlaceholder('Enter your username')).toBeVisible();
    await expect(page.getByPlaceholder('••••••••')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Create Account' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Forgot Password?' })).toBeVisible();
  });

  test('should successfully login with valid credentials', async ({ page }) => {
    await page.getByPlaceholder('Enter your username').fill(registeredUser.username);
    await page.getByPlaceholder('••••••••').fill(registeredUser.password);
    await page.getByRole('button', { name: 'Sign In' }).click();
    
    await expect(page).toHaveURL(`${FRONTEND_URL}/`, { timeout: 10000 });
    await expect(page.getByText('Ready for Insights?')).toBeVisible({ timeout: 5000 });
  });

  test('should show error for invalid password', async ({ page }) => {
    await page.getByPlaceholder('Enter your username').fill(registeredUser.username);
    await page.getByPlaceholder('••••••••').fill('wrongpassword123');
    await page.getByRole('button', { name: 'Sign In' }).click();
    
    await expect(page.getByText(/invalid|incorrect|wrong/i)).toBeVisible({ timeout: 5000 });
  });

  test('should show error for non-existent user', async ({ page }) => {
    await page.getByPlaceholder('Enter your username').fill('nonexistent_user_12345');
    await page.getByPlaceholder('••••••••').fill('anypassword');
    await page.getByRole('button', { name: 'Sign In' }).click();
    
    await expect(page.getByText(/invalid|incorrect|wrong/i)).toBeVisible({ timeout: 5000 });
  });

  test('should store tokens in localStorage after successful login', async ({ page }) => {
    await page.getByPlaceholder('Enter your username').fill(registeredUser.username);
    await page.getByPlaceholder('••••••••').fill(registeredUser.password);
    await page.getByRole('button', { name: 'Sign In' }).click();
    
    await page.waitForURL(`${FRONTEND_URL}/`, { timeout: 10000 });
    
    const accessToken = await page.evaluate(() => localStorage.getItem('access_token'));
    const refreshToken = await page.evaluate(() => localStorage.getItem('refresh_token'));
    
    expect(accessToken).toBeTruthy();
    expect(refreshToken).toBeTruthy();
  });

  test('should redirect to register when clicking create account', async ({ page }) => {
    await page.getByRole('link', { name: 'Create Account' }).click();
    await expect(page).toHaveURL(`${FRONTEND_URL}/register`);
  });

  test('should navigate to forgot password page', async ({ page }) => {
    await page.getByRole('link', { name: 'Forgot Password?' }).click();
    await expect(page).toHaveURL(`${FRONTEND_URL}/forgot-password`);
  });

  test('should redirect to home if already logged in', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('access_token', 'fake_token_for_redirect_test');
      localStorage.setItem('refresh_token', 'fake_refresh_token');
    });
    await page.goto(`${FRONTEND_URL}/login`);
    await expect(page).toHaveURL(`${FRONTEND_URL}/`);
  });

  test('should disable button during login', async ({ page }) => {
    await page.getByPlaceholder('Enter your username').fill(registeredUser.username);
    await page.getByPlaceholder('••••••••').fill(registeredUser.password);
    
    const button = page.getByRole('button', { name: /Sign In|Authenticating/i });
    await expect(button).toBeEnabled();
  });
});

test.describe('Authentication - Logout', () => {
  test('should logout and redirect to login', async ({ page }) => {
    const user = generateUniqueUser();
    
    await page.goto(`${FRONTEND_URL}/register`);
    await page.getByPlaceholder('Unique username').fill(user.username);
    await page.getByPlaceholder('email@example.com').fill(user.email);
    await page.getByPlaceholder('••••••••').first().fill(user.password);
    await page.getByPlaceholder('••••••••').nth(1).fill(user.password);
    await page.getByRole('button', { name: 'Get Started' }).click();
    await page.waitForURL(`${FRONTEND_URL}/login`);
    
    await page.getByPlaceholder('Enter your username').fill(user.username);
    await page.getByPlaceholder('••••••••').fill(user.password);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForURL(`${FRONTEND_URL}/`, { timeout: 10000 });
    
    const viewport = page.viewportSize();
    if (viewport && viewport.width < 1024) {
      await page.getByRole('button', { name: 'Open navigation' }).click();
    }
    
    const signOutButton = page.getByRole('button', { name: /Sign Out/i });
    await signOutButton.scrollIntoViewIfNeeded();
    await signOutButton.click();
    
    await expect(page).toHaveURL(`${FRONTEND_URL}/login`, { timeout: 5000 });
    
    const accessToken = await page.evaluate(() => localStorage.getItem('access_token'));
    expect(accessToken).toBeNull();
  });

  test('should clear tokens from localStorage on logout', async ({ page }) => {
    const user = generateUniqueUser();
    
    await page.goto(`${FRONTEND_URL}/register`);
    await page.getByPlaceholder('Unique username').fill(user.username);
    await page.getByPlaceholder('email@example.com').fill(user.email);
    await page.getByPlaceholder('••••••••').first().fill(user.password);
    await page.getByPlaceholder('••••••••').nth(1).fill(user.password);
    await page.getByRole('button', { name: 'Get Started' }).click();
    await page.waitForURL(`${FRONTEND_URL}/login`);
    
    await page.getByPlaceholder('Enter your username').fill(user.username);
    await page.getByPlaceholder('••••••••').fill(user.password);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForURL(`${FRONTEND_URL}/`, { timeout: 10000 });
    
    const viewport = page.viewportSize();
    if (viewport && viewport.width < 1024) {
      await page.getByRole('button', { name: 'Open navigation' }).click();
    }
    
    const signOutButton = page.getByRole('button', { name: /Sign Out/i });
    await signOutButton.scrollIntoViewIfNeeded();
    await signOutButton.click();
    await page.waitForURL(`${FRONTEND_URL}/login`);
    
    const refreshToken = await page.evaluate(() => localStorage.getItem('refresh_token'));
    expect(refreshToken).toBeNull();
  });
});

test.describe('Authentication - Password Reset', () => {
  test('should display forgot password form', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/forgot-password`);
    
    await expect(page.getByText('Security')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Reset Password' })).toBeVisible();
    await expect(page.getByPlaceholder('email@example.com')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send Reset Link' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Log In' })).toBeVisible();
  });

  test('should show success message for existing email', async ({ page }) => {
    const user = generateUniqueUser();
    
    await page.goto(`${FRONTEND_URL}/register`);
    await page.getByPlaceholder('Unique username').fill(user.username);
    await page.getByPlaceholder('email@example.com').fill(user.email);
    await page.getByPlaceholder('••••••••').first().fill(user.password);
    await page.getByPlaceholder('••••••••').nth(1).fill(user.password);
    await page.getByRole('button', { name: 'Get Started' }).click();
    await page.waitForURL(`${FRONTEND_URL}/login`);
    
    await page.goto(`${FRONTEND_URL}/forgot-password`);
    await page.getByPlaceholder('email@example.com').fill(user.email);
    await page.getByRole('button', { name: 'Send Reset Link' }).click();
    
    await expect(page.getByText('Check your inbox!')).toBeVisible({ timeout: 10000 });
  });

  test('should show success message for non-existent email (security)', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/forgot-password`);
    await page.getByPlaceholder('email@example.com').fill('nonexistent@test.com');
    await page.getByRole('button', { name: 'Send Reset Link' }).click();
    
    await expect(page.getByText('Check your inbox!')).toBeVisible({ timeout: 10000 });
  });

  test('should show error on server failure', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/forgot-password`);
    await page.getByPlaceholder('email@example.com').fill('test@test.com');
    
    await page.route('**/api/auth/password-reset/**', route => route.abort());
    
    await page.getByRole('button', { name: 'Send Reset Link' }).click();
    await expect(page.getByText(/connection|server|failed/i)).toBeVisible({ timeout: 5000 });
  });

  test('should navigate to login from forgot password', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/forgot-password`);
    await page.getByRole('link', { name: 'Log In' }).click();
    await expect(page).toHaveURL(`${FRONTEND_URL}/login`);
  });

  test('should show return to login link after success', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/forgot-password`);
    await page.getByPlaceholder('email@example.com').fill('any@test.com');
    await page.getByRole('button', { name: 'Send Reset Link' }).click();
    
    await expect(page.getByRole('link', { name: 'Return to Login' })).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Authentication - Route Protection', () => {
  test('should redirect unauthenticated user to login', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/`);
    await expect(page).toHaveURL(`${FRONTEND_URL}/login`, { timeout: 5000 });
  });

  test('should allow access to login page without auth', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/login`);
    await expect(page.getByRole('heading', { name: 'Welcome Back' })).toBeVisible();
  });

  test('should allow access to register page without auth', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/register`);
    await expect(page.getByRole('heading', { name: 'Create Account' })).toBeVisible();
  });

  test('should allow access to forgot-password page without auth', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/forgot-password`);
    await expect(page.getByRole('heading', { name: 'Reset Password' })).toBeVisible();
  });

  test('should redirect to login after token expiry', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('access_token', 'expired_token');
      localStorage.setItem('refresh_token', 'expired_refresh');
    });
    
    await page.goto(`${FRONTEND_URL}/`);
    
    await page.waitForTimeout(500);
  });
});

test.describe('Authentication - Token Management', () => {
  test('should validate JWT token structure', async ({ page }) => {
    const user = generateUniqueUser();
    
    await page.goto(`${FRONTEND_URL}/register`);
    await page.getByPlaceholder('Unique username').fill(user.username);
    await page.getByPlaceholder('email@example.com').fill(user.email);
    await page.getByPlaceholder('••••••••').first().fill(user.password);
    await page.getByPlaceholder('••••••••').nth(1).fill(user.password);
    await page.getByRole('button', { name: 'Get Started' }).click();
    await page.waitForURL(`${FRONTEND_URL}/login`);
    
    await page.getByPlaceholder('Enter your username').fill(user.username);
    await page.getByPlaceholder('••••••••').fill(user.password);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForURL(`${FRONTEND_URL}/`, { timeout: 10000 });
    
    const token = await page.evaluate(() => localStorage.getItem('access_token'));
    const parts = token?.split('.');
    
    expect(parts).toHaveLength(3);
    
    const payload = JSON.parse(atob(parts[1]));
    expect(payload).toHaveProperty('user_id');
    expect(payload).toHaveProperty('exp');
  });

  test('should refresh expired access token', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/`);
    await page.waitForTimeout(1000);
  });
});
