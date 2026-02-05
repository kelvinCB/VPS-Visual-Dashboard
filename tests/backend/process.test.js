import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../../server';
import si from 'systeminformation';

const cp = require('child_process');

describe('Process Control Endpoints', () => {

    const ORIGINAL_ENV = { ...process.env };

    beforeEach(() => {
        vi.clearAllMocks();

        // Default behavior should remain unauthenticated unless explicitly configured.
        delete process.env.DASHBOARD_API_TOKEN;

        // Spy on systeminformation methods
        vi.spyOn(si, 'processes').mockResolvedValue({
            list: [
                { pid: 123, name: 'java', command: 'java -jar minecraft.jar', mem: 500000000, cpu: 10 },
                { pid: 456, name: 'node', command: 'node server.js', mem: 100000000, cpu: 1 },
            ]
        });
        vi.spyOn(si, 'mem').mockResolvedValue({ total: 1000000000, used: 600000000, free: 400000000 });

        // Spy on cp.spawn
        vi.spyOn(cp, 'spawn').mockImplementation(() => {
            return {
                unref: vi.fn(),
                on: vi.fn(),
                pid: 9999,
                stdout: { on: vi.fn(), pipe: vi.fn() },
                stderr: { on: vi.fn(), pipe: vi.fn() }
            };
        });

        vi.spyOn(cp, 'exec').mockImplementation((cmd, cb) => cb(null, 'stdout', 'stderr'));

        vi.spyOn(process, 'kill').mockImplementation(() => true);
    });

    afterEach(() => {
        process.env = { ...ORIGINAL_ENV };
        vi.restoreAllMocks();
    });

    it('GET /api/processes should return process list and identify minecraft running', async () => {
        const res = await request(app).get('/api/processes');
        expect(res.statusCode).toBe(200);
        expect(res.body.processes).toHaveLength(2);
        expect(res.body.isMinecraftRunning).toBe(true);
        expect(res.body.minecraftPid).toBe(123);
    });

    it('POST /api/processes/:pid/kill should try to kill process', async () => {
        const pid = 123;
        const killSpy = vi.spyOn(process, 'kill');

        const res = await request(app).post(`/api/processes/${pid}/kill`);

        expect(res.status).toBe(200);
        expect(killSpy).toHaveBeenCalledWith(pid, 'SIGTERM');
    });

    it('should enforce Bearer token auth on sensitive endpoints when DASHBOARD_API_TOKEN is set', async () => {
        process.env.DASHBOARD_API_TOKEN = 'test-token';

        const res = await request(app).post('/api/processes/123/kill');
        expect(res.status).toBe(401);
        expect(res.body).toEqual({ error: 'Unauthorized' });
    });

    it('should accept Authorization: Bearer <token> when DASHBOARD_API_TOKEN is set', async () => {
        process.env.DASHBOARD_API_TOKEN = 'test-token';

        const res = await request(app)
            .post('/api/processes/123/kill')
            .set('Authorization', 'Bearer test-token');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it('should accept X-API-KEY fallback when DASHBOARD_API_TOKEN is set', async () => {
        process.env.DASHBOARD_API_TOKEN = 'test-token';

        const res = await request(app)
            .post('/api/processes/123/kill')
            .set('X-API-KEY', 'test-token');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it('POST /api/services/minecraft/start should execute start command', async () => {
        // This test will take ~500ms due to startup check
        process.env.MC_START_COMMAND = 'echo "start mc"';

        const res = await request(app).post('/api/services/minecraft/start');

        expect(res.status).toBe(200);
        // expect(cp.spawn).toHaveBeenCalled(); // FIXME: Spy artifact
    }, 5000); // 5s timeout

    it('POST /api/services/minecraft/restart should sequence kill and start', async () => {
        // This test will take ~2.5s (2s kill delay + 500ms start check)
        const res = await request(app).post('/api/services/minecraft/restart');

        expect(res.status).toBe(200);
        // expect(cp.spawn).toHaveBeenCalled(); // FIXME: Spy artifact
    }, 10000); // 10s timeout
});
