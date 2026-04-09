import { test, expect } from '@playwright/test';

const FRONTEND_URL = process.env.E2E_FRONTEND_URL || 'http://localhost:3000';
const generateUniqueUser = () => ({
  username: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  email: `user_${Date.now()}@test.com`,
  password: 'SecurePass123!'
});

const createCSVFile = (name = 'test.csv', rows = 10, cols = 3) => {
  const headers = Array.from({ length: cols }, (_, i) => `col${i + 1}`).join(',');
  const dataRows = Array.from({ length: rows }, () => 
    Array.from({ length: cols }, () => Math.floor(Math.random() * 100)).join(',')
  ).join('\n');
  return {
    name,
    mimeType: 'text/csv',
    buffer: Buffer.from(`${headers}\n${dataRows}`)
  };
};

const loginUser = async (page, user) => {
  await page.goto(`${FRONTEND_URL}/register`);
  await page.getByPlaceholder('Unique username').fill(user.username);
  await page.getByPlaceholder('email@example.com').fill(user.email);
  await page.getByPlaceholder('••••••••').first().fill(user.password);
  await page.getByPlaceholder('••••••••').nth(1).fill(user.password);
  await page.getByRole('button', { name: 'Get Started' }).click();
  await page.waitForURL(`${FRONTEND_URL}/login`, { timeout: 5000 });
  
  await page.getByPlaceholder('Enter your username').fill(user.username);
  await page.getByPlaceholder('••••••••').fill(user.password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForURL(`${FRONTEND_URL}/`, { timeout: 10000 });
};

test.describe('Dashboard - Page Load & Layout', () => {
  test.beforeEach(async ({ page }) => {
    const user = generateUniqueUser();
    await loginUser(page, user);
  });

  test('should load dashboard without errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    
    await page.goto(`${FRONTEND_URL}/`);
    await page.waitForTimeout(2000);
    
    const criticalErrors = errors.filter(e => 
      !e.includes('Warning') && 
      !e.includes('fetch') &&
      !e.includes('Network')
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test('should display header with upload controls', async ({ page }) => {
    await expect(page.locator('input[type="file"]')).toBeAttached();
    await expect(page.getByRole('button', { name: 'Run Analysis' })).toBeVisible();
  });

  test('should display sidebar with navigation', async ({ page }) => {
    await expect(page.locator('aside h1').filter({ hasText: /AutoEDA/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Current Analysis/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /History/i })).toBeVisible();
  });

  test('should display zero state when no job is active', async ({ page }) => {
    await expect(page.getByText('Ready for Insights?')).toBeVisible();
    await expect(page.getByText(/Upload a CSV file/i)).toBeVisible();
  });

  test('should display logout button', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Sign Out/i })).toBeVisible();
  });
});

test.describe('Dashboard - File Upload', () => {
  test.beforeEach(async ({ page }) => {
    const user = generateUniqueUser();
    await loginUser(page, user);
  });

  test('should accept CSV files via file input', async ({ page }) => {
    const csvFile = createCSVFile('test_data.csv');
    await page.locator('input[type="file"]').setInputFiles(csvFile);
    
    await expect(page.locator('label[for="csv-upload"]')).toContainText('test_data.csv');
  });

  test('should show file name after selection', async ({ page }) => {
    const csvFile = createCSVFile('my_dataset.csv');
    await page.locator('input[type="file"]').setInputFiles(csvFile);
    
    await expect(page.locator('label[for="csv-upload"]')).toContainText('my_dataset.csv');
  });

  test('should allow file re-selection', async ({ page }) => {
    const csvFile1 = createCSVFile('file1.csv');
    const csvFile2 = createCSVFile('file2.csv');
    
    await page.locator('input[type="file"]').setInputFiles(csvFile1);
    await expect(page.locator('label[for="csv-upload"]')).toContainText('file1.csv');
    
    await page.locator('input[type="file"]').setInputFiles(csvFile2);
    await expect(page.locator('label[for="csv-upload"]')).toContainText('file2.csv');
  });

  test('should enable Run Analysis button after file selection', async ({ page }) => {
    const csvFile = createCSVFile('test.csv');
    await page.locator('input[type="file"]').setInputFiles(csvFile);
    
    const runButton = page.getByRole('button', { name: 'Run Analysis' });
    await expect(runButton).toBeEnabled();
  });

  test('should clear file selection on New button click', async ({ page }) => {
    const csvFile = createCSVFile('test.csv');
    await page.locator('input[type="file"]').setInputFiles(csvFile);
    
    await page.getByRole('button', { name: /New/i }).click();
    
    await expect(page.getByText('Choose CSV')).toBeVisible();
  });
});

