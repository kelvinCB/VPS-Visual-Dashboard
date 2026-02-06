import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

const html = fs.readFileSync(path.resolve(__dirname, '../../public/index.html'), 'utf-8');
const appJsContent = fs.readFileSync(path.resolve(__dirname, '../../public/app.js'), 'utf-8');

global.fetch = vi.fn();

function resJson(status, obj) {
    return {
        status,
        ok: status >= 200 && status < 300,
        headers: { get: () => 'application/json' },
        json: async () => obj,
        text: async () => JSON.stringify(obj)
    };
}

describe('Frontend Process Control', () => {
    let dom;
    let window;
    let document;
    let fakeNow;

    beforeEach(() => {
        vi.useFakeTimers();

        fakeNow = 0;
        vi.spyOn(Date, 'now').mockImplementation(() => fakeNow);

        dom = new JSDOM(html, { runScripts: 'dangerously', resources: 'usable' });
        window = dom.window;
        document = window.document;

        window.console = console;
        global.document = document;
        global.window = window;
        window.fetch = global.fetch;

        // Route window timers through Vitest fake timers.
        window.setTimeout = setTimeout;
        window.clearTimeout = clearTimeout;

        // Mock Date.now inside the JSDOM window for countdown label.
        window.Date.now = () => fakeNow;

        // Avoid long-running intervals in tests.
        window.setInterval = () => 0;

        window.requestAnimationFrame = (cb) => setTimeout(cb, 0);

        // Canvas is used for charts; JSDOM doesn't implement it.
        // Provide a tiny stub so init() doesn't crash.
        window.HTMLCanvasElement.prototype.getContext = () => ({
            beginPath: () => { },
            moveTo: () => { },
            lineTo: () => { },
            stroke: () => { },
            clearRect: () => { },
            fillText: () => { },
            arc: () => { },
            fill: () => { },
            measureText: () => ({ width: 0 }),
            setLineDash: () => { }
        });
    });

    afterEach(() => {
        try { dom?.window?.close(); } catch { /* ignore */ }
        vi.useRealTimers();
        vi.clearAllMocks();
    });

    it('startMinecraft should short-circuit on 401/403 (no boot polling)', async () => {
        const btn = document.createElement('button');
        btn.id = 'btn-start-mc';
        document.body.appendChild(btn);

        window.alert = vi.fn();

        global.fetch.mockImplementation(async (url) => {
            const u = String(url);
            if (u.includes('/api/services/minecraft/start')) return resJson(401, { error: 'Unauthorized' });
            if (u.includes('/api/services/minecraft/status')) return resJson(200, { success: true, running: false });
            if (u.includes('/api/metrics')) return resJson(200, { cpu: { usage: 0, cores: 1 }, memory: { usage: 0 }, disk: { usage: 0 }, network: {} });
            if (u.includes('/api/system')) return resJson(200, {});
            if (u.includes('/api/processes')) return resJson(200, { breakdown: {}, processes: [], isMinecraftRunning: false, minecraftPid: null });
            throw new Error(`Unexpected fetch URL: ${url}`);
        });

        window.CONFIG = { API_BASE: '', REFRESH_INTERVAL: 9999999 };
        window.getAuthHeaders = () => ({ Authorization: 'Bearer bad' });

        window.eval(appJsContent);
        await window.startMinecraft();

        expect(window.alert).toHaveBeenCalled();
        expect(global.fetch.mock.calls.some((c) => String(c[0]).includes('/api/services/minecraft/start'))).toBe(true);
        // Button should be re-enabled after auth short-circuit.
        expect(btn.disabled).toBe(false);
    });

    it('startMinecraft should disable the button and keep it disabled while starting', async () => {
        // Make the modal "active" so the start loop updates UI.
        const overlay = document.getElementById('memory-modal');
        overlay.classList.add('active');

        const btn = document.createElement('button');
        btn.id = 'btn-start-mc';
        document.body.appendChild(btn);

        window.alert = vi.fn();

        global.fetch.mockImplementation(async (url) => {
            const u = String(url);
            if (u.includes('/api/services/minecraft/start')) return resJson(200, { success: true });
            if (u.includes('/api/services/minecraft/status')) return resJson(200, { running: false });
            if (u.includes('/api/metrics')) return resJson(200, { cpu: { usage: 0, cores: 1 }, memory: { usage: 0 }, disk: { usage: 0 }, network: {} });
            if (u.includes('/api/system')) return resJson(200, {});
            if (u.includes('/api/processes')) return resJson(200, { breakdown: {}, processes: [], isMinecraftRunning: false, minecraftPid: null });
            throw new Error(`Unexpected fetch URL: ${url}`);
        });

        window.CONFIG = { API_BASE: '', REFRESH_INTERVAL: 9999999 };
        window.getAuthHeaders = () => ({ Authorization: 'Bearer ok' });

        window.eval(appJsContent);

        await window.startMinecraft();

        // Starting state is immediate.
        expect(btn.disabled).toBe(true);
        expect(btn.textContent).toMatch(/Starting/i);
        expect(btn.textContent).toMatch(/take up to 3 minutes/i);

        // Still disabled and label should keep the hint.
        expect(btn.disabled).toBe(true);
        expect(btn.textContent).toMatch(/take up to 3 minutes/i);
        // should include an elapsed time segment
        expect(btn.textContent).toMatch(/\d+s|\d+min\s+\d+\s+seconds/i);
    });
});
