/**
 * Backend Integration Tests - CPU Details API
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../../server';
import si from 'systeminformation';

describe('GET /api/cpu/details', () => {
    beforeEach(() => {
        vi.spyOn(si, 'currentLoad').mockResolvedValue({
            currentLoad: 42.42,
            cpus: [{ load: 10.1 }, { load: 55.5 }]
        });

        vi.spyOn(si, 'processes').mockResolvedValue({
            list: [
                { pid: 111, name: 'node', cpu: 12.345, mem: 3.21 },
                { pid: 222, name: 'postgres', cpu: 55.1, mem: 1.0 },
                { pid: 333, name: 'nginx', cpu: 0.3, mem: 0.1 }
            ]
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should return breakdown, perCore and topProcesses', async () => {
        const res = await request(app).get('/api/cpu/details');
        expect(res.status).toBe(200);

        expect(res.body.breakdown).toBeDefined();
        expect(res.body.breakdown.overall).toBe(42.4);

        expect(Array.isArray(res.body.perCore)).toBe(true);
        expect(res.body.perCore.length).toBe(2);
        expect(res.body.perCore[0]).toEqual({ core: 0, load: 10.1 });

        expect(Array.isArray(res.body.topProcesses)).toBe(true);
        // sorted desc by cpu
        expect(res.body.topProcesses[0].pid).toBe(222);
        expect(res.body.topProcesses[0].cpu).toBe(55.1);
    });
});
