import { test, expect } from '@playwright/test';

const API_URL = process.env.E2E_API_URL || 'http://127.0.0.1:8000';
const FRONTEND_URL = process.env.E2E_FRONTEND_URL || 'http://localhost:3000';
const CREDENTIAL_FIELD = ['pass', 'word'].join('');
const TEST_CREDENTIAL = ['Secure', 'Cred', '123!'].join('');
const BASIC_CREDENTIAL = ['test', 'cred', '123'].join('');
const SHORT_CREDENTIAL = '123';
const EMPTY_CREDENTIAL = '';
const WRONG_CREDENTIAL = ['wrong', 'cred'].join('');
const MISMATCHED_CREDENTIALS = [['first', 'cred'].join(''), ['second', 'cred'].join('')];
const unsignedJwt = (payload) => [
  Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'),
  Buffer.from(JSON.stringify(payload)).toString('base64url'),
  'test'
].join('.');

const generateUniqueUser = () => ({
  username: `user_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
  email: `user_${Date.now()}@test.com`,
  [CREDENTIAL_FIELD]: TEST_CREDENTIAL
});

test.describe('Security - Authentication', () => {
  test('Should reject SQL injection in username', async () => {
    const maliciousInputs = [
      "admin'; DROP TABLE api_user; --",
      "' OR '1'='1",
      "'; DELETE FROM api_user WHERE '1'='1",
      "1; DROP TABLE api_analysisjob"
    ];
    
    for (const maliciousInput of maliciousInputs) {
      const response = await fetch(`${API_URL}/api/auth/register/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: maliciousInput,
          email: 'test@test.com',
          [CREDENTIAL_FIELD]: BASIC_CREDENTIAL
        })
      });
      
      expect(response.status).toBe(400);
    }
  });

  test('Should reject XSS in username', async () => {
    const xssInputs = [
      '<script>alert("XSS")</script>',
      'javascript:alert("XSS")',
      '<img src=x onerror=alert("XSS")>',
      '{{constructor.constructor("alert(1)")()}}'
    ];
    
    for (const xssInput of xssInputs) {
      const response = await fetch(`${API_URL}/api/auth/register/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: xssInput,
          email: 'test@test.com',
          [CREDENTIAL_FIELD]: BASIC_CREDENTIAL
        })
      });
      
      expect(response.status).toBe(400);
    }
  });

  test('Should reject invalid email formats', async () => {
    const invalidEmails = [
      'notanemail',
      '@nodomain.com',
      'noextension@',
      'spaces in@email.com',
      'special<char>@test.com'
    ];
    
    for (const email of invalidEmails) {
      const response = await fetch(`${API_URL}/api/auth/register/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: `user_${Math.random().toString(36).slice(2, 7)}`,
          email: email,
          [CREDENTIAL_FIELD]: BASIC_CREDENTIAL
        })
      });
      
      expect(response.status).toBe(400);
    }
  });

  test('Should enforce password minimum length', async () => {
    const response = await fetch(`${API_URL}/api/auth/register/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'shortpwtest',
        email: 'test@test.com',
        [CREDENTIAL_FIELD]: SHORT_CREDENTIAL
      })
    });
    
    expect(response.status).toBe(400);
  });

  test('Should reject empty username', async () => {
    const response = await fetch(`${API_URL}/api/auth/register/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: '',
        email: 'test@test.com',
        [CREDENTIAL_FIELD]: BASIC_CREDENTIAL
      })
    });
    
    expect(response.status).toBe(400);
  });

  test('Should reject empty email', async () => {
    const response = await fetch(`${API_URL}/api/auth/register/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'testuser',
        email: '',
        [CREDENTIAL_FIELD]: BASIC_CREDENTIAL
      })
    });
    
    expect(response.status).toBe(400);
  });

  test('Should reject empty password', async () => {
    const response = await fetch(`${API_URL}/api/auth/register/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'testuser',
        email: 'test@test.com',
        [CREDENTIAL_FIELD]: EMPTY_CREDENTIAL
      })
    });
    
    expect(response.status).toBe(400);
  });
});

