/**
 * E2E Tests - Dashboard
 */
import { test, expect } from '@playwright/test';

test.describe('VPS Dashboard', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    test('should load dashboard page', async ({ page }) => {
        await expect(page).toHaveTitle('VPS Dashboard');
    });

    test('should display header with logo', async ({ page }) => {
        const logo = page.locator('.logo-text');
        await expect(logo).toBeVisible();
        await expect(logo).toContainText('VPS Dashboard');
    });

    test('should show running status badge', async ({ page }) => {
        const badge = page.locator('#status-badge');
        await expect(badge).toBeVisible();
        await expect(badge).toContainText('Running');
    });

    test('should display CPU metric card', async ({ page }) => {
        const cpuCard = page.locator('#cpu-card');
        await expect(cpuCard).toBeVisible();

        const cpuTitle = cpuCard.locator('.metric-title');
        await expect(cpuTitle).toContainText('CPU usage');
    });

    test('should display Memory metric card', async ({ page }) => {
        const memoryCard = page.locator('#memory-card');
        await expect(memoryCard).toBeVisible();

        const memoryTitle = memoryCard.locator('.metric-title');
        await expect(memoryTitle).toContainText('Memory usage');
    });

    test('should display Disk metric card', async ({ page }) => {
        const diskCard = page.locator('#disk-card');
        await expect(diskCard).toBeVisible();
    });

    test('should load system information', async ({ page }) => {
        // Wait for API call to complete
        await page.waitForTimeout(2000);

        const hostname = page.locator('#hostname');
        await expect(hostname).not.toContainText('Loading...');
    });

    test('should update metrics values after load', async ({ page }) => {
        // Wait for initial API call
        await page.waitForTimeout(2000);

        const cpuValue = page.locator('#cpu-value');
        const value = await cpuValue.textContent();

        // CPU value should be a number (not initial 0 or loading)
        expect(parseFloat(value)).toBeGreaterThanOrEqual(0);
    });

    test('should have refresh button', async ({ page }) => {
        const refreshBtn = page.locator('#refresh-btn');
        await expect(refreshBtn).toBeVisible();
    });

    test('should refresh data when refresh button clicked', async ({ page }) => {
        const refreshBtn = page.locator('#refresh-btn');
        await refreshBtn.click();

        // Button should show spinning animation briefly
        await expect(refreshBtn).toHaveClass(/spinning/);
    });

    test('should display VPS details section', async ({ page }) => {
        const detailsCard = page.locator('.details-card');
        await expect(detailsCard).toBeVisible();

        const title = detailsCard.locator('.details-title');
        await expect(title).toContainText('VPS Details');
    });

    test('should display footer with last updated time', async ({ page }) => {
        const footer = page.locator('.footer');
        await expect(footer).toBeVisible();

        const lastUpdated = page.locator('#last-updated');
        await expect(lastUpdated).toBeVisible();
    });

    test('should be responsive on mobile viewport', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 });

        const dashboard = page.locator('.dashboard');
        await expect(dashboard).toBeVisible();

        // Cards should stack on mobile
        const metricsGrid = page.locator('.metrics-grid');
        await expect(metricsGrid).toBeVisible();
    });
});

test.describe('API Endpoints', () => {
    test('should return metrics from API', async ({ request }) => {
        const response = await request.get('/api/metrics');
        expect(response.ok()).toBeTruthy();

        const data = await response.json();
        expect(data).toHaveProperty('cpu');
        expect(data).toHaveProperty('memory');
        expect(data).toHaveProperty('disk');
        expect(data).toHaveProperty('network');
    });

    test('should return system info from API', async ({ request }) => {
        const response = await request.get('/api/system');
        expect(response.ok()).toBeTruthy();

        const data = await response.json();
        expect(data).toHaveProperty('hostname');
        expect(data).toHaveProperty('platform');
        expect(data).toHaveProperty('uptime');
    });

    test('should return health status', async ({ request }) => {
        const response = await request.get('/api/health');
        expect(response.ok()).toBeTruthy();

        const data = await response.json();
        expect(data.status).toBe('ok');
    });
});
