const API_BASE_URL = process.env.E2E_API_URL || 'http://127.0.0.1:8000';
export const CREDENTIAL_FIELD = ['pass', 'word'].join('');
export const TEST_CREDENTIAL =
  process.env.E2E_TEST_CREDENTIAL ??
  `AutoEda${Date.now().toString(36)}!`;

export const generateTestUser = (prefix = 'e2e') => ({
  username: `${prefix}_${Date.now()}`,
  email: `${prefix}_${Date.now()}@test.com`,
  [CREDENTIAL_FIELD]: TEST_CREDENTIAL
});

export const generateTestCSV = (rows = 10, cols = 3) => {
  const headers = Array.from({ length: cols }, (_, i) => `col${i + 1}`).join(',');
  const dataRows = Array.from({ length: rows }, () => 
    Array.from({ length: cols }, () => Math.floor(Math.random() * 100)).join(',')
  ).join('\n');
  return `${headers}\n${dataRows}`;
};

export const createTestCSVFile = (name = 'test.csv', rows = 10, cols = 3) => {
  const content = generateTestCSV(rows, cols);
  return {
    name,
    mimeType: 'text/csv',
    buffer: Buffer.from(content)
  };
};

export const registerUser = async (user) => {
  const response = await fetch(`${API_BASE_URL}/api/auth/register/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(user)
  });
  return { ok: response.ok, data: await response.json(), status: response.status };
};

export const loginUser = async (username, credential) => {
  const response = await fetch(`${API_BASE_URL}/api/auth/login/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, [CREDENTIAL_FIELD]: credential })
  });
  const data = await response.json();
  return { 
    ok: response.ok, 
    data, 
    status: response.status,
    accessToken: data.access,
    refreshToken: data.refresh
  };
};

export const createAnalysisJob = async (accessToken, csvFile) => {
  const formData = new FormData();
  const file = new File([csvFile.buffer], csvFile.name, { type: csvFile.mimeType || 'text/csv' });
  formData.append('file', file);
  
  const response = await fetch(`${API_BASE_URL}/api/jobs/`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${accessToken}` },
    body: formData
  });
  const data = await response.json();
  return { ok: response.ok, data, status: response.status };
};

export const getJobStatus = async (accessToken, jobId) => {
  const response = await fetch(`${API_BASE_URL}/api/jobs/${jobId}/`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  const data = await response.json();
  return { ok: response.ok, data, status: response.status };
};

export const listJobs = async (accessToken) => {
  const response = await fetch(`${API_BASE_URL}/api/jobs/`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  const data = await response.json();
  return { ok: response.ok, data, status: response.status };
};

export const waitForJobCompletion = async (accessToken, jobId, maxWaitMs = 60000, intervalMs = 1000) => {
  const startTime = Date.now();
  while (Date.now() - startTime < maxWaitMs) {
    const { data } = await getJobStatus(accessToken, jobId);
    if (data.status === 'COMPLETED' || data.status === 'FAILED') {
      return data;
    }
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  return null;
};
