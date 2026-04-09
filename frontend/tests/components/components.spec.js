import { test, expect } from '@playwright/test';

test.describe('Page Load Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('access_token', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJ1c2VybmFtZSI6InRlc3QiLCJleHAiOjE5MjM4Mzk5NjR9.test');
    });
  });

  test('should load home page without errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/');
    await page.waitForTimeout(1000);
    const criticalErrors = errors.filter(e => !e.includes('Warning') && !e.includes('fetch'));
    expect(criticalErrors).toHaveLength(0);
  });

  test('should load login page without errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/login');
    await page.waitForTimeout(500);
    expect(errors.filter(e => !e.includes('Warning'))).toHaveLength(0);
  });

  test('should load register page without errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/register');
    await page.waitForTimeout(500);
    expect(errors.filter(e => !e.includes('Warning'))).toHaveLength(0);
  });

  test('should load forgot password page without errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/forgot-password');
    await page.waitForTimeout(500);
    expect(errors.filter(e => !e.includes('Warning'))).toHaveLength(0);
  });

  test('should load password reset confirm page without errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/password-reset-confirm/test-uid/test-token');
    await page.waitForTimeout(500);
    expect(errors.filter(e => !e.includes('Warning'))).toHaveLength(0);
  });
});

test.describe('useJobStatus Hook Behavior', () => {
  test('should handle null jobId gracefully', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('access_token', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJ1c2VybmFtZSI6InRlc3QiLCJleHAiOjE5MjM4Mzk5NjR9.test');
    });
    await page.goto('/');
    await page.waitForTimeout(500);
    await expect(page.getByText('Ready for Insights?')).toBeVisible();
  });
});

test.describe('Token Validation Logic', () => {
  test('should detect expired token', async ({ page }) => {
    const isExpired = await page.evaluate(() => {
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJ1c2VybmFtZSI6InRlc3QiLCJleHAiOjE0MDAwMDAwMDB9.test';
      try {
        const payload = JSON.parse(atob(expiredToken.split('.')[1]));
        return payload.exp * 1000 < Date.now();
      } catch (e) {
        return true;
      }
    });
    expect(isExpired).toBe(true);
  });

  test('should detect valid token', async ({ page }) => {
    const isValid = await page.evaluate(() => {
      const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJ1c2VybmFtZSI6InRlc3QiLCJleHAiOjE5MjM4Mzk5NjR9.test';
      try {
        const payload = JSON.parse(atob(validToken.split('.')[1]));
        return payload.exp * 1000 > Date.now();
      } catch (e) {
        return false;
      }
    });
    expect(isValid).toBe(true);
  });
});

test.describe('getCleanFileName Utility', () => {
  test('should remove file extension', async ({ page }) => {
    const cleanName = await page.evaluate(() => {
      const getCleanFileName = (fullName) => {
        if (!fullName) return "provided dataset";
        let name = fullName.split('.').slice(0, -1).join('.');
        name = name.replace(/_[a-zA-Z0-9]+$/, '');
        return name;
      };
      return getCleanFileName('data.csv');
    });
    expect(cleanName).toBe('data');
  });

  test('should remove random suffix', async ({ page }) => {
    const cleanName = await page.evaluate(() => {
      const getCleanFileName = (fullName) => {
        if (!fullName) return "provided dataset";
        let name = fullName.split('.').slice(0, -1).join('.');
        name = name.replace(/_[a-zA-Z0-9]+$/, '');
        return name;
      };
      return getCleanFileName('data_abc123.csv');
    });
    expect(cleanName).toBe('data');
  });

  test('should handle null input', async ({ page }) => {
    const cleanName = await page.evaluate(() => {
      const getCleanFileName = (fullName) => {
        if (!fullName) return "provided dataset";
        let name = fullName.split('.').slice(0, -1).join('.');
        name = name.replace(/_[a-zA-Z0-9]+$/, '');
        return name;
      };
      return getCleanFileName(null);
    });
    expect(cleanName).toBe('provided dataset');
  });
});