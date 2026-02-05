import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

// Load HTML to string
const html = fs.readFileSync(path.resolve(__dirname, '../../public/index.html'), 'utf-8');

// Mock fetch
global.fetch = vi.fn();

// Mock visualization logic in app.js
// Since app.js is not a module we can easily import in node environment without dom,
// we will rely on E2E mostly, but let's try to test the `openMemoryModal` logic if we extracted it.
// For now, E2E covers the UI well. I'll create a placeholder for unit tests if we refactor `app.js` to be more testable.
// In the current structure (vanilla JS with DOM), separate unit tests for logic are hard without refactoring.
// I will create a basic test that ensures the file creates without error and maybe test helper functions if exported.

// We can read app.js and eval it in a mocked DOM environment
const appJsContent = fs.readFileSync(path.resolve(__dirname, '../../public/app.js'), 'utf-8');

describe('Frontend Process Control', () => {
    let dom;
    let window;
    let document;

    beforeEach(() => {
        dom = new JSDOM(html, { runScripts: "dangerously", resources: "usable" });
        window = dom.window;
        document = window.document;

        // Mock console to avoid noise
        window.console = console;

        // Mock global objects
        global.document = document;
        global.window = window;

        // Ensure fetch exists in the window context for app.js
        window.fetch = global.fetch;

        // We can't easily execute app.js because it has immediate execution calls
        // But we can test logical functions if we had them separated.
        // Given the architecture, I will skip complex unit tests here and rely on E2E
        // which is more robust for this setup.
    });

    it('startMinecraft should short-circuit on 401/403 (no polling)', async () => {
        // Minimal DOM needed for the function
        const btn = document.createElement('button');
        btn.id = 'btn-start-mc';
        document.body.appendChild(btn);

        // Mock alert
        window.alert = vi.fn();

        // Mock fetch: return 401 for /start. If polling happens, we'd see a second call to /status.
        global.fetch.mockImplementation(async (url) => {
            if (String(url).includes('/api/services/minecraft/start')) {
                return {
                    status: 401,
                    headers: { get: () => 'application/json' },
                    text: async () => JSON.stringify({ error: 'Unauthorized' })
                };
            }

            // If we ever fetch status, that means polling happened (test should fail).
            if (String(url).includes('/api/services/minecraft/status')) {
                throw new Error('Polling should not occur on 401/403');
            }

            throw new Error(`Unexpected fetch URL: ${url}`);
        });

        // Provide CONFIG + auth header helper expected by app.js
        window.CONFIG = { API_BASE: '' };
        window.getAuthHeaders = () => ({ Authorization: 'Bearer bad' });

        // Evaluate app.js into the DOM context
        window.eval(appJsContent);

        await window.startMinecraft();

        expect(window.alert).toHaveBeenCalled();
        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(String(global.fetch.mock.calls[0][0])).toContain('/api/services/minecraft/start');
    });
});
