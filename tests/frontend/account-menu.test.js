/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('Account Menu Dropdown', () => {
    let app;
    let Elements;

    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();

        // Load the actual HTML
        const html = readFileSync(resolve(__dirname, '../../public/index.html'), 'utf-8');
        document.body.innerHTML = html;

        // Reset localStorage
        localStorage.clear();

        app = await import('../../public/app.js');
        // trigger init manually or rely on DOMContentLoaded if needed. 
        // We'll just call the functions directly since app.js initialization is event-based.

        // Mock getApiToken and updateAccountAuthState might be internal, so we test behavior
        document.dispatchEvent(new Event('DOMContentLoaded'));

        // Allow time for initialization
        await new Promise(r => setTimeout(r, 50));
    });

    it('should have correct elements', () => {
        const btn = document.getElementById('account-btn');
        const menu = document.getElementById('account-menu');
        expect(btn).toBeTruthy();
        expect(menu).toBeTruthy();
    });

    it('should show "Sign In" text when unauthenticated', () => {
        const actionText = document.getElementById('auth-action-text');
        expect(actionText.textContent).toBe('Sign In');
    });

    it('should show "Sign Out" text when authenticated', async () => {
        localStorage.setItem('apiToken', 'fake-token');
        document.dispatchEvent(new Event('DOMContentLoaded')); // reload
        await new Promise(r => setTimeout(r, 50));

        const actionText = document.getElementById('auth-action-text');
        expect(actionText.textContent).toBe('Sign Out');
    });

    it('should toggle active class on menu when button is clicked', () => {
        const btn = document.getElementById('account-btn');
        const menu = document.getElementById('account-menu');

        expect(menu.classList.contains('active')).toBe(false);
        expect(btn.getAttribute('aria-expanded')).toBe('false');

        btn.click();

        expect(menu.classList.contains('active')).toBe(true);
        expect(btn.getAttribute('aria-expanded')).toBe('true');

        btn.click();

        expect(menu.classList.contains('active')).toBe(false);
        expect(btn.getAttribute('aria-expanded')).toBe('false');
    });

    it('should log out when clicking "Sign Out"', async () => {
        localStorage.setItem('apiToken', 'fake-token');
        document.dispatchEvent(new Event('DOMContentLoaded'));
        await new Promise(r => setTimeout(r, 50));

        const authActionBtn = document.getElementById('auth-action-btn');
        authActionBtn.click();

        expect(localStorage.getItem('apiToken')).toBeNull();
        const actionText = document.getElementById('auth-action-text');
        expect(actionText.textContent).toBe('Sign In');
    });
});
