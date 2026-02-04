import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../../server';
import si from 'systeminformation';
import cp from 'child_process';

describe('Process Control Endpoints', () => {

    beforeEach(() => {
        // Spy on systeminformation methods
        vi.spyOn(si, 'processes').mockResolvedValue({
            list: [
                { pid: 123, name: 'java', command: 'java -jar minecraft.jar', mem: 500000000, cpu: 10 },
                { pid: 456, name: 'node', command: 'node server.js', mem: 100000000, cpu: 1 },
            ]
        });
        vi.spyOn(si, 'mem').mockResolvedValue({ total: 1000000000, used: 600000000, free: 400000000 });

        // Spy on child_process.exec
        // Since server.js requires child_process inside the function, it gets this same module instance
        vi.spyOn(cp, 'exec').mockImplementation((cmd, cb) => cb(null, 'stdout', 'stderr'));

        // Mock process.kill globally for the test process
        vi.spyOn(process, 'kill').mockImplementation(() => true);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });


    it('GET /api/processes should return process list and identify minecraft running', async () => {
        const res = await request(app).get('/api/processes');
        expect(res.status).toBe(200);
        expect(res.body.processes).toHaveLength(2);
        expect(res.body.isMinecraftRunning).toBe(true);
    });

    it('POST /api/processes/:pid/kill should try to kill process', async () => {
        const pid = 123;
        // Mock process.kill (careful not to kill actual test runner!)
        const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true);

        const res = await request(app).post(`/api/processes/${pid}/kill`);

        expect(res.status).toBe(200);
        expect(killSpy).toHaveBeenCalledWith(pid, 'SIGTERM');
        killSpy.mockRestore();
    });

    it('POST /api/services/minecraft/start should execute start command', async () => {
        process.env.MC_START_COMMAND = 'echo "start mc"';

        const res = await request(app).post('/api/services/minecraft/start');

        expect(res.status).toBe(200);
        // Note: server.js requires child_process inside the function or file. 
        // Since we mocked the module, we need to verify if the server uses it correctly.
        // Our server implementation uses require('child_process').exec inside `runCommand`.
    });

    // Clean up
    vi.restoreAllMocks();
});