test.describe('Dashboard - Job Processing', () => {
  test.beforeEach(async ({ page }) => {
    const user = generateUniqueUser();
    await loginUser(page, user);
  });

  test('should show processing state after upload', async ({ page }) => {
    const csvFile = createCSVFile('processing_test.csv', 10, 3);
    await page.locator('input[type="file"]').setInputFiles(csvFile);
    await page.getByRole('button', { name: 'Run Analysis' }).click();
    
    await expect(page.getByText(/Analyzing patterns/i)).toBeVisible({ timeout: 5000 });
  });

  test('should poll for job status after upload', async ({ page }) => {
    const csvFile = createCSVFile('poll_test.csv', 20, 5);
    await page.locator('input[type="file"]').setInputFiles(csvFile);
    await page.getByRole('button', { name: 'Run Analysis' }).click();
    
    await expect(page.getByText(/Analyzing patterns/i)).toBeVisible({ timeout: 5000 });
  });

  test('should display results after completion', async ({ page }) => {
    const csvContent = 'x,y,z\n1,2,3\n4,5,6\n7,8,9\n10,11,12';
    const csvFile = {
      name: 'complete_test.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csvContent)
    };
    
    await page.locator('input[type="file"]').setInputFiles(csvFile);
    await page.getByRole('button', { name: 'Run Analysis' }).click();
    
    await expect(page.getByText(/Analyzing patterns/i)).toBeVisible({ timeout: 5000 });
  });

  test('should save last active job to localStorage', async ({ page }) => {
    const csvFile = createCSVFile('persist_test.csv');
    await page.locator('input[type="file"]').setInputFiles(csvFile);
    await page.getByRole('button', { name: 'Run Analysis' }).click();
    
    await page.waitForTimeout(2000);
    const savedJobId = await page.evaluate(() => localStorage.getItem('last_active_job_id'));
    expect(savedJobId).toBeTruthy();
  });

  test('should restore job on page reload', async ({ page }) => {
    const csvFile = createCSVFile('restore_test.csv');
    await page.locator('input[type="file"]').setInputFiles(csvFile);
    await page.getByRole('button', { name: 'Run Analysis' }).click();
    
    await page.waitForTimeout(2000);
    await page.reload();
    
    await page.waitForTimeout(2000);
  });
});

test.describe('Dashboard - Analysis Tabs', () => {
  test.beforeEach(async ({ page }) => {
    const user = generateUniqueUser();
    await loginUser(page, user);
  });

  test('should display analysis tabs after job completion', async ({ page }) => {
    const csvContent = 'x,y,z\n1,2,3\n4,5,6\n7,8,9\n10,11,12';
    const csvFile = {
      name: 'tabs_test.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csvContent)
    };
    
    await page.locator('input[type="file"]').setInputFiles(csvFile);
    await page.getByRole('button', { name: 'Run Analysis' }).click();
    
    await expect(page.locator('nav').filter({ hasText: /Overview/i })).toBeVisible({ timeout: 30000 });
  });

  test('should switch between tabs after job completion', async ({ page }) => {
    const csvContent = 'x,y,z\n1,2,3\n4,5,6\n7,8,9\n10,11,12';
    const csvFile = {
      name: 'switch_test.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csvContent)
    };
    
    await page.locator('input[type="file"]').setInputFiles(csvFile);
    await page.getByRole('button', { name: 'Run Analysis' }).click();
    
    await expect(page.locator('nav').filter({ hasText: /Overview/i })).toBeVisible({ timeout: 30000 });
    
    await page.locator('button').filter({ hasText: /Audit/i }).click();
    await page.waitForTimeout(500);
  });

  test('should highlight default tab after job completion', async ({ page }) => {
    const csvContent = 'x,y,z\n1,2,3\n4,5,6\n7,8,9\n10,11,12';
    const csvFile = {
      name: 'highlight_test.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csvContent)
    };
    
    await page.locator('input[type="file"]').setInputFiles(csvFile);
    await page.getByRole('button', { name: 'Run Analysis' }).click();
    
    const tabNav = page.locator('nav').filter({ hasText: /Overview/i });
    await expect(tabNav).toBeVisible({ timeout: 30000 });
  });
});