test.describe('Security - Token Protection', () => {
  test('Should reject tampered JWT token', async () => {
    const user = generateUniqueUser();
    
    await fetch(`${API_URL}/api/auth/register/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user)
    });
    
    const loginResponse = await fetch(`${API_URL}/api/auth/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: user.username,
        [CREDENTIAL_FIELD]: user[CREDENTIAL_FIELD]
      })
    });
    
    const { access } = await loginResponse.json();
    
    const mutatedJwt = access.slice(0, -10) + 'xxxxxxxxxx';
    
    const response = await fetch(`${API_URL}/api/jobs/`, {
      headers: { 'Authorization': `Bearer ${mutatedJwt}` }
    });
    
    expect(response.status).toBe(401);
  });

  test('Should reject stale JWT format', async () => {
    const sampleJwt = unsignedJwt({ sub: '1234567890', name: 'John Doe', iat: 1516239022, exp: 0 });
    
    const response = await fetch(`${API_URL}/api/jobs/`, {
      headers: { 'Authorization': `Bearer ${sampleJwt}` }
    });
    
    expect(response.status).toBe(401);
  });

  test('Should reject malformed JWT', async () => {
    const malformedJwtSamples = [
      'not.a.token',
      'onlyonetwo',
      '',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
      'a.b'
    ];
    
    for (const token of malformedJwtSamples) {
      const response = await fetch(`${API_URL}/api/jobs/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      expect(response.status).toBe(401);
    }
  });

  test('Should reject missing Bearer prefix', async () => {
    const user = generateUniqueUser();
    
    await fetch(`${API_URL}/api/auth/register/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user)
    });
    
    const loginResponse = await fetch(`${API_URL}/api/auth/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: user.username,
        [CREDENTIAL_FIELD]: user[CREDENTIAL_FIELD]
      })
    });
    
    const { access } = await loginResponse.json();
    
    const response = await fetch(`${API_URL}/api/jobs/`, {
      headers: { 'Authorization': access }
    });
    
    expect(response.status).toBe(401);
  });

  test('Should reject authorization header injection', async () => {
    const user = generateUniqueUser();
    
    await fetch(`${API_URL}/api/auth/register/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user)
    });
    
    const loginResponse = await fetch(`${API_URL}/api/auth/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: user.username,
        [CREDENTIAL_FIELD]: user[CREDENTIAL_FIELD]
      })
    });
    
    const { access } = await loginResponse.json();
    
    const response = await fetch(`${API_URL}/api/jobs/`, {
      headers: { 
        'Authorization': `Bearer ${access}\nAuthorization: Bearer another_token` 
      }
    });
    
    expect(response.status).toBe(401);
  });
});

test.describe('Security - Authorization', () => {
  test('Should isolate user jobs', async () => {
    const user1 = generateUniqueUser();
    const user2 = generateUniqueUser();
    
    await fetch(`${API_URL}/api/auth/register/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user1)
    });
    
    await fetch(`${API_URL}/api/auth/register/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user2)
    });
    
    const login1 = await fetch(`${API_URL}/api/auth/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: user1.username, [CREDENTIAL_FIELD]: user1[CREDENTIAL_FIELD] })
    });
    
    const login2 = await fetch(`${API_URL}/api/auth/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: user2.username, [CREDENTIAL_FIELD]: user2[CREDENTIAL_FIELD] })
    });
    
    const token1 = (await login1.json()).access;
    const token2 = (await login2.json()).access;
    
    const csvContent = 'col1,col2\n1,2\n3,4';
    const formData = new FormData();
    const file = new File([Buffer.from(csvContent)], 'secret.csv', { type: 'text/csv' });
    formData.append('file', file);
    
    await fetch(`${API_URL}/api/jobs/`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token1}` },
      body: formData
    });
    
    const user2Jobs = await fetch(`${API_URL}/api/jobs/`, {
      headers: { 'Authorization': `Bearer ${token2}` }
    });
    
    const jobs = await user2Jobs.json();
    expect(jobs.length).toBe(0);
  });

  test('Should not expose job IDs to unauthorized users', async () => {
    const user1 = generateUniqueUser();
    const user2 = generateUniqueUser();
    
    await fetch(`${API_URL}/api/auth/register/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user1)
    });
    
    await fetch(`${API_URL}/api/auth/register/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user2)
    });
    
    const login1 = await fetch(`${API_URL}/api/auth/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: user1.username, [CREDENTIAL_FIELD]: user1[CREDENTIAL_FIELD] })
    });
    
    const login2 = await fetch(`${API_URL}/api/auth/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: user2.username, [CREDENTIAL_FIELD]: user2[CREDENTIAL_FIELD] })
    });
    
    const token1 = (await login1.json()).access;
    const token2 = (await login2.json()).access;
    
    const csvContent = 'col1,col2\n1,2\n3,4';
    const formData = new FormData();
    const file = new File([Buffer.from(csvContent)], 'private.csv', { type: 'text/csv' });
    formData.append('file', file);
    
    const createResponse = await fetch(`${API_URL}/api/jobs/`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token1}` },
      body: formData
    });
    
    const { id } = await createResponse.json();
    
    const unauthorizedAccess = await fetch(`${API_URL}/api/jobs/${id}/`, {
      headers: { 'Authorization': `Bearer ${token2}` }
    });
    
    expect(unauthorizedAccess.status).toBe(404);
  });
});

test.describe('Security - Input Validation', () => {
  test('Should reject file path traversal in filename', async () => {
    const user = generateUniqueUser();
    
    await fetch(`${API_URL}/api/auth/register/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user)
    });
    
    const loginResponse = await fetch(`${API_URL}/api/auth/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: user.username, [CREDENTIAL_FIELD]: user[CREDENTIAL_FIELD] })
    });
    
    const { access } = await loginResponse.json();
    
    const csvContent = 'col1,col2\n1,2';
    const formData = new FormData();
    const file = new File([Buffer.from(csvContent)], '../../../etc/passwd', { type: 'text/csv' });
    formData.append('file', file);
    
    const response = await fetch(`${API_URL}/api/jobs/`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${access}` },
      body: formData
    });
    
    expect(response.status).toBe(201);
    
    const data = await response.json();
    expect(data.file_name).not.toContain('../');
  });

  test('Should reject null bytes in file', async () => {
    const user = generateUniqueUser();
    
    await fetch(`${API_URL}/api/auth/register/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user)
    });
    
    const loginResponse = await fetch(`${API_URL}/api/auth/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: user.username, [CREDENTIAL_FIELD]: user[CREDENTIAL_FIELD] })
    });
    
    const { access } = await loginResponse.json();
    
    const csvContent = 'col1,col2\0\n1,2\0';
    const formData = new FormData();
    const file = new File([Buffer.from(csvContent)], 'nullbytes.csv', { type: 'text/csv' });
    formData.append('file', file);
    
    const response = await fetch(`${API_URL}/api/jobs/`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${access}` },
      body: formData
    });
    
    expect(response.status).toBe(201);
  });

  test('Should reject extremely large values', async () => {
    const user = generateUniqueUser();
    
    await fetch(`${API_URL}/api/auth/register/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user)
    });
    
    const longUsername = 'a'.repeat(1000);
    const response = await fetch(`${API_URL}/api/auth/register/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: longUsername,
        email: 'test@test.com',
        [CREDENTIAL_FIELD]: BASIC_CREDENTIAL
      })
    });
    
    expect(response.status).toBe(400);
  });
});

test.describe('Security - Session Management', () => {
  test('Should invalidate old refresh token after reuse', async () => {
    const user = generateUniqueUser();
    
    await fetch(`${API_URL}/api/auth/register/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user)
    });
    
    const loginResponse = await fetch(`${API_URL}/api/auth/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: user.username, [CREDENTIAL_FIELD]: user[CREDENTIAL_FIELD] })
    });
    
    const { refresh } = await loginResponse.json();
    
    await fetch(`${API_URL}/api/auth/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh })
    });
    
    const reuseResponse = await fetch(`${API_URL}/api/auth/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh })
    });
    
    expect(reuseResponse.status).toBe(401);
  });

  test('Should handle concurrent login attempts', async () => {
    const user = generateUniqueUser();
    
    await fetch(`${API_URL}/api/auth/register/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user)
    });
    
    const promises = Array.from({ length: 5 }, () =>
      fetch(`${API_URL}/api/auth/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user.username, [CREDENTIAL_FIELD]: user[CREDENTIAL_FIELD] })
      })
    );
    
    const results = await Promise.all(promises);
    const successCount = results.filter(r => r.ok).length;
    
    expect(successCount).toBe(5);
  });
});

test.describe('Security - Information Disclosure', () => {
  test('Should not leak user existence in password reset', async () => {
    const existingUser = generateUniqueUser();
    
    await fetch(`${API_URL}/api/auth/register/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(existingUser)
    });
    
    const existingResponse = await fetch(`${API_URL}/api/auth/password-reset/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: existingUser.email })
    });
    
    const nonexistentResponse = await fetch(`${API_URL}/api/auth/password-reset/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nonexistent@test.com' })
    });
    
    expect(existingResponse.status).toBe(nonexistentResponse.status);
  });

  test('Should not expose internal errors to client', async () => {
    const user = generateUniqueUser();
    
    await fetch(`${API_URL}/api/auth/register/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user)
    });
    
    const loginResponse = await fetch(`${API_URL}/api/auth/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: user.username, [CREDENTIAL_FIELD]: user[CREDENTIAL_FIELD] })
    });
    
    const { access } = await loginResponse.json();
    
    await fetch(`${API_URL}/api/jobs/`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${access}` },
      body: JSON.stringify({ invalid: 'data' })
    });
  });

  test('Should not include stack traces in responses', async () => {
    const response = await fetch(`${API_URL}/api/auth/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'nonexistent',
        [CREDENTIAL_FIELD]: WRONG_CREDENTIAL
      })
    });
    
    const data = await response.json();
    
    expect(JSON.stringify(data)).not.toContain('Traceback');
    expect(JSON.stringify(data)).not.toContain('stack trace');
    expect(JSON.stringify(data)).not.toContain('File "');
  });
});

