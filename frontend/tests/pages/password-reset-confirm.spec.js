import { test, expect } from '@playwright/test';

test.describe('Password Reset Confirm Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/password-reset-confirm/test-uid/test-token');
  });

  test('should display form elements', async ({ page }) => {
    await expect(page.getByText('Security')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'New Password' })).toBeVisible();
    await expect(page.getByText('Please enter your new secure password below.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Update Password' })).toBeVisible();
  });
});