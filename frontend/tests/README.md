# End-to-End Testing Suite

This directory contains comprehensive E2E tests for the AutoEDA application.

## Test Structure

```
tests/
├── e2e/
│   ├── auth.spec.js              # Authentication flows
│   ├── dashboard.spec.js        # Dashboard & analysis
│   ├── api.spec.js               # API integration tests
│   ├── api-integration.spec.js    # Full API workflows
│   ├── full-workflow.spec.js      # UI workflows
│   ├── security.spec.js           # Security validation
│   └── global-setup.js            # Environment setup
├── utils/
│   └── api.js                    # Shared test utilities
├── components/                    # Component tests
└── pages/                        # Page-level tests
```

## Test Coverage

### 1. Authentication Tests (`auth.spec.js`) - 30+ tests
- User registration (success, validation, duplicates, password mismatch)
- User login (success, invalid credentials, non-existent user)
- Logout functionality
- Password reset flow
- Route protection
- JWT token validation
- Token structure verification

### 2. Dashboard Tests (`dashboard.spec.js`) - 50+ tests
- Page load & layout
- File upload functionality
- Job processing & status polling
- Analysis tabs (Overview, Audit, Correlations, ML Insights, Distribution, Recommendations)
- Workspace modes (Current/History)
- KPI metrics display
- Error handling
- Responsive design (mobile, tablet, desktop)

### 3. API Tests (`api.spec.js`) - 40+ tests
- All authentication endpoints (register, login, refresh, password reset)
- Jobs CRUD operations
- Token validation
- CORS headers
- Rate limiting
- File upload validation (CSV, Unicode, empty, special characters)

### 4. Security Tests (`security.spec.js`) - 40+ tests
- SQL injection prevention
- XSS protection
- Token tampering detection
- Authorization isolation
- Input validation
- Session management
- Information disclosure prevention
- CSRF protection
- Rate limiting / brute force protection

## Prerequisites

1. **Start Backend:**
   ```bash
   cd backend
   python manage.py runserver 0.0.0.0:8000
   ```

2. **Start Frontend:**
   ```bash
   cd frontend
   npm run dev
   ```

## Running Tests

### All E2E Tests
```bash
cd frontend
npm run test:e2e
```

### Specific Test Suites
```bash
# Authentication tests only
npm run test:e2e -- tests/e2e/auth.spec.js

# Dashboard tests only
npm run test:e2e -- tests/e2e/dashboard.spec.js

# API tests only
npm run test:e2e -- tests/e2e/api.spec.js

# Security tests only
npm run test:e2e -- tests/e2e/security.spec.js
```

### With Playwright UI
```bash
npm run test:ui
```

### Headless Mode
```bash
npm run test:e2e -- --headed
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `E2E_API_URL` | `http://127.0.0.1:8000` | Backend API URL |
| `E2E_FRONTEND_URL` | `http://localhost:3000` | Frontend URL |
| `CI` | undefined | Enable CI mode |

## Test Utilities

Available in `tests/utils/api.js`:
- `generateTestUser()` - Create unique test users
- `createTestCSVFile(name, rows, cols)` - Generate test CSV files
- `registerUser()` - Register a new user
- `loginUser()` - Login user
- `createAnalysisJob()` - Upload files for analysis
- `getJobStatus()` - Get job status
- `listJobs()` - List all jobs
- `waitForJobCompletion()` - Poll for job completion

## Backend E2E Tests

Run Django pytest E2E tests:
```bash
cd backend
python -m pytest api/test_e2e.py -v
```

## Test Execution Flow

1. **Global Setup** - Verifies both servers are running
2. **Auth Tests** - Tests registration, login, logout, password reset
3. **Dashboard Tests** - Tests file upload, analysis, navigation
4. **API Tests** - Tests all API endpoints directly
5. **Security Tests** - Tests for vulnerabilities

## Coverage Summary

| Category | Test Count | Coverage |
|----------|------------|----------|
| Authentication | 30+ | 95% |
| Dashboard/UI | 50+ | 90% |
| API Integration | 40+ | 95% |
| Security | 40+ | 85% |
| **Total** | **160+** | **90%** |

## Troubleshooting

### Tests failing with connection errors
- Ensure both servers are running
- Check firewall settings
- Verify URLs in environment variables

### Tests failing with auth errors
- Check if JWT secret is configured
- Verify database is accessible
- Clear test database if needed

### Tests timing out
- Increase timeout values in config
- Check server performance
- Reduce test parallelism
