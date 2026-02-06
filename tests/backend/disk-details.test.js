/**
 * Backend Integration Tests - Disk Details API
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../../server';
import si from 'systeminformation';

describe('GET /api/disk/details', () => {
    beforeEach(() => {
        vi.spyOn(si, 'fsSize').mockResolvedValue([
            {
                fs: '/dev/sda1',
                mount: '/',
                type: 'ext4',
                size: 1000,
                used: 400,
                use: 40
            }
        ]);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should return filesystems list with formatted fields', async () => {
        const res = await request(app).get('/api/disk/details');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.filesystems)).toBe(true);
        expect(res.body.filesystems[0].mount).toBe('/');
        expect(res.body.filesystems[0].usePercent).toBe(40);
        expect(res.body.filesystems[0].availBytes).toBe(600);
        expect(res.body.note).toContain('disabled');
    });
});
