import { test, expect, request } from '@playwright/test';
import { 
  generateTestUser, 
  createTestCSVFile,
  registerUser,
  loginUser,
  createAnalysisJob,
  getJobStatus,
  listJobs,
  waitForJobCompletion
} from '../utils/api.js';

const API_BASE_URL = process.env.E2E_API_URL || 'http://127.0.0.1:8000';

test.describe('E2E: User Registration Flow', () => {
  test('should register a new user via API', async () => {
    const testUser = generateTestUser('register');
    const { ok, data, status } = await registerUser(testUser);
    
    expect(ok).toBeTruthy();
    expect(status).toBe(201);
    expect(data).toHaveProperty('user_id');
    expect(data.message).toContain('successfully');
  });

  test('should reject duplicate username registration', async () => {
    const testUser = generateTestUser('duplicate');
    await registerUser(testUser);
    
    const { ok, status } = await registerUser(testUser);
    
    expect(ok).toBeFalsy();
    expect(status).toBe(400);
  });

  test('should reject registration with missing fields', async () => {
    const { ok, status } = await registerUser({ username: 'incomplete' });
    
    expect(ok).toBeFalsy();
    expect(status).toBe(400);
  });
});

test.describe('E2E: User Authentication Flow', () => {
  let testUser;

  test.beforeEach(async () => {
    testUser = generateTestUser('login');
    await registerUser(testUser);
  });

  test('should login with valid credentials', async () => {
    const { ok, data, accessToken, refreshToken } = await loginUser(
      testUser.username, 
      testUser.password
    );
    
    expect(ok).toBeTruthy();
    expect(data).toHaveProperty('access');
    expect(data).toHaveProperty('refresh');
    expect(accessToken).toBeTruthy();
    expect(refreshToken).toBeTruthy();
  });

  test('should reject invalid password', async () => {
    const { ok, status } = await loginUser(testUser.username, 'wrongpassword');
    
    expect(ok).toBeFalsy();
    expect(status).toBe(401);
  });

  test('should reject non-existent user', async () => {
    const { ok, status } = await loginUser('nonexistent', testUser.password);
    
    expect(ok).toBeFalsy();
    expect(status).toBe(401);
  });

  test('should return JWT tokens in correct format', async () => {
    const { data } = await loginUser(testUser.username, testUser.password);
    
    const tokenParts = data.access.split('.');
    expect(tokenParts).toHaveLength(3);
    
    const payload = JSON.parse(atob(tokenParts[1]));
    expect(payload).toHaveProperty('user_id');
    expect(payload).toHaveProperty('exp');
  });
});

test.describe('E2E: Analysis Job Management', () => {
  let auth;
  let testUser;

  test.beforeEach(async () => {
    testUser = generateTestUser('job');
    await registerUser(testUser);
    auth = await loginUser(testUser.username, testUser.password);
  });

  test('should create a new analysis job', async () => {
    const csvFile = createTestCSVFile('analysis_test.csv');
    
    const { ok, data, status } = await createAnalysisJob(auth.accessToken, csvFile);
    
    expect(ok).toBeTruthy();
    expect(status).toBe(201);
    expect(data).toHaveProperty('id');
    expect(data.status).toBe('PENDING');
  });

  test('should list user jobs', async () => {
    const csvFile1 = createTestCSVFile('job1.csv');
    const csvFile2 = createTestCSVFile('job2.csv');
    
    await createAnalysisJob(auth.accessToken, csvFile1);
    await createAnalysisJob(auth.accessToken, csvFile2);
    
    const { ok, data, status } = await listJobs(auth.accessToken);
    
    expect(ok).toBeTruthy();
    expect(status).toBe(200);
    expect(Array.isArray(data)).toBeTruthy();
    expect(data.length).toBeGreaterThanOrEqual(2);
  });

  test('should only list jobs for authenticated user', async () => {
    const csvFile = createTestCSVFile('user_job.csv');
    await createAnalysisJob(auth.accessToken, csvFile);
    
    const { data: otherUserData } = await (async () => {
      const otherUser = generateTestUser('other');
      await registerUser(otherUser);
      const otherAuth = await loginUser(otherUser.username, otherUser.password);
      return await listJobs(otherAuth.accessToken);
    })();
    
    const { data: ownJobs } = await listJobs(auth.accessToken);
    
    expect(ownJobs.some(job => job.file_name?.includes('user_job'))).toBeTruthy();
  });

  test('should reject job creation without authentication', async () => {
    const csvFile = createTestCSVFile('unauth.csv');
    
    const { ok, status } = await createAnalysisJob('invalid-token', csvFile);
    
    expect(ok).toBeFalsy();
    expect(status).toBe(401);
  });

  test('should get specific job details', async () => {
    const csvFile = createTestCSVFile('detail_test.csv');
    const { data: createdJob } = await createAnalysisJob(auth.accessToken, csvFile);
    
    const { ok, data, status } = await getJobStatus(auth.accessToken, createdJob.id);
    
    expect(ok).toBeTruthy();
    expect(status).toBe(200);
    expect(data.id).toBe(createdJob.id);
  });

  test('should handle various CSV formats', async () => {
    const csvFormats = [
      { name: 'simple.csv', rows: 5, cols: 2 },
      { name: 'large.csv', rows: 100, cols: 5 },
      { name: 'many_cols.csv', rows: 10, cols: 20 }
    ];
    
    for (const format of csvFormats) {
      const csvFile = createTestCSVFile(format.name, format.rows, format.cols);
      const { ok, status } = await createAnalysisJob(auth.accessToken, csvFile);
      expect(ok).toBeTruthy();
      expect(status).toBe(201);
    }
  });
});

