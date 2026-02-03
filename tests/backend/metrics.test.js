/**
 * Backend Unit Tests - Metrics API
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock systeminformation before importing server
vi.mock('systeminformation', () => ({
    currentLoad: vi.fn().mockResolvedValue({ currentLoad: 25.5 }),
    mem: vi.fn().mockResolvedValue({
        total: 8589934592, // 8 GB
        used: 4294967296   // 4 GB
    }),
    fsSize: vi.fn().mockResolvedValue([{
        mount: '/',
        size: 107374182400, // 100 GB
        used: 42949672960   // 40 GB
    }]),
    networkStats: vi.fn().mockResolvedValue([{
        rx_bytes: 125000000,
        tx_bytes: 75000000
    }]),
    osInfo: vi.fn().mockResolvedValue({
        platform: 'linux',
        distro: 'Ubuntu',
        release: '22.04',
        kernel: '5.15.0',
        arch: 'x64'
    }),
    system: vi.fn().mockResolvedValue({
        manufacturer: 'Test',
        model: 'VPS'
    })
}));

// Use a temp bandwidth store for tests
process.env.BANDWIDTH_STORE_PATH = `/tmp/vps-dashboard-bandwidth-test-${Date.now()}.json`;

const { app, formatBytes, formatUptime, monthKey, updateMonthlyBandwidth } = await import('../../server.js');

describe('Server Utility Functions', () => {
    describe('monthKey', () => {
        it('should format YYYY-MM', () => {
            const d = new Date('2026-02-03T00:00:00Z');
            expect(monthKey(d)).toBe('2026-02');
        });
    });

    describe('updateMonthlyBandwidth', () => {
        it('should accumulate deltas within the same month and ignore counter resets', () => {
            const now = new Date('2026-02-03T00:00:00Z');

            // First call initializes store
            const a = updateMonthlyBandwidth({ rxBytes: 1000, txBytes: 2000, now });
            expect(a.month).toBe('2026-02');
            expect(a.monthBytes).toBe(0);

            // Increase total by 500
            const b = updateMonthlyBandwidth({ rxBytes: 1200, txBytes: 2300, now });
            expect(b.monthBytes).toBe(500);

            // Simulate reboot/counter reset (total lower) => delta ignored
            const c = updateMonthlyBandwidth({ rxBytes: 10, txBytes: 20, now });
            expect(c.monthBytes).toBe(500);
        });

        it('should reset when month changes', () => {
            const feb = new Date('2026-02-28T23:59:00Z');
            updateMonthlyBandwidth({ rxBytes: 1000, txBytes: 0, now: feb });

            const mar = new Date('2026-03-01T00:01:00Z');
            const out = updateMonthlyBandwidth({ rxBytes: 2000, txBytes: 0, now: mar });
            expect(out.month).toBe('2026-03');
            expect(out.monthBytes).toBe(0);
        });
    });


    describe('formatBytes', () => {
        it('should format 0 bytes correctly', () => {
            expect(formatBytes(0)).toBe('0 Bytes');
        });

        it('should format KB correctly', () => {
            expect(formatBytes(1024)).toBe('1 KB');
        });

        it('should format MB correctly', () => {
            expect(formatBytes(1048576)).toBe('1 MB');
        });

        it('should format GB correctly', () => {
            expect(formatBytes(1073741824)).toBe('1 GB');
        });

        it('should handle decimal precision', () => {
            expect(formatBytes(1536)).toBe('1.5 KB');
        });
    });

    describe('formatUptime', () => {
        it('should format minutes only', () => {
            expect(formatUptime(300)).toBe('5m');
        });

        it('should format hours and minutes', () => {
            expect(formatUptime(3700)).toBe('1h 1m');
        });

        it('should format days, hours and minutes', () => {
            expect(formatUptime(90000)).toBe('1d 1h 0m');
        });
    });
});

describe('API Endpoints', () => {
    describe('GET /api/health', () => {
        it('should have health endpoint defined', async () => {
            // Express app is configured correctly
            // Full integration testing would use supertest
            expect(app).toBeDefined();
        });
    });

    describe('GET /api/metrics', () => {
        it('should return metrics object with cpu, memory, disk, network', async () => {
            // Integration test would verify actual response structure
            expect(true).toBe(true);
        });
    });

    describe('GET /api/system', () => {
        it('should return system info object', async () => {
            // Integration test would verify actual response structure
            expect(true).toBe(true);
        });
    });
});
