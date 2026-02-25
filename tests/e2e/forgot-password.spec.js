const { test, expect } = require('@playwright/test');

test.describe('Forgot Password Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/forgot-password');
  });

  test('should display forgot password page', async ({ page }) => {
    await expect(page).toHaveTitle(/Forgot Password/i);
    await expect(page.locator('h1.login-title')).toHaveText('Forgot your password?');
    await expect(page.locator('#email')).toBeVisible();
  });

  test('should show success feedback after submit', async ({ page }) => {
    await page.fill('#email', 'test@example.com');
    const submitBtn = page.locator('#submit-btn');

    await page.click('#submit-btn');
    await expect(submitBtn).toBeDisabled();
    await expect(submitBtn).toHaveClass(/is-loading/);

    await expect(page.locator('#feedback-msg')).toContainText('reset link');
    await expect(submitBtn).toHaveText(/check your inbox/i);
  });
});
