/**
 * E2E Tests - Account Menu
 */
import { test, expect } from '@playwright/test';

test.describe('Account Menu', () => {
    test.beforeEach(async ({ page }) => {
        // Clear local storage to ensure unauthenticated state initially
        await page.goto('/');
        await page.evaluate(() => localStorage.clear());
        await page.reload();
    });

    test('should display Account menu button', async ({ page }) => {
        const accountBtn = page.locator('#account-btn');
        await expect(accountBtn).toBeVisible();
        await expect(accountBtn).toContainText('My Account');
    });

    test('should open account dropdown on click', async ({ page }) => {
        const accountBtn = page.locator('#account-btn');
        const accountMenu = page.locator('#account-menu');

        await expect(accountMenu).not.toHaveClass(/active/);

        await accountBtn.click();

        await expect(accountMenu).toHaveClass(/active/);
        await expect(accountBtn).toHaveAttribute('aria-expanded', 'true');
    });

    test('should close account dropdown on clicking outside', async ({ page }) => {
        const accountBtn = page.locator('#account-btn');
        const accountMenu = page.locator('#account-menu');

        await accountBtn.click();
        await expect(accountMenu).toHaveClass(/active/);

        // Click outside
        await page.locator('body').click({ position: { x: 0, y: 0 } });

        await expect(accountMenu).not.toHaveClass(/active/);
        await expect(accountBtn).toHaveAttribute('aria-expanded', 'false');
    });

    test('should show "Sign In" when unauthenticated', async ({ page }) => {
        const authActionText = page.locator('#auth-action-text');
        const accountBtn = page.locator('#account-btn');
        await accountBtn.click();
        await expect(authActionText).toHaveText('Sign In');
    });

    test('should show "Sign Out" when authenticated', async ({ page }) => {
        // Authenticate by setting apiToken in localStorage
        await page.evaluate(() => localStorage.setItem('apiToken', 'fake-token'));
        await page.reload();

        const authActionText = page.locator('#auth-action-text');
        const accountBtn = page.locator('#account-btn');
        await accountBtn.click();

        await expect(authActionText).toHaveText('Sign Out');
    });

    test('should clear apiToken on "Sign Out"', async ({ page }) => {
        await page.evaluate(() => localStorage.setItem('apiToken', 'fake-token'));
        await page.reload();

        const authActionBtn = page.locator('#auth-action-btn');
        const accountBtn = page.locator('#account-btn');
        await accountBtn.click();
        await authActionBtn.click();

        const token = await page.evaluate(() => localStorage.getItem('apiToken'));
        expect(token).toBeNull();

        const authActionText = page.locator('#auth-action-text');
        await accountBtn.click(); // Open again to verify
        await expect(authActionText).toHaveText('Sign In');
    });
});
