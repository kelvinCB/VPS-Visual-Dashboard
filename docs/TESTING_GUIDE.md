# Testing Guide

Complete testing documentation for VPS Visual Dashboard.

## Table of Contents

- [Test Summary](#test-summary)
- [Running Tests](#running-tests)
- [E2E Headed Mode (Slow)](#e2e-headed-mode-slow)
- [Test Categories](#test-categories)
- [Test Configuration](#test-configuration)
- [Writing New Tests](#writing-new-tests)
- [Coverage Goals](#coverage-goals)
- [CI/CD Integration](#cicd-integration)

---

## Test Summary

| Category | Tests | Framework |
|----------|-------|-----------|
|| Backend Unit | 20 | Vitest |
| Frontend Unit | 19 | Vitest + JSDOM |
| E2E | 19 | Playwright |
| **Total** | **58** | - |

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

### E2E Tests (Headless)
```bash
# Install Playwright browsers (first time)
npx playwright install

# Run E2E tests headless
npm run test:e2e
```

### Coverage Report
```bash
npm run test:coverage
```

Coverage report generated in `coverage/` directory.

---

## E2E Headed Mode (Slow)

Run E2E tests **one by one** with visible browser and slow motion for human observation:

```bash
# Run with slow motion (500ms delay between actions)
npm run test:e2e:slow

# Run in debug mode (interactive, pauses at each step)
npm run test:e2e:debug

# Custom slow motion speed (e.g., 1000ms = 1 second)
SLOW_MO=1000 npx playwright test
```

| Command | Description |
|---------|-------------|
| `npm run test:e2e:slow` | 500ms delay, headed, sequential |
| `npm run test:e2e:debug` | Interactive debug mode |
| `SLOW_MO=1000 npx playwright test` | Custom 1 second delay |

---

## Test Categories

### Backend Unit Tests

Location: `tests/backend/`

| File | Tests | Description |
|------|-------|-------------|
| `metrics.test.js` | 14 | Utilities (formatBytes/formatUptime/monthly bandwidth) + API stubs |
| `system.test.js` | 3 | System info endpoint |
| `process.test.js` | 3 | Process control endpoints (kill/start/restart) |

**What's tested:**
- `formatBytes()` function with various inputs
- `formatUptime()` function with seconds conversion
- API response structure validation
- Process control logic (mocked)

### Frontend Unit Tests

Location: `tests/frontend/`

| File | Tests | Description |
|------|-------|-------------|
| `app.test.js` | 10 | Configuration, formatting helpers |
| `rendering.test.js` | 8 | DOM structure, initial state |
| `process-controls.test.js` | 1 | Process control buttons visibility (JSDOM) |

**What's tested:**
- Configuration constants (refresh intervals)
- Traffic value formatting function
- DOM element existence
- Initial values (zeros, "Loading...")
- Action buttons rendering logic

### E2E Tests

Location: `tests/e2e/`

| File | Tests | Description |
|------|-------|-------------|
| `dashboard.spec.js` | 17 | Full user flows, API integration |
| `process-control.spec.js` | 2 | Process kill/start/restart flows with mocked API |

**What's tested:**
- Page loads correctly
- Header and logo display
- All metric cards visible
- API endpoints return valid data
- Refresh button functionality
- Responsive design (mobile viewport)
- System info updates after load
- Process kill confirmation and API call
- Start Minecraft button visibility and action

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
