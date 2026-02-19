const { test, expect } = require('@playwright/test');

test.describe('Login Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('should display login page', async ({ page }) => {
    await expect(page).toHaveTitle(/Login/i);
    await expect(page.locator('h1.login-title')).toHaveText('Sign in to your VPS Dashboard');
  });

  test('should show loading state and redirect on success', async ({ page }) => {
    await page.fill('#email', 'test@example.com');
    await page.fill('#password', 'password123');
    
    // Click submit
    await page.click('#submit-btn');
    
    // Check loading state (class exists)
    const submitBtn = page.locator('#submit-btn');
    await expect(submitBtn).toBeDisabled();
    await expect(submitBtn).toHaveClass(/is-loading/);
    
    // Should eventually redirect to dashboard (/)
    await page.waitForURL('**/');
    expect(page.url()).not.toContain('/login');
  });

  test('should preserve redirect parameter', async ({ page }) => {
    await page.goto('/login?redirect=/settings');
    
    await page.fill('#email', 'test@example.com');
    await page.fill('#password', 'password123');
    await page.click('#submit-btn');
    
    // Should redirect to /settings
    await page.waitForURL('**/settings');
    expect(page.url()).toContain('/settings');
  });
});
