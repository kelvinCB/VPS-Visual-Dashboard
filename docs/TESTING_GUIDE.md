# Testing Guide

Complete testing documentation for VPS Visual Dashboard.

## Test Summary

| Category | Tests | Framework |
|----------|-------|-----------|
| Backend Unit | 8 | Vitest |
| Frontend Unit | 13 | Vitest + JSDOM |
| E2E | 15 | Playwright |
| **Total** | **36** | - |

---

## Running Tests

### All Tests
```bash
npm test
```

### Backend Tests Only
```bash
npm run test:backend
```

### Frontend Tests Only
```bash
npm run test:frontend
```

### E2E Tests
```bash
# Install Playwright browsers (first time)
npx playwright install

# Run E2E tests
npm run test:e2e
```

### Coverage Report
```bash
npm run test:coverage
```

Coverage report generated in `coverage/` directory.

---

## Test Categories

### Backend Unit Tests

Location: `tests/backend/`

| File | Tests | Description |
|------|-------|-------------|
| `metrics.test.js` | 5 | API metrics endpoint, formatBytes |
| `system.test.js` | 3 | System info endpoint, formatUptime |

**What's tested:**
- `formatBytes()` function with various inputs
- `formatUptime()` function with seconds conversion
- API response structure validation

### Frontend Unit Tests

Location: `tests/frontend/`

| File | Tests | Description |
|------|-------|-------------|
| `app.test.js` | 6 | Configuration, formatTrafficValue |
| `rendering.test.js` | 7 | DOM structure, initial state |

**What's tested:**
- Configuration constants (refresh intervals)
- Traffic value formatting function
- DOM element existence
- Initial values (zeros, "Loading...")

### E2E Tests

Location: `tests/e2e/`

| File | Tests | Description |
|------|-------|-------------|
| `dashboard.spec.js` | 15 | Full user flows, API integration |

**What's tested:**
- Page loads correctly
- Header and logo display
- All metric cards visible
- API endpoints return valid data
- Refresh button functionality
- Responsive design (mobile viewport)
- System info updates after load

---

## Test Configuration

### Vitest Config (`vitest.config.js`)

```javascript
{
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html']
    }
  }
}
```

### Playwright Config (`playwright.config.js`)

```javascript
{
  testDir: './tests/e2e',
  webServer: {
    command: 'npm run start',
    url: 'http://localhost:7847'
  },
  use: {
    baseURL: 'http://localhost:7847'
  }
}
```

---

## Writing New Tests

### Backend Test Example

```javascript
import { describe, it, expect, vi } from 'vitest';

describe('New Feature', () => {
  it('should work correctly', () => {
    expect(true).toBe(true);
  });
});
```

### Frontend Test Example

```javascript
import { JSDOM } from 'jsdom';

describe('Component', () => {
  beforeEach(() => {
    const dom = new JSDOM('<div id="test"></div>');
    // setup
  });

  it('should render', () => {
    // test
  });
});
```

### E2E Test Example

```javascript
import { test, expect } from '@playwright/test';

test('user flow', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('VPS Dashboard');
});
```

---

## Coverage Goals

| Metric | Current | Goal |
|--------|---------|------|
| Statements | ~60% | 80% |
| Branches | ~50% | 75% |
| Functions | ~70% | 85% |
| Lines | ~60% | 80% |

---

## CI/CD Integration

Tests run automatically with:
```bash
npm test && npm run test:e2e
```

For CI environments:
```bash
CI=true npm run test:e2e
```