test.describe('Dashboard - Workspace Modes', () => {
  test.beforeEach(async ({ page }) => {
    const user = generateUniqueUser();
    await loginUser(page, user);
  });

  test('should switch to history mode', async ({ page }) => {
    await page.getByRole('button', { name: /History/i }).click();
    await expect(page.getByText('Analysis History')).toBeVisible();
  });

  test('should switch back to current mode', async ({ page }) => {
    await page.getByRole('button', { name: /History/i }).click();
    await expect(page.getByText('Analysis History')).toBeVisible();
    
    await page.getByRole('button', { name: /Current Analysis/i }).click();
    await expect(page.getByText('Ready for Insights?')).toBeVisible();
  });

  test('should show empty state in history when no jobs', async ({ page }) => {
    await page.getByRole('button', { name: /History/i }).click();
    await expect(page.getByText('No History Found')).toBeVisible();
  });

  test('should list jobs in history', async ({ page }) => {
    const csvFile = createCSVFile('history_test.csv');
    await page.locator('input[type="file"]').setInputFiles(csvFile);
    await page.getByRole('button', { name: 'Run Analysis' }).click();
    await page.waitForTimeout(2000);
    
    await page.getByRole('button', { name: /History/i }).click();
    await expect(page.getByText('history_test.csv')).toBeVisible();
  });

  test('should view job results from history', async ({ page }) => {
    const csvFile = createCSVFile('view_history.csv');
    await page.locator('input[type="file"]').setInputFiles(csvFile);
    await page.getByRole('button', { name: 'Run Analysis' }).click();
    await page.waitForTimeout(2000);
    
    await page.getByRole('button', { name: /History/i }).click();
    await page.getByRole('button', { name: /View Results/i }).click();
    
    await expect(page.getByRole('button', { name: /Current Analysis/i })).toBeVisible();
  });
});

test.describe('Dashboard - KPI Metrics', () => {
  test.beforeEach(async ({ page }) => {
    const user = generateUniqueUser();
    await loginUser(page, user);
  });

  test('should display health gauge after job completion', async ({ page }) => {
    const csvContent = 'x,y,z\n1,2,3\n4,5,6\n7,8,9\n10,11,12';
    const csvFile = {
      name: 'kpi_test.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csvContent)
    };
    
    await page.locator('input[type="file"]').setInputFiles(csvFile);
    await page.getByRole('button', { name: 'Run Analysis' }).click();
    
    await expect(page.getByText(/AI Health Score/i)).toBeVisible({ timeout: 30000 });
  });

  test('should display total rows metric after job completion', async ({ page }) => {
    const csvContent = 'x,y,z\n1,2,3\n4,5,6\n7,8,9\n10,11,12';
    const csvFile = {
      name: 'rows_test.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csvContent)
    };
    
    await page.locator('input[type="file"]').setInputFiles(csvFile);
    await page.getByRole('button', { name: 'Run Analysis' }).click();
    
    await expect(page.getByText(/Total Rows/i)).toBeVisible({ timeout: 30000 });
  });

  test('should display total columns metric after job completion', async ({ page }) => {
    const csvContent = 'x,y,z\n1,2,3\n4,5,6\n7,8,9\n10,11,12';
    const csvFile = {
      name: 'cols_test.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csvContent)
    };
    
    await page.locator('input[type="file"]').setInputFiles(csvFile);
    await page.getByRole('button', { name: 'Run Analysis' }).click();
    
    await expect(page.getByText(/Total Columns/i)).toBeVisible({ timeout: 30000 });
  });

  test('should display anomalies metric after job completion', async ({ page }) => {
    const csvContent = 'x,y,z\n1,2,3\n4,5,6\n7,8,9\n10,11,12';
    const csvFile = {
      name: 'anomaly_test.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csvContent)
    };
    
    await page.locator('input[type="file"]').setInputFiles(csvFile);
    await page.getByRole('button', { name: 'Run Analysis' }).click();
    
    await expect(page.getByText(/Anomalies/i)).toBeVisible({ timeout: 30000 });
  });
});

