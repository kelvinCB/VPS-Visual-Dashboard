import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './tests/e2e',
    fullyParallel: process.env.SLOW_MO ? false : true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.SLOW_MO ? 1 : (process.env.CI ? 1 : undefined),
    reporter: 'html',
    use: {
        baseURL: 'http://localhost:7847',
        trace: 'on-first-retry',
        headless: process.env.SLOW_MO ? false : true,
        launchOptions: {
            slowMo: process.env.SLOW_MO ? parseInt(process.env.SLOW_MO) : 0,
        },
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
    webServer: {
        command: 'npm run start',
        url: 'http://localhost:7847',
        reuseExistingServer: !process.env.CI,
    },
});
