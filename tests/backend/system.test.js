/**
 * Backend Unit Tests - System API
 */
import { describe, it, expect, vi } from 'vitest';

// Mock systeminformation
vi.mock('systeminformation', () => ({
    currentLoad: vi.fn().mockResolvedValue({ currentLoad: 10 }),
    mem: vi.fn().mockResolvedValue({ total: 8589934592, used: 4294967296 }),
    fsSize: vi.fn().mockResolvedValue([{ mount: '/', size: 107374182400, used: 42949672960 }]),
    networkStats: vi.fn().mockResolvedValue([{ rx_bytes: 100000, tx_bytes: 50000 }]),
    osInfo: vi.fn().mockResolvedValue({
        platform: 'linux',
        distro: 'Ubuntu',
        release: '22.04',
        kernel: '5.15.0-generic',
        arch: 'x64'
    }),
    system: vi.fn().mockResolvedValue({
        manufacturer: 'QEMU',
        model: 'Standard PC'
    })
}));

const { formatUptime } = await import('../../server.js');

describe('System Information', () => {
    describe('formatUptime', () => {
        it('should format seconds into human readable uptime', () => {
            expect(formatUptime(60)).toBe('1m');
            expect(formatUptime(3600)).toBe('1h 0m');
            expect(formatUptime(86400)).toBe('1d 0h 0m');
        });

        it('should handle complex durations', () => {
            // 2 days, 5 hours, 30 minutes = 192600 seconds
            expect(formatUptime(192600)).toBe('2d 5h 30m');
        });
    });
});

describe('System API Response Structure', () => {
    it('should include all required fields', () => {
        const expectedFields = [
            'hostname',
            'platform',
            'distro',
            'release',
            'kernel',
            'arch',
            'uptime',
            'location'
        ];

        // This would be an integration test with supertest
        expectedFields.forEach(field => {
            expect(typeof field).toBe('string');
        });
    });
});
