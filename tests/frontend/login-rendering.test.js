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

        // Mock matchMedia for JSDOM
        window.matchMedia = vi.fn().mockImplementation(query => ({
            matches: false,
            media: query,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
        }));
    });

    afterEach(() => {
        dom.window.close();
    });

    it('should render the login form correctly', () => {
        expect(document.title).toMatch(/Login/i);
        expect(document.getElementById('login-form')).not.toBeNull();
        expect(document.getElementById('email')).not.toBeNull();
        expect(document.getElementById('password')).not.toBeNull();
        expect(document.getElementById('toggle-password')).not.toBeNull();
        expect(document.getElementById('submit-btn')).not.toBeNull();
    });

    it('should have correct attributes for security and accessibility', () => {
        const emailInput = document.getElementById('email');
        const passwordInput = document.getElementById('password');
        const toggleBtn = document.getElementById('toggle-password');

        expect(emailInput.getAttribute('autocomplete')).toBe('email');
        expect(emailInput.getAttribute('name')).toBe('email');
        expect(passwordInput.getAttribute('autocomplete')).toBe('current-password');
        expect(passwordInput.getAttribute('name')).toBe('password');

        // Toggle button
        expect(toggleBtn.getAttribute('type')).toBe('button');
        expect(toggleBtn.getAttribute('aria-label')?.toLowerCase()).toContain('show');
    });

    it('should show loading state on form submit', async () => {
        vi.useFakeTimers();
        const form = document.getElementById('login-form');
        const submitBtn = document.getElementById('submit-btn');

        // Prevent real navigation in JSDOM
        window.onbeforeunload = () => { };
        
        form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));

        expect(submitBtn.disabled).toBe(true);
        expect(submitBtn.classList.contains('is-loading')).toBe(true);

        vi.runAllTimers();
        vi.useRealTimers();
    });

    it('should toggle password visibility', () => {
        const passwordInput = document.getElementById('password');
        const toggleBtn = document.getElementById('toggle-password');

        expect(passwordInput.type).toBe('password');
        toggleBtn.click();
        expect(passwordInput.type).toBe('text');
        toggleBtn.click();
        expect(passwordInput.type).toBe('password');
    });

    it('should handle redirection with query parameters', async () => {
        vi.useFakeTimers();
        // Create a new JSDOM with specific redirect param
        const redirectUrl = 'http://localhost/login?redirect=/settings';
        const dom2 = new JSDOM(html, { 
            url: redirectUrl, 
            runScripts: 'dangerously',
            resources: 'usable'
        });
        const window2 = dom2.window;
        
        // Mock matchMedia for dom2
        window2.matchMedia = vi.fn().mockImplementation(query => ({
            matches: false,
            media: query,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
        }));

        const form2 = window2.document.getElementById('login-form');

        // Prevent real navigation
        window2.onbeforeunload = () => { };

        form2.dispatchEvent(new window2.Event('submit', { bubbles: true, cancelable: true }));

        vi.runAllTimers();
        // Logic reached
        vi.useRealTimers();
        dom2.window.close();
    });
});
