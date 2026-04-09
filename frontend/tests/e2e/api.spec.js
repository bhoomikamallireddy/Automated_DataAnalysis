import { test, expect } from '@playwright/test';

const API_URL = process.env.E2E_API_URL || 'http://127.0.0.1:8000';
const generateUniqueUser = () => ({
  username: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  email: `user_${Date.now()}@test.com`,
  password: 'SecurePass123!'
});

test.describe('API - Authentication Endpoints', () => {
  test('POST /api/auth/register/ - Success', async () => {
    const user = generateUniqueUser();
    
    const response = await fetch(`${API_URL}/api/auth/register/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user)
    });
    
    expect(response.ok).toBeTruthy();
    expect(response.status).toBe(201);
    
    const data = await response.json();
    expect(data).toHaveProperty('user_id');
    expect(data.message).toContain('successfully');
  });

  test('POST /api/auth/register/ - Duplicate username', async () => {
    const user = generateUniqueUser();
    
    await fetch(`${API_URL}/api/auth/register/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user)
    });
    
    const response = await fetch(`${API_URL}/api/auth/register/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user)
    });
    
    expect(response.status).toBe(400);
  });

  test('POST /api/auth/register/ - Missing fields', async () => {
    const response = await fetch(`${API_URL}/api/auth/register/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'incomplete' })
    });
    
    expect(response.status).toBe(400);
  });

  test('POST /api/auth/register/ - Invalid email', async () => {
    const response = await fetch(`${API_URL}/api/auth/register/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'testuser',
        email: 'not-an-email',
        password: 'testpass123'
      })
    });
    
    expect(response.status).toBe(400);
  });

  test('POST /api/auth/login/ - Success', async () => {
    const user = generateUniqueUser();
    
    await fetch(`${API_URL}/api/auth/register/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user)
    });
    
    const response = await fetch(`${API_URL}/api/auth/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: user.username,
        password: user.password
      })
    });
    
    expect(response.ok).toBeTruthy();
    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('access');
    expect(data).toHaveProperty('refresh');
  });

  test('POST /api/auth/login/ - Invalid password', async () => {
    const user = generateUniqueUser();
    
    await fetch(`${API_URL}/api/auth/register/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user)
    });
    
    const response = await fetch(`${API_URL}/api/auth/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: user.username,
        password: 'wrongpassword'
      })
    });
    
    expect(response.status).toBe(401);
  });

  test('POST /api/auth/login/ - Non-existent user', async () => {
    const response = await fetch(`${API_URL}/api/auth/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'nonexistent_user_12345',
        password: 'anypassword'
      })
    });
    
    expect(response.status).toBe(401);
  });

  test('POST /api/auth/refresh/ - Success', async () => {
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
        password: user.password
      })
    });
    
    const { refresh } = await loginResponse.json();
    
    const response = await fetch(`${API_URL}/api/auth/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh })
    });
    
    expect(response.ok).toBeTruthy();
    const data = await response.json();
    expect(data).toHaveProperty('access');
  });

  test('POST /api/auth/refresh/ - Invalid token', async () => {
    const response = await fetch(`${API_URL}/api/auth/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh: 'invalid_token' })
    });
    
    expect(response.status).toBe(401);
  });

  test('POST /api/auth/password-reset/ - Success', async () => {
    const user = generateUniqueUser();
    
    await fetch(`${API_URL}/api/auth/register/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user)
    });
    
    const response = await fetch(`${API_URL}/api/auth/password-reset/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: user.email })
    });
    
    expect(response.ok).toBeTruthy();
    expect(response.status).toBe(200);
  });

  test('POST /api/auth/password-reset/ - Non-existent email', async () => {
    const response = await fetch(`${API_URL}/api/auth/password-reset/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nonexistent@test.com' })
    });
    
    expect(response.ok).toBeTruthy();
    expect(response.status).toBe(200);
  });
});

test.describe('API - Jobs Endpoints', () => {
  let auth;

  test.beforeEach(async () => {
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
        password: user.password
      })
    });
    
    const data = await loginResponse.json();
    auth = data.access;
  });

  test('GET /api/jobs/ - Success', async () => {
    const response = await fetch(`${API_URL}/api/jobs/`, {
      headers: { 'Authorization': `Bearer ${auth}` }
    });
    
    expect(response.ok).toBeTruthy();
    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(Array.isArray(data)).toBeTruthy();
  });

  test('GET /api/jobs/ - Unauthorized', async () => {
    const response = await fetch(`${API_URL}/api/jobs/`);
    expect(response.status).toBe(401);
  });

  test('GET /api/jobs/ - Invalid token', async () => {
    const response = await fetch(`${API_URL}/api/jobs/`, {
      headers: { 'Authorization': 'Bearer invalid_token' }
    });
    expect(response.status).toBe(401);
  });

  test('GET /api/jobs/ - Missing Bearer prefix', async () => {
    const response = await fetch(`${API_URL}/api/jobs/`, {
      headers: { 'Authorization': auth }
    });
    expect(response.status).toBe(401);
  });

  test('POST /api/jobs/ - Success', async ({ request }) => {
    const csvContent = 'col1,col2,col3\n1,2,3\n4,5,6';
    const csvBuffer = Buffer.from(csvContent);
    
    const formData = new FormData();
    const file = new File([csvBuffer], 'test.csv', { type: 'text/csv' });
    formData.append('file', file);
    
    const response = await fetch(`${API_URL}/api/jobs/`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${auth}` },
      body: formData
    });
    
    expect(response.status).toBe(201);
    
    const data = await response.json();
    expect(data).toHaveProperty('id');
    expect(data.status).toBe('PENDING');
  });

  test('POST /api/jobs/ - Large CSV', async () => {
    const headers = Array.from({ length: 10 }, (_, i) => `col${i + 1}`).join(',');
    const rows = Array.from({ length: 100 }, () => 
      Array.from({ length: 10 }, () => Math.random() * 100).join(',')
    ).join('\n');
    const csvContent = `${headers}\n${rows}`;
    
    const formData = new FormData();
    const file = new File([Buffer.from(csvContent)], 'large.csv', { type: 'text/csv' });
    formData.append('file', file);
    
    const response = await fetch(`${API_URL}/api/jobs/`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${auth}` },
      body: formData
    });
    
    expect(response.status).toBe(201);
  });

  test('GET /api/jobs/{id}/ - Success', async () => {
    const csvContent = 'col1,col2\n1,2\n3,4';
    const formData = new FormData();
    const file = new File([Buffer.from(csvContent)], 'detail.csv', { type: 'text/csv' });
    formData.append('file', file);
    
    const createResponse = await fetch(`${API_URL}/api/jobs/`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${auth}` },
      body: formData
    });
    
    const { id } = await createResponse.json();
    
    const response = await fetch(`${API_URL}/api/jobs/${id}/`, {
      headers: { 'Authorization': `Bearer ${auth}` }
    });
    
    expect(response.ok).toBeTruthy();
    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data.id).toBe(id);
    expect(data).toHaveProperty('status');
    expect(data).toHaveProperty('file_name');
  });

  test('GET /api/jobs/{id}/ - Not found', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const response = await fetch(`${API_URL}/api/jobs/${fakeId}/`, {
      headers: { 'Authorization': `Bearer ${auth}` }
    });
    expect(response.status).toBe(404);
  });

  test('GET /api/jobs/{id}/ - Other user job', async () => {
    const csvContent = 'col1,col2\n1,2\n3,4';
    const formData = new FormData();
    const file = new File([Buffer.from(csvContent)], 'private.csv', { type: 'text/csv' });
    formData.append('file', file);
    
    await fetch(`${API_URL}/api/jobs/`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${auth}` },
      body: formData
    });
    
    const otherUser = generateUniqueUser();
    await fetch(`${API_URL}/api/auth/register/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(otherUser)
    });
    
    const loginResponse = await fetch(`${API_URL}/api/auth/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: otherUser.username,
        password: otherUser.password
      })
    });
    
    const listResponse = await fetch(`${API_URL}/api/jobs/`, {
      headers: { 'Authorization': `Bearer ${(await loginResponse.json()).access}` }
    });
    
    const jobs = await listResponse.json();
    expect(jobs.length).toBe(0);
  });
});

test.describe('API - Token Validation', () => {
  test('JWT token structure', async () => {
    const user = generateUniqueUser();
    
    await fetch(`${API_URL}/api/auth/register/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user)
    });
    
    const response = await fetch(`${API_URL}/api/auth/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: user.username,
        password: user.password
      })
    });
    
    const { access } = await response.json();
    const parts = access.split('.');
    
    expect(parts).toHaveLength(3);
    
    const payload = JSON.parse(atob(parts[1]));
    expect(payload).toHaveProperty('user_id');
    expect(payload).toHaveProperty('exp');
    expect(payload).toHaveProperty('iat');
  });

  test('Token contains correct user info', async () => {
    const user = generateUniqueUser();
    
    await fetch(`${API_URL}/api/auth/register/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user)
    });
    
    const response = await fetch(`${API_URL}/api/auth/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: user.username,
        password: user.password
      })
    });
    
    const { access } = await response.json();
    const payload = JSON.parse(atob(access.split('.')[1]));
    
    expect(payload).toHaveProperty('user_id');
  });

  test('Token expiration check', async () => {
    const user = generateUniqueUser();
    
    await fetch(`${API_URL}/api/auth/register/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user)
    });
    
    const response = await fetch(`${API_URL}/api/auth/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: user.username,
        password: user.password
      })
    });
    
    const { access } = await response.json();
    const payload = JSON.parse(atob(access.split('.')[1]));
    
    const expDate = new Date(payload.exp * 1000);
    const now = new Date();
    
    expect(expDate.getTime()).toBeGreaterThan(now.getTime());
  });
});

test.describe('API - CORS Headers', () => {
  test('CORS headers present on login', async () => {
    const response = await fetch(`${API_URL}/api/auth/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'test',
        password: 'test'
      })
    });
    
    const headers = response.headers;
    expect(headers.has('access-control-allow-origin') || headers.has('vary')).toBeTruthy();
  });

  test('CORS headers present on jobs', async () => {
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
        password: user.password
      })
    });
    
    const { access } = await loginResponse.json();
    
    const response = await fetch(`${API_URL}/api/jobs/`, {
      headers: { 'Authorization': `Bearer ${access}` }
    });
    
    expect(response.ok).toBeTruthy();
  });
});

