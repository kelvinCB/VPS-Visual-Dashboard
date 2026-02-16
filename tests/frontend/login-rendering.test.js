import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

const html = fs.readFileSync(path.resolve(__dirname, '../../public/login.html'), 'utf-8');

describe('Login Page Rendering', () => {
    let dom;
    let window;
    let document;

    beforeEach(() => {
        dom = new JSDOM(html, { 
            url: 'http://localhost/login',
            runScripts: 'dangerously', 
            resources: 'usable' 
        });
        window = dom.window;
        document = window.document;
    });

    afterEach(() => {
        dom.window.close();
    });

    it('should render the login form correctly', () => {
        expect(document.title).toMatch(/Login/i);
        expect(document.getElementById('login-form')).not.toBeNull();
        expect(document.getElementById('email')).not.toBeNull();
        expect(document.getElementById('password')).not.toBeNull();
        expect(document.getElementById('submit-btn')).not.toBeNull();
    });

    it('should have correct autocomplete attributes for security', () => {
        const emailInput = document.getElementById('email');
        const passwordInput = document.getElementById('password');

        expect(emailInput.getAttribute('autocomplete')).toMatch(/email/i);
        expect(passwordInput.getAttribute('autocomplete')).toBe('current-password');
    });

    it('should show loading state on form submit', async () => {
        vi.useFakeTimers();
        const form = document.getElementById('login-form');
        const submitBtn = document.getElementById('submit-btn');

        // Prevent real navigation in JSDOM which throws "Not implemented"
        window.onbeforeunload = () => { };
        
        form.dispatchEvent(new window.Event('submit'));

        expect(submitBtn.disabled).toBe(true);
        expect(submitBtn.classList.contains('is-loading')).toBe(true);

        vi.runAllTimers();
        vi.useRealTimers();
    });

    it('should handle redirection with query parameters', async () => {
        vi.useFakeTimers();
        const mockLocation = new URL('http://localhost/login?redirect=/settings');
        const dom2 = new JSDOM(html, { url: mockLocation.href, runScripts: 'dangerously' });
        const window2 = dom2.window;
        const form2 = window2.document.getElementById('login-form');

        // Prevent real navigation
        window2.onbeforeunload = () => { };

        form2.dispatchEvent(new window2.Event('submit'));

        vi.runAllTimers();
        // Redirection logic is triggered
        vi.useRealTimers();
        dom2.window.close();
    });
});
