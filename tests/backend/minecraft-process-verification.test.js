import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { detectMinecraftProcess } from '../../server';

describe('Minecraft process verification', () => {
    const ORIGINAL_ENV = { ...process.env };

    beforeEach(() => {
        delete process.env.MC_PROCESS_MATCH;
    });

    afterEach(() => {
        process.env = { ...ORIGINAL_ENV };
    });

    it('matches Minecraft by default heuristics (java + minecraft in command)', () => {
        const proc = detectMinecraftProcess([
            { pid: 1, name: 'node', command: 'node server.js' },
            { pid: 2, name: 'java', command: 'java -Xmx2G -jar minecraft_server.jar nogui' }
        ]);

        expect(proc.matched).toBe(true);
        expect(proc.pid).toBe(2);
        expect(proc.reason).toBe('default');
    });

    it('does not match when only an unrelated listener process exists', () => {
        const proc = detectMinecraftProcess([
            { pid: 10, name: 'nginx', command: 'nginx: master process /usr/sbin/nginx' }
        ]);

        expect(proc.matched).toBe(false);
        expect(proc.pid).toBe(null);
        expect(proc.reason).toBe('default:no-match');
    });

    it('can be overridden via MC_PROCESS_MATCH', () => {
        process.env.MC_PROCESS_MATCH = 'bedrock_server,mc';

        const proc = detectMinecraftProcess([
            { pid: 100, name: 'bedrock_server', command: '/srv/mc/bedrock_server' },
            { pid: 101, name: 'node', command: 'node server.js' }
        ]);

        expect(proc.matched).toBe(true);
        expect(proc.pid).toBe(100);
        expect(proc.reason).toBe('env:MC_PROCESS_MATCH');
    });

    it('reports no-match when MC_PROCESS_MATCH is set but nothing matches', () => {
        process.env.MC_PROCESS_MATCH = 'definitely-not-minecraft';

        const proc = detectMinecraftProcess([
            { pid: 200, name: 'java', command: 'java -jar something-else.jar' }
        ]);

        expect(proc.matched).toBe(false);
        expect(proc.pid).toBe(null);
        expect(proc.reason).toBe('env:MC_PROCESS_MATCH:no-match');
    });
});