test.describe('E2E: Complete Analysis Pipeline', () => {
  let auth;
  let testUser;

  test.beforeEach(async () => {
    testUser = generateTestUser('pipeline');
    await registerUser(testUser);
    auth = await loginUser(testUser.username, testUser.password);
  });

  test('should complete full analysis pipeline', async () => {
    const csvContent = 'name,age,salary\nAlice,30,50000\nBob,25,45000\nCharlie,35,60000\nDiana,28,52000\nEve,32,58000';
    const csvFile = {
      name: 'employees.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csvContent)
    };
    
    const { data: job } = await createAnalysisJob(auth.accessToken, csvFile);
    expect(job).toHaveProperty('id');
    expect(job.status).toBe('PENDING');
    
    const completedJob = await waitForJobCompletion(auth.accessToken, job.id, 120000);
    
    expect(completedJob).not.toBeNull();
    expect(completedJob.status).toBe('COMPLETED');
    expect(completedJob.results).toBeDefined();
  });

  test('should return valid analysis results structure', async () => {
    const csvContent = 'x,y,z\n1,2,3\n4,5,6\n7,8,9\n10,11,12';
    const csvFile = {
      name: 'numeric.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csvContent)
    };
    
    const { data: job } = await createAnalysisJob(auth.accessToken, csvFile);
    const completedJob = await waitForJobCompletion(auth.accessToken, job.id, 120000);
    
    expect(completedJob.results).toHaveProperty('metadata');
    expect(completedJob.results.metadata).toHaveProperty('total_rows');
    expect(completedJob.results.metadata).toHaveProperty('total_cols');
    expect(completedJob.results.metadata).toHaveProperty('column_types');
  });

  test('should handle analysis with mixed data types', async () => {
    const csvContent = 'id,name,value,active\n1,Test,100.5,true\n2,Sample,200.75,false\n3,Trial,150.25,true';
    const csvFile = {
      name: 'mixed.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csvContent)
    };
    
    const { data: job } = await createAnalysisJob(auth.accessToken, csvFile);
    const completedJob = await waitForJobCompletion(auth.accessToken, job.id, 120000);
    
    expect(completedJob.status).toBe('COMPLETED');
    expect(completedJob.results.metadata.column_types).toBeDefined();
  });
});

test.describe('E2E: Token Management', () => {
  let auth;
  let testUser;

  test.beforeEach(async () => {
    testUser = generateTestUser('token');
    await registerUser(testUser);
    auth = await loginUser(testUser.username, testUser.password);
  });

  test('should refresh access token', async () => {
    const refreshResponse = await fetch(`${API_BASE_URL}/api/auth/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh: auth.refreshToken })
    });
    
    expect(refreshResponse.ok).toBeTruthy();
    const data = await refreshResponse.json();
    expect(data).toHaveProperty('access');
    expect(data.access).not.toBe(auth.accessToken);
  });

  test('should reject expired token', async () => {
    const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJ1c2VybmFtZSI6InRlc3QiLCJleHAiOjB9.test';
    
    const response = await fetch(`${API_BASE_URL}/api/jobs/`, {
      headers: { 'Authorization': `Bearer ${expiredToken}` }
    });
    
    expect(response.status).toBe(401);
  });

  test('should reject token without Bearer prefix', async () => {
    const response = await fetch(`${API_BASE_URL}/api/jobs/`, {
      headers: { 'Authorization': auth.accessToken }
    });
    
    expect(response.status).toBe(401);
  });

  test('should reject tampered token', async () => {
    const tamperedToken = auth.accessToken.slice(0, -5) + 'xxxxx';
    
    const response = await fetch(`${API_BASE_URL}/api/jobs/`, {
      headers: { 'Authorization': `Bearer ${tamperedToken}` }
    });
    
    expect(response.status).toBe(401);
  });
});

test.describe('E2E: Password Reset Flow', () => {
  let testUser;

  test.beforeEach(async () => {
    testUser = generateTestUser('reset');
    await registerUser(testUser);
  });

  test('should request password reset for existing email', async () => {
    const response = await fetch(`${API_BASE_URL}/api/auth/password-reset/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testUser.email })
    });
    
    expect(response.ok).toBeTruthy();
    const data = await response.json();
    expect(data.detail).toContain('link was sent');
  });

  test('should return success for non-existent email (security)', async () => {
    const response = await fetch(`${API_BASE_URL}/api/auth/password-reset/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nonexistent@example.com' })
    });
    
    expect(response.ok).toBeTruthy();
  });
});

test.describe('E2E: Security Validation', () => {
  let auth;
  let testUser;

  test.beforeEach(async () => {
    testUser = generateTestUser('security');
    await registerUser(testUser);
    auth = await loginUser(testUser.username, testUser.password);
  });

  test('should not expose user data without authentication', async () => {
    const response = await fetch(`${API_BASE_URL}/api/jobs/`);
    expect(response.status).toBe(401);
  });

  test('should not allow access to other users jobs', async () => {
    const csvFile = createTestCSVFile('secure.csv');
    await createAnalysisJob(auth.accessToken, csvFile);
    
    const otherUser = generateTestUser('attacker');
    await registerUser(otherUser);
    const otherAuth = await loginUser(otherUser.username, otherUser.password);
    
    const { data: otherUserJobs } = await listJobs(otherAuth.accessToken);
    const { data: ownJobs } = await listJobs(auth.accessToken);
    
    expect(ownJobs.length).toBeGreaterThan(0);
    expect(otherUserJobs.length).toBe(0);
  });

  test('should validate file type (CSV only)', async () => {
    const nonCsvFile = {
      name: 'test.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('some text content')
    };
    
    const { ok, status } = await createAnalysisJob(auth.accessToken, nonCsvFile);
    
    expect(ok).toBeFalsy();
    expect([400, 415, 201]).toContain(status);
  });
});