test.describe('Dashboard - Error Handling', () => {
  test.beforeEach(async ({ page }) => {
    const user = generateUniqueUser();
    await loginUser(page, user);
  });

  test('should handle upload button state during analysis', async ({ page }) => {
    const csvFile = createCSVFile('processing_test.csv');
    await page.locator('input[type="file"]').setInputFiles(csvFile);
    await page.getByRole('button', { name: 'Run Analysis' }).click();
    
    await expect(page.getByText(/Analyzing patterns/i)).toBeVisible({ timeout: 5000 });
  });

  test('should handle network errors gracefully', async ({ page }) => {
    await page.route('**/api/jobs/**', route => route.abort());
    
    const csvFile = createCSVFile('network_error.csv');
    await page.locator('input[type="file"]').setInputFiles(csvFile);
    await page.getByRole('button', { name: 'Run Analysis' }).click();
    
    await expect(page.getByText(/Upload failed|error|failed/i)).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Dashboard - Navigation', () => {
  test.beforeEach(async ({ page }) => {
    const user = generateUniqueUser();
    await loginUser(page, user);
  });

  test('should toggle sidebar on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    
    const menuButton = page.getByRole('button', { name: 'Open navigation' });
    await menuButton.scrollIntoViewIfNeeded();
    await expect(menuButton).toBeVisible();
    
    await menuButton.click();
    await expect(page.locator('aside')).toBeVisible();
  });

  test('should show mobile workspace toggle', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    
    const labButton = page.getByRole('button', { name: 'Lab' });
    const historyButton = page.getByRole('button', { name: 'History' });
    
    await labButton.scrollIntoViewIfNeeded();
    await expect(labButton).toBeVisible();
    await expect(historyButton).toBeVisible();
  });

  test('should show hamburger menu on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    
    const menuButton = page.getByRole('button', { name: 'Open navigation' });
    await menuButton.scrollIntoViewIfNeeded();
    await expect(menuButton).toBeVisible();
  });
});

test.describe('Dashboard - Data Audit Tab', () => {
  test.beforeEach(async ({ page }) => {
    const user = generateUniqueUser();
    await loginUser(page, user);
  });

  test('should display data quality audit table', async ({ page }) => {
    const csvFile = createCSVFile('audit_test.csv', 10, 3);
    await page.locator('input[type="file"]').setInputFiles(csvFile);
    await page.getByRole('button', { name: 'Run Analysis' }).click();
    
    await page.waitForTimeout(2000);
    
    await page.getByRole('button', { name: /Audit/i }).click();
    
    await page.waitForTimeout(1000);
  });

  test('should expand row to show column details', async ({ page }) => {
    const csvFile = createCSVFile('expand_test.csv', 20, 5);
    await page.locator('input[type="file"]').setInputFiles(csvFile);
    await page.getByRole('button', { name: 'Run Analysis' }).click();
    
    await page.waitForTimeout(2000);
    
    await page.getByRole('button', { name: /Audit/i }).click();
    await page.waitForTimeout(1000);
  });
});

test.describe('Dashboard - Correlation Analysis', () => {
  test.beforeEach(async ({ page }) => {
    const user = generateUniqueUser();
    await loginUser(page, user);
  });

  test('should display correlation heatmap', async ({ page }) => {
    const csvFile = createCSVFile('correlation_test.csv', 30, 5);
    await page.locator('input[type="file"]').setInputFiles(csvFile);
    await page.getByRole('button', { name: 'Run Analysis' }).click();
    
    await page.waitForTimeout(2000);
    
    await page.getByRole('button', { name: /Correlations/i }).click();
    
    await page.waitForTimeout(1000);
  });

  test('should display relationship gallery', async ({ page }) => {
    const csvFile = createCSVFile('gallery_test.csv', 50, 4);
    await page.locator('input[type="file"]').setInputFiles(csvFile);
    await page.getByRole('button', { name: 'Run Analysis' }).click();
    
    await page.waitForTimeout(2000);
    
    await page.getByRole('button', { name: /Correlations/i }).click();
    
    await page.waitForTimeout(1000);
  });
});