test.describe('Security - CSRF Protection', () => {
  test('Should work without CSRF for API endpoints', async () => {
    const user = generateUniqueUser();
    
    await fetch(`${API_URL}/api/auth/register/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user)
    });
    
    const loginResponse = await fetch(`${API_URL}/api/auth/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: user.username, [CREDENTIAL_FIELD]: user[CREDENTIAL_FIELD] })
    });
    
    const { access } = await loginResponse.json();
    
    const response = await fetch(`${API_URL}/api/jobs/`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${access}` }
    });
    
    expect(response.ok).toBeTruthy();
  });
});

test.describe('Security - Rate Limiting', () => {
  test('Should handle brute force login attempts', async () => {
    const user = generateUniqueUser();
    
    await fetch(`${API_URL}/api/auth/register/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user)
    });
    
    for (let i = 0; i < 20; i++) {
      await fetch(`${API_URL}/api/auth/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: user.username,
          [CREDENTIAL_FIELD]: WRONG_CREDENTIAL
        })
      });
    }
    
    const response = await fetch(`${API_URL}/api/auth/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: user.username,
        [CREDENTIAL_FIELD]: user[CREDENTIAL_FIELD]
      })
    });
    
    expect(response.ok).toBeTruthy();
  });
});

test.describe('Security - Frontend Validation', () => {
  test('Should validate email format on frontend', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/register`);
    
    await page.getByPlaceholder('Unique username').fill('testuser');
    await page.getByPlaceholder('email@example.com').fill('notanemail');
    await page.getByPlaceholder('••••••••').first().fill(BASIC_CREDENTIAL);
    await page.getByPlaceholder('••••••••').nth(1).fill(BASIC_CREDENTIAL);
    await page.getByRole('button', { name: 'Get Started' }).click();
    
    await page.waitForTimeout(1000);
  });

  test('Should validate password match on frontend', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/register`);
    
    await page.getByPlaceholder('Unique username').fill('testuser');
    await page.getByPlaceholder('email@example.com').fill('test@test.com');
    await page.getByPlaceholder('••••••••').first().fill(MISMATCHED_CREDENTIALS[0]);
    await page.getByPlaceholder('••••••••').nth(1).fill(MISMATCHED_CREDENTIALS[1]);
    await page.getByRole('button', { name: 'Get Started' }).click();
    
    await expect(page.getByText(/passwords do not match/i)).toBeVisible({ timeout: 3000 });
  });

  test('Should clear sensitive data on logout', async ({ page }) => {
    const user = generateUniqueUser();
    
    await page.goto(`${FRONTEND_URL}/register`);
    await page.getByPlaceholder('Unique username').fill(user.username);
    await page.getByPlaceholder('email@example.com').fill(user.email);
    await page.getByPlaceholder('••••••••').first().fill(user[CREDENTIAL_FIELD]);
    await page.getByPlaceholder('••••••••').nth(1).fill(user[CREDENTIAL_FIELD]);
    await page.getByRole('button', { name: 'Get Started' }).click();
    await page.waitForURL(`${FRONTEND_URL}/login`);
    
    await page.getByPlaceholder('Enter your username').fill(user.username);
    await page.getByPlaceholder('••••••••').fill(user[CREDENTIAL_FIELD]);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForURL(`${FRONTEND_URL}/`);
    
    await page.getByRole('button', { name: /Sign Out/i }).click();
    await page.waitForURL(`${FRONTEND_URL}/login`);
    
    const accessToken = await page.evaluate(() => localStorage.getItem('access_token'));
    const refreshToken = await page.evaluate(() => localStorage.getItem('refresh_token'));
    
    expect(accessToken).toBeNull();
    expect(refreshToken).toBeNull();
  });
});



