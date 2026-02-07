/**
 * Backend Integration Tests - Disk Breakdown API
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { parseDuBytesOutput, getDiskUsageBreakdown } from '../../server';

describe('parseDuBytesOutput', () => {
  it('parses du -B1 output lines into bytes+path pairs', () => {
    const out = parseDuBytesOutput('10\t/a\n20\t/b\n');
    expect(out).toEqual([
      { bytes: 10, path: '/a' },
      { bytes: 20, path: '/b' },
    ]);
  });
});

describe('getDiskUsageBreakdown', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects mounts other than /', async () => {
    await expect(getDiskUsageBreakdown({ mount: '/etc', depth: 1, limit: 10, execFileFn: vi.fn() }))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('returns sorted, formatted entries (excluding the mount itself)', async () => {
    const execFileFn = vi.fn((cmd, args, opts, cb) => {
      expect(cmd).toBe('du');
      // include mount line; ensure it gets filtered
      cb(null, '5\t/var\n15\t/home\n20\t/\n');
    });

    const payload = await getDiskUsageBreakdown({ mount: '/', depth: 1, limit: 10, execFileFn });

    expect(payload.mount).toBe('/');
    expect(payload.entries.map(e => e.path)).toEqual(['/home', '/var']);
    expect(payload.entries[0].bytes).toBe(15);
    expect(String(payload.entries[0].formatted)).toContain('Bytes');
  });
});

// Note: We intentionally do not integration-test the endpoint with a du mock here.
// Node's child_process module namespace is not always spyable in Vitest depending on runtime.
// getDiskUsageBreakdown is exported and already covered above with an injected execFileFn.
