import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getMinecraftListenHost, isPortListening } from '../../server';

describe('Minecraft listen host configuration', () => {
    const ORIGINAL_ENV = { ...process.env };

    beforeEach(() => {
        // keep tests deterministic
        delete process.env.MC_BIND_HOST;
        delete process.env.MC_LISTEN_HOST;
    });

    afterEach(() => {
        process.env = { ...ORIGINAL_ENV };
    });

    it('getMinecraftListenHost defaults to loopback-only (127.0.0.1)', () => {
        expect(getMinecraftListenHost()).toBe('127.0.0.1');
    });

    it('getMinecraftListenHost prefers MC_LISTEN_HOST (or MC_BIND_HOST) when set', () => {
        process.env.MC_LISTEN_HOST = '0.0.0.0';
        expect(getMinecraftListenHost()).toBe('0.0.0.0');

        delete process.env.MC_LISTEN_HOST;
        process.env.MC_BIND_HOST = '192.168.1.10';
        expect(getMinecraftListenHost()).toBe('192.168.1.10');
    });

    it('isPortListening uses the resolved host (default or env override)', async () => {
        let connectArgs = null;

        class FakeSocket {
            constructor() {
                this._handlers = {};
            }
            setTimeout() {}
            once(evt, cb) {
                this._handlers[evt] = cb;
                return this;
            }
            connect(port, host) {
                connectArgs = { port, host };
                if (this._handlers.connect) this._handlers.connect();
            }
            destroy() {}
        }

        // Default (no env)
        await expect(isPortListening(25565, undefined, FakeSocket)).resolves.toBe(true);
        expect(connectArgs).toEqual({ port: 25565, host: '127.0.0.1' });

        // Override
        process.env.MC_LISTEN_HOST = '0.0.0.0';
        await expect(isPortListening(25565, undefined, FakeSocket)).resolves.toBe(true);
        expect(connectArgs).toEqual({ port: 25565, host: '0.0.0.0' });
    });
});