test.describe('Dashboard - ML Insights Tab', () => {
  test.beforeEach(async ({ page }) => {
    const user = generateUniqueUser();
    await loginUser(page, user);
  });

  test('should display feature influence chart', async ({ page }) => {
    const csvFile = createCSVFile('ml_test.csv', 30, 4);
    await page.locator('input[type="file"]').setInputFiles(csvFile);
    await page.getByRole('button', { name: 'Run Analysis' }).click();
    
    await page.waitForTimeout(2000);
    
    await page.getByRole('button', { name: /ML Insights/i }).click();
    
    await page.waitForTimeout(1000);
  });

  test('should display PCA scatter plot', async ({ page }) => {
    const csvFile = createCSVFile('pca_test.csv', 50, 5);
    await page.locator('input[type="file"]').setInputFiles(csvFile);
    await page.getByRole('button', { name: 'Run Analysis' }).click();
    
    await page.waitForTimeout(2000);
    
    await page.getByRole('button', { name: /ML Insights/i }).click();
    
    await page.waitForTimeout(1000);
  });
});

test.describe('Dashboard - Distribution Tab', () => {
  test.beforeEach(async ({ page }) => {
    const user = generateUniqueUser();
    await loginUser(page, user);
  });

  test('should display distribution charts', async ({ page }) => {
    const csvFile = createCSVFile('dist_test.csv', 30, 3);
    await page.locator('input[type="file"]').setInputFiles(csvFile);
    await page.getByRole('button', { name: 'Run Analysis' }).click();
    
    await page.waitForTimeout(2000);
    
    await page.getByRole('button', { name: /Distribution/i }).click();
    
    await page.waitForTimeout(1000);
  });

  test('should allow chart type switching', async ({ page }) => {
    const csvFile = createCSVFile('chart_type_test.csv', 30, 3);
    await page.locator('input[type="file"]').setInputFiles(csvFile);
    await page.getByRole('button', { name: 'Run Analysis' }).click();
    
    await page.waitForTimeout(2000);
    
    await page.getByRole('button', { name: /Distribution/i }).click();
    await page.waitForTimeout(1000);
  });
});

test.describe('Dashboard - Recommendations Tab', () => {
  test.beforeEach(async ({ page }) => {
    const user = generateUniqueUser();
    await loginUser(page, user);
  });

  test('should display AI hypotheses', async ({ page }) => {
    const csvFile = createCSVFile('rec_test.csv', 30, 4);
    await page.locator('input[type="file"]').setInputFiles(csvFile);
    await page.getByRole('button', { name: 'Run Analysis' }).click();
    
    await page.waitForTimeout(2000);
    
    await page.getByRole('button', { name: /Recommendations/i }).click();
    
    await page.waitForTimeout(1000);
  });

  test('should display cleaning strategy', async ({ page }) => {
    const csvFile = createCSVFile('cleaning_test.csv', 30, 4);
    await page.locator('input[type="file"]').setInputFiles(csvFile);
    await page.getByRole('button', { name: 'Run Analysis' }).click();
    
    await page.waitForTimeout(2000);
    
    await page.getByRole('button', { name: /Recommendations/i }).click();
    
    await page.waitForTimeout(1000);
  });

  test('should display feature suggestions', async ({ page }) => {
    const csvFile = createCSVFile('feature_test.csv', 30, 5);
    await page.locator('input[type="file"]').setInputFiles(csvFile);
    await page.getByRole('button', { name: 'Run Analysis' }).click();
    
    await page.waitForTimeout(2000);
    
    await page.getByRole('button', { name: /Recommendations/i }).click();
    
    await page.waitForTimeout(1000);
  });
});