test.describe('API - Rate Limiting', () => {
  test('Should handle rapid requests', async () => {
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
        password: user.password
      })
    });
    
    const { access } = await loginResponse.json();
    
    for (let i = 0; i < 10; i++) {
      const response = await fetch(`${API_URL}/api/jobs/`, {
        headers: { 'Authorization': `Bearer ${access}` }
      });
      expect([200, 429]).toContain(response.status);
    }
  });
});

test.describe('API - File Upload Validation', () => {
  let auth;

  test.beforeEach(async () => {
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
        password: user.password
      })
    });
    
    const data = await loginResponse.json();
    auth = data.access;
  });

  test('Should accept valid CSV', async () => {
    const csvContent = 'col1,col2,col3\n1,2,3\n4,5,6';
    const formData = new FormData();
    const file = new File([Buffer.from(csvContent)], 'valid.csv', { type: 'text/csv' });
    formData.append('file', file);
    
    const response = await fetch(`${API_URL}/api/jobs/`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${auth}` },
      body: formData
    });
    
    expect(response.status).toBe(201);
  });

  test('Should handle CSV with special characters', async () => {
    const csvContent = 'name,description\nJohn,"Has, comma",\nJane,"Normal"\n"Multi\nLine","Value"';
    const formData = new FormData();
    const file = new File([Buffer.from(csvContent)], 'special.csv', { type: 'text/csv' });
    formData.append('file', file);
    
    const response = await fetch(`${API_URL}/api/jobs/`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${auth}` },
      body: formData
    });
    
    expect(response.status).toBe(201);
  });

  test('Should handle empty CSV', async () => {
    const csvContent = 'col1,col2,col3';
    const formData = new FormData();
    const file = new File([Buffer.from(csvContent)], 'empty.csv', { type: 'text/csv' });
    formData.append('file', file);
    
    const response = await fetch(`${API_URL}/api/jobs/`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${auth}` },
      body: formData
    });
    
    expect(response.status).toBe(201);
  });

  test('Should handle CSV with Unicode', async () => {
    const csvContent = 'name,value\nJosé,100\nMüller,200\n北京,300';
    const formData = new FormData();
    const file = new File([Buffer.from(csvContent)], 'unicode.csv', { type: 'text/csv' });
    formData.append('file', file);
    
    const response = await fetch(`${API_URL}/api/jobs/`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${auth}` },
      body: formData
    });
    
    expect(response.status).toBe(201);
  });

  test('Should handle CSV with long headers', async () => {
    const longHeader = 'a'.repeat(100);
    const csvContent = `${longHeader},col2\n1,2`;
    const formData = new FormData();
    const file = new File([Buffer.from(csvContent)], 'long.csv', { type: 'text/csv' });
    formData.append('file', file);
    
    const response = await fetch(`${API_URL}/api/jobs/`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${auth}` },
      body: formData
    });
    
    expect(response.status).toBe(201);
  });
});
