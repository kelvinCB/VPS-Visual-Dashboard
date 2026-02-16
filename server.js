require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const os = require('os');
const si = require('systeminformation');
const fs = require('fs');
const cp = require('child_process');
const net = require('net');

const app = express();
const PORT = process.env.PORT || 7847;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

// ===== Optional API Auth (Bearer token)
// If DASHBOARD_API_TOKEN is not set, all endpoints behave as they do today.
// If set, sensitive endpoints must provide:
//   Authorization: Bearer <token>
// or
//   X-API-KEY: <token>
function getProvidedApiToken(req) {
    const auth = req.headers['authorization'];
    if (auth && typeof auth === 'string') {
        const m = auth.match(/^Bearer\s+(.+)$/i);
        if (m) return m[1];
    }

    const xApiKey = req.headers['x-api-key'];
    if (typeof xApiKey === 'string' && xApiKey.trim()) return xApiKey.trim();

    return null;
}

function requireApiTokenIfConfigured(req, res, next) {
    const required = process.env.DASHBOARD_API_TOKEN;
    if (!required) return next();

    const provided = getProvidedApiToken(req);
    if (!provided || provided !== required) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    return next();
}

// Cache for metrics to avoid excessive system calls
let metricsCache = null;
let metricsCacheTime = 0;
const METRICS_CACHE_TTL = 5000; // 5 seconds

// Helper function to format bytes
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// ===== Bandwidth Tracking (monthly)
// systeminformation networkStats() counters are typically since boot.
// We persist deltas to a small JSON file so we can approximate month-to-date usage.
const BANDWIDTH_STORE_PATH = process.env.BANDWIDTH_STORE_PATH || path.join(__dirname, 'data', 'bandwidth.json');

function monthKey(date = new Date()) {
    // Use UTC to avoid timezone edge-cases around month boundaries
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
}

function loadBandwidthStore() {
    try {
        if (!fs.existsSync(BANDWIDTH_STORE_PATH)) return null;
        const raw = fs.readFileSync(BANDWIDTH_STORE_PATH, 'utf8');
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

function saveBandwidthStore(store) {
    try {
        fs.mkdirSync(path.dirname(BANDWIDTH_STORE_PATH), { recursive: true });
        fs.writeFileSync(BANDWIDTH_STORE_PATH, JSON.stringify(store, null, 2));
    } catch {
        // ignore write failures
    }
}

function updateMonthlyBandwidth({ rxBytes = 0, txBytes = 0, now = new Date() }) {
    const currentTotal = Math.max(0, Number(rxBytes) + Number(txBytes));
    const key = monthKey(now);

    const store = loadBandwidthStore() || {
        month: key,
        monthBytes: 0,
        lastTotal: currentTotal,
        lastUpdated: now.toISOString()
    };

    // Reset monthly total if month changed
    if (store.month !== key) {
        store.month = key;
        store.monthBytes = 0;
        store.lastTotal = currentTotal;
        store.lastUpdated = now.toISOString();
        saveBandwidthStore(store);
        return { month: store.month, monthBytes: store.monthBytes };
    }

    // Delta since last sample (guards for reboot/counter reset)
    const lastTotal = Math.max(0, Number(store.lastTotal || 0));
    const delta = currentTotal >= lastTotal ? (currentTotal - lastTotal) : 0;

    store.monthBytes = Math.max(0, Number(store.monthBytes || 0) + delta);
    store.lastTotal = currentTotal;
    store.lastUpdated = now.toISOString();

    saveBandwidthStore(store);

    return { month: store.month, monthBytes: store.monthBytes };
}

// Helper function to format uptime
function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
}

// API: Get system metrics (CPU, Memory, Disk, Network)
app.get('/api/metrics', async (req, res) => {
    try {
        const now = Date.now();

        // Return cached data if still valid
        if (metricsCache && (now - metricsCacheTime) < METRICS_CACHE_TTL) {
            return res.json(metricsCache);
        }

        // Gather all metrics in parallel
        const [cpu, mem, disk, network] = await Promise.all([
            si.currentLoad(),
            si.mem(),
            si.fsSize(),
            si.networkStats()
        ]);

        // Calculate disk usage (main partition)
        const mainDisk = disk.find(d => d.mount === '/') || disk[0] || {};

        // Calculate network stats (primary interface)
        const primaryNetwork = network[0] || {};

        const monthly = updateMonthlyBandwidth({
            rxBytes: primaryNetwork.rx_bytes || 0,
            txBytes: primaryNetwork.tx_bytes || 0,
            now: new Date()
        });

        const metrics = {
            cpu: {
                usage: Math.round(cpu.currentLoad * 10) / 10,
                cores: os.cpus().length
            },
            memory: {
                usage: Math.round((mem.used / mem.total) * 100 * 10) / 10,
                used: formatBytes(mem.used),
                total: formatBytes(mem.total),
                usedBytes: mem.used,
                totalBytes: mem.total
            },
            disk: {
                usage: Math.round((mainDisk.used / mainDisk.size) * 100 * 10) / 10 || 0,
                used: formatBytes(mainDisk.used || 0),
                total: formatBytes(mainDisk.size || 0),
                usedBytes: mainDisk.used || 0,
                totalBytes: mainDisk.size || 0
            },
            network: {
                rxBytes: primaryNetwork.rx_bytes || 0,
                txBytes: primaryNetwork.tx_bytes || 0,
                rxFormatted: formatBytes(primaryNetwork.rx_bytes || 0),
                txFormatted: formatBytes(primaryNetwork.tx_bytes || 0),
                month: monthly.month,
                monthBytes: monthly.monthBytes,
                monthFormatted: formatBytes(monthly.monthBytes)
            },
            timestamp: new Date().toISOString()
        };

        // Update cache
        metricsCache = metrics;
        metricsCacheTime = now;

        res.json(metrics);
    } catch (error) {
        console.error('Error getting metrics:', error);
        res.status(500).json({ error: 'Failed to get system metrics' });
    }
});

// API: Get CPU details (per-core + load averages + top processes)
app.get('/api/cpu/details', async (req, res) => {
    try {
        const [load, proc] = await Promise.all([
            si.currentLoad(),
            si.processes()
        ]);

        const perCore = Array.isArray(load?.cpus)
            ? load.cpus.map((c, idx) => ({
                core: idx,
                load: Math.round(Number(c.load || 0) * 10) / 10
            }))
            : [];

        const topProcesses = Array.isArray(proc?.list)
            ? proc.list
                .map(p => ({
                    pid: p.pid,
                    name: p.name || p.command || 'unknown',
                    cpu: Math.round(Number(p.cpu || 0) * 10) / 10,
                    mem: Math.round(Number(p.mem || 0) * 10) / 10
                }))
                .sort((a, b) => b.cpu - a.cpu)
                .slice(0, 10)
            : [];

        const [l1, l5, l15] = os.loadavg();

        res.json({
            breakdown: {
                overall: Math.round(Number(load?.currentLoad || 0) * 10) / 10,
                cores: os.cpus().length,
                loadAvg1m: Math.round(Number(l1 || 0) * 100) / 100,
                loadAvg5m: Math.round(Number(l5 || 0) * 100) / 100,
                loadAvg15m: Math.round(Number(l15 || 0) * 100) / 100
            },
            perCore,
            topProcesses,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error getting CPU details:', error);
        res.status(500).json({ error: 'Failed to get CPU details' });
    }
});

// API: Get Disk details (filesystem list)
app.get('/api/disk/details', async (req, res) => {
    try {
        const disks = await si.fsSize();

        const filesystems = (Array.isArray(disks) ? disks : []).map(d => {
            const size = Number(d.size || 0);
            const used = Number(d.used || 0);
            const avail = Math.max(0, size - used);

            return {
                fs: d.fs,
                mount: d.mount,
                type: d.type,
                sizeBytes: size,
                usedBytes: used,
                availBytes: avail,
                usePercent: Math.round(Number(d.use || 0) * 10) / 10,
                size: formatBytes(size),
                used: formatBytes(used),
                avail: formatBytes(avail)
            };
        });

        res.json({
            filesystems,
            note: 'Top-path disk scans are intentionally disabled by default to keep the dashboard fast. Use /api/disk/breakdown for a lightweight directory breakdown.',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error getting disk details:', error);
        res.status(500).json({ error: 'Failed to get disk details' });
    }
});

// ===== Disk usage breakdown (top directories)
// Goal: help explain how "used" space on / is distributed without doing deep, slow scans.
// We intentionally limit max depth and exclude virtual filesystems.
const DISK_BREAKDOWN_CACHE_TTL_MS = 60_000; // 60s
let diskBreakdownCache = new Map();
let diskBreakdownPending = new Map(); // cache-coalescing for in-flight requests

function validateDiskBreakdownMount(mount) {
    // This feature is intended to explain root (/) usage only.
    // Reject anything else to avoid filesystem enumeration.
    const m = String(mount || '/');
    if (m !== '/') {
        const err = new Error('Invalid mount');
        err.statusCode = 400;
        return err;
    }
    return null;
}

function parseDuBytesOutput(output) {
    // Expected format: "<bytes>\t<path>" per line.
    const lines = String(output || '').split('\n').map(l => l.trim()).filter(Boolean);
    const out = [];

    for (const line of lines) {
        const m = line.match(/^(\d+)\s+(.+)$/);
        if (!m) continue;
        const bytes = Number(m[1]);
        const p = m[2];
        if (!Number.isFinite(bytes) || bytes < 0) continue;
        out.push({ bytes, path: p });
    }

    return out;
}

function getDuExcludeArgs(mount) {
    const safeMount = mount === '/' ? '/' : String(mount || '/');

    // Avoid scanning pseudo-filesystems on root mounts.
    // Note: using --exclude doesn't prevent du from traversing them if they are separate mounts;
    // -x enforces "same filesystem".
    const excludes = safeMount === '/'
        ? ['/proc', '/sys', '/dev', '/run', '/tmp', '/var/lib/docker/overlay2']
        : [];

    const args = [];
    for (const ex of excludes) {
        args.push(`--exclude=${ex}`);
    }

    return args;
}

function parseBoundedInt(value, { name, min, max, defaultValue }) {
    if (value === undefined || value === null || value === '') return defaultValue;
    const n = Number(value);
    if (!Number.isInteger(n)) {
        const err = new Error(`Invalid ${name}`);
        err.statusCode = 400;
        throw err;
    }
    if (n < min || n > max) {
        const err = new Error(`Invalid ${name}`);
        err.statusCode = 400;
        throw err;
    }
    return n;
}

async function getDiskUsageBreakdown({ mount = '/', depth = 1, limit = 12, execFileFn = cp.execFile } = {}) {
    const resolvedMount = String(mount || '/');
    const mountErr = validateDiskBreakdownMount(resolvedMount);
    if (mountErr) throw mountErr;

    const maxDepth = parseBoundedInt(depth, { name: 'depth', min: 1, max: 3, defaultValue: 1 });
    const maxLimit = parseBoundedInt(limit, { name: 'limit', min: 1, max: 50, defaultValue: 12 });

    const cacheKey = JSON.stringify([resolvedMount, maxDepth, maxLimit]);

    const cached = diskBreakdownCache.get(cacheKey);
    if (cached && (Date.now() - cached.at) < DISK_BREAKDOWN_CACHE_TTL_MS) return cached.value;

    // Coalesce concurrent identical requests to avoid spawning du repeatedly.
    const pending = diskBreakdownPending.get(cacheKey);
    if (pending) return await pending;

    const promise = (async () => {
        const excludeArgs = getDuExcludeArgs(resolvedMount);

        const duArgs = [
            '-x',
            '-B1',
            `--max-depth=${maxDepth}`,
            ...excludeArgs,
            '--',
            resolvedMount
        ];

        const stdout = await new Promise((resolve, reject) => {
            // Root scans can still be slow on busy hosts. Increase timeout to 45s.
            execFileFn('du', duArgs, { timeout: 45_000, maxBuffer: 10 * 1024 * 1024 }, (err, out) => {
                if (err) return reject(err);
                resolve(out);
            });
        });

        let items = parseDuBytesOutput(stdout);

        // Remove the mount itself so the UI shows subpaths only.
        items = items.filter(i => i.path !== resolvedMount);

        // Sort by bytes desc and clamp.
        items.sort((a, b) => b.bytes - a.bytes);
        items = items.slice(0, maxLimit);

        const result = {
            mount: resolvedMount,
            depth: maxDepth,
            limit: maxLimit,
            entries: items.map(i => ({
                path: i.path,
                bytes: i.bytes,
                formatted: formatBytes(i.bytes)
            })),
            timestamp: new Date().toISOString(),
            note: 'Directory breakdown is shallow (maxDepth) and same-filesystem only (-x) to keep it fast.'
        };

        diskBreakdownCache.set(cacheKey, { at: Date.now(), value: result });
        return result;
    })();

    diskBreakdownPending.set(cacheKey, promise);

    try {
        return await promise;
    } finally {
        diskBreakdownPending.delete(cacheKey);
    }
}

// API: Get Disk usage breakdown (default: /). For safety, only '/' is supported.
app.get('/api/disk/breakdown', async (req, res) => {
    try {
        const mount = typeof req.query.mount === 'string' ? req.query.mount : '/';
        const depth = req.query.depth;
        const limit = req.query.limit;

        const payload = await getDiskUsageBreakdown({ mount, depth, limit });
        res.json(payload);
    } catch (error) {
        const status = Number(error?.statusCode) || 500;

        // Do not leak raw filesystem errors to clients.
        if (status !== 500) {
            return res.status(status).json({ error: error.message || 'Invalid request' });
        }

        // Timeout/kill
        if (error?.killed || error?.signal === 'SIGTERM' || error?.signal === 'SIGKILL') {
            return res.status(504).json({ error: 'Disk breakdown timed out' });
        }

        console.error('Error getting disk breakdown:', error);
        res.status(500).json({ error: 'Failed to get disk breakdown' });
    }
});

// API: Get system information
app.get('/api/system', async (req, res) => {
    try {
        const [osInfo, system] = await Promise.all([
            si.osInfo(),
            si.system()
        ]);

        const systemInfo = {
            hostname: os.hostname(),
            platform: osInfo.platform,
            distro: osInfo.distro,
            release: osInfo.release,
            kernel: osInfo.kernel,
            arch: osInfo.arch,
            uptime: formatUptime(os.uptime()),
            uptimeSeconds: os.uptime(),
            manufacturer: system.manufacturer,
            model: system.model,
            // Server location - can be configured via env or detected
            location: process.env.SERVER_LOCATION || 'Local Server'
        };

        res.json(systemInfo);
    } catch (error) {
        console.error('Error getting system info:', error);
        res.status(500).json({ error: 'Failed to get system information' });
    }
});

// ===== Process helpers (Minecraft)
const DEFAULT_MC_PORT = Number(process.env.MC_PORT || 25565);

function getMinecraftListenHost() {
    // Default remains loopback-only for safety.
    // Override when the Minecraft server is bound to a different interface.
    return process.env.MC_LISTEN_HOST || process.env.MC_BIND_HOST || '127.0.0.1';
}

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

async function isPortListening(port = DEFAULT_MC_PORT, host, SocketCtor = net.Socket) {
    const resolvedHost = host || getMinecraftListenHost();

    // Portable check: attempt a TCP connection.
    // Note: this only confirms a listener is accepting connections on that host/port.
    return await new Promise((resolve) => {
        const socket = new SocketCtor();
        const timeoutMs = 350;

        const done = (ok) => {
            try { socket.destroy(); } catch { /* ignore */ }
            resolve(ok);
        };

        socket.setTimeout(timeoutMs);
        socket.once('connect', () => done(true));
        socket.once('timeout', () => done(false));
        socket.once('error', () => done(false));

        try {
            socket.connect(port, resolvedHost);
        } catch {
            done(false);
        }
    });
}

function tailFile(filePath, lines = 120) {
    try {
        if (!filePath) return null;
        if (!fs.existsSync(filePath)) return null;
        const out = cp.execFileSync('sh', ['-lc', `tail -n ${Number(lines)} ${JSON.stringify(filePath)}`], {
            encoding: 'utf8'
        });
        return out;
    } catch {
        return null;
    }
}

// Helper to run shell command (detached/spawn). IMPORTANT:
// - A detached process can still fail shortly after start.
// - For services like Minecraft, you should verify it actually started (e.g. port listening).
const runCommandDetached = (command) => {
    return new Promise((resolve, reject) => {
        const child = cp.spawn('sh', ['-c', command], {
            detached: true,
            stdio: 'ignore'
        });

        child.on('error', (err) => {
            console.error(`Spawn error: ${err}`);
            reject(err);
        });

        // Monitor for immediate failure (e.g., command not found, syntax error).
        // If it survives for a moment, we assume it started successfully as a background service.
        const STARTUP_CHECK_MS = 750;

        const timeoutId = setTimeout(() => {
            child.unref();
            resolve('Command started in background');
        }, STARTUP_CHECK_MS);

        child.on('exit', (code) => {
            clearTimeout(timeoutId);
            if (code !== 0) {
                reject(new Error(`Command failed immediately with exit code ${code}`));
            } else {
                resolve('Command completed successfully');
            }
        });
    });
};

// API: Get top processes by memory usage
app.get('/api/processes', async (req, res) => {
    try {
        const processes = await si.processes();
        const mem = await si.mem();

        // Sort by memory usage and take top 15
        const topProcesses = processes.list
            .filter(proc => proc.mem > 0)
            .sort((a, b) => b.mem - a.mem)
            .slice(0, 15)
            .map(proc => ({
                name: proc.name,
                pid: proc.pid,
                memoryBytes: proc.memVsz || proc.mem,
                memoryFormatted: formatBytes(proc.memVsz || 0),
                memoryPercent: Math.round(proc.mem * 100) / 100,
                cpu: Math.round(proc.cpu * 10) / 10,
                command: proc.command ? proc.command.substring(0, 50) : proc.name
            }));

        // Memory breakdown categories
        const memoryBreakdown = {
            total: formatBytes(mem.total),
            totalBytes: mem.total,
            used: formatBytes(mem.used),
            usedBytes: mem.used,
            free: formatBytes(mem.free),
            freeBytes: mem.free,
            active: formatBytes(mem.active),
            activeBytes: mem.active,
            available: formatBytes(mem.available),
            availableBytes: mem.available,
            buffers: formatBytes(mem.buffers || 0),
            buffersBytes: mem.buffers || 0,
            cached: formatBytes(mem.cached || 0),
            cachedBytes: mem.cached || 0,
            swapTotal: formatBytes(mem.swaptotal || 0),
            swapUsed: formatBytes(mem.swapused || 0),
            swapFree: formatBytes(mem.swapfree || 0)
        };

        // Check if Minecraft is running and get its PID (heuristics + port fallback)
        const mcProc = processes.list.find(p =>
            p.name.includes('java') && (p.command || '').includes('minecraft') ||
            p.name.includes('minecraft')
        );

        const port = Number(process.env.MC_PORT || DEFAULT_MC_PORT);
        const listeningPid = await getPidListeningOnPort(port);
        const minecraftPid = mcProc?.pid || listeningPid || null;

        res.json({
            breakdown: memoryBreakdown,
            processes: topProcesses,
            isMinecraftRunning: Boolean(mcProc) || Boolean(listeningPid),
            minecraftPid, // EXPOSE PID HERE
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error getting processes:', error);
        res.status(500).json({ error: 'Failed to get process information' });
    }
});

// ===== Kill allowlist (safety)
// By default, we only allow killing the detected Minecraft process (if any).
// Optionally allow additional PIDs or process matches via env.
function parseAllowedKillPids(raw) {
    if (!raw) return [];
    return String(raw)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => Number(s))
        .filter((n) => Number.isInteger(n) && n > 0);
}

function parseAllowedKillProcessMatch(raw) {
    if (!raw) return [];
    return String(raw)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
}

function isMinecraftProcess(p) {
    const name = (p?.name || '').toLowerCase();
    const cmd = (p?.command || '').toLowerCase();

    return (
        (name.includes('java') && cmd.includes('minecraft')) ||
        name.includes('minecraft') ||
        cmd.includes('/home/beto/minecraft_n')
    );
}

async function getPidListeningOnPort(port) {
    const p = Number(port);
    if (!Number.isInteger(p) || p <= 0) return null;

    // Prefer lsof if available.
    // Example: lsof -nP -iTCP:25565 -sTCP:LISTEN -t
    const lsofCmd = `lsof -nP -iTCP:${p} -sTCP:LISTEN -t`;

    const execCmd = (cmd) => new Promise((resolve, reject) => {
        cp.exec(cmd, { timeout: 2000 }, (err, stdout) => {
            if (err) return reject(err);
            resolve(String(stdout || '').trim());
        });
    });

    try {
        const out = await execCmd(lsofCmd);
        const first = String(out).split(/s+/).filter(Boolean)[0];
        const pid = Number(first);
        if (Number.isInteger(pid) && pid > 0) return pid;
    } catch {
        // fall through
    }

    // Fallback: ss (Linux)
    // Example line contains: users:(("java",pid=1234,fd=...))
    const ssCmd = `ss -ltnp '( sport = :${p} )'`;
    try {
        const out = await execCmd(ssCmd);
        const m = String(out).match(/pid=(d+)/);
        if (m) {
            const pid = Number(m[1]);
            if (Number.isInteger(pid) && pid > 0) return pid;
        }
    } catch {
        // ignore
    }

    return null;
}

function parseMinecraftProcessMatchers(raw) {
    // Optional override for Minecraft detection used by status/start verification.
    // Format: comma-separated substrings.
    // Example: MC_PROCESS_MATCH="java,minecraft,forge"
    if (!raw) return [];
    return String(raw)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
}

function detectMinecraftProcess(processList = []) {
    const matchers = parseMinecraftProcessMatchers(process.env.MC_PROCESS_MATCH);

    if (matchers.length > 0) {
        const mcProc = processList.find((p) => {
            const haystack = `${p?.name || ''} ${p?.command || ''}`.toLowerCase();
            return matchers.some((m) => haystack.includes(String(m).toLowerCase()));
        });

        return {
            matched: Boolean(mcProc),
            pid: mcProc ? mcProc.pid : null,
            reason: mcProc ? 'env:MC_PROCESS_MATCH' : 'env:MC_PROCESS_MATCH:no-match'
        };
    }

    const mcProc = processList.find(isMinecraftProcess);
    return {
        matched: Boolean(mcProc),
        pid: mcProc ? mcProc.pid : null,
        reason: mcProc ? 'default' : 'default:no-match'
    };
}


async function getDetectedMinecraftPid() {
    try {
        const processes = await si.processes();
        const mcProc = processes.list.find(isMinecraftProcess);
        if (mcProc?.pid) return mcProc.pid;
    } catch {
        // ignore
    }

    // Fallback: if port is listening but process list heuristics didn't match,
    // find the PID that owns the listening socket.
    try {
        const port = Number(process.env.MC_PORT || DEFAULT_MC_PORT);
        const pid = await getPidListeningOnPort(port);
        return pid || null;
    } catch {
        return null;
    }
}

async function isKillPidAllowed(pid) {
    // 1) Always allow the detected Minecraft PID (if found)
    const mcPid = await getDetectedMinecraftPid();
    if (mcPid && pid === mcPid) return { allowed: true, reason: 'minecraft' };

    // 2) Explicit allowlist PIDs
    const allowedPids = parseAllowedKillPids(process.env.ALLOWED_KILL_PIDS);
    if (allowedPids.includes(pid)) return { allowed: true, reason: 'env:ALLOWED_KILL_PIDS' };

    // 3) Optional allowlist by substring match (name/command)
    const matchers = parseAllowedKillProcessMatch(process.env.ALLOWED_KILL_PROCESS_MATCH);
    if (matchers.length > 0) {
        try {
            const processes = await si.processes();
            const proc = processes.list.find((p) => p?.pid === pid);
            const haystack = `${proc?.name || ''} ${(proc?.command || '')}`.toLowerCase();
            const ok = matchers.some((m) => haystack.includes(String(m).toLowerCase()));
            if (ok) return { allowed: true, reason: 'env:ALLOWED_KILL_PROCESS_MATCH' };
        } catch {
            // fall through
        }
    }

    return { allowed: false, reason: 'not-allowlisted' };
}

// API: Kill process by PID
app.post('/api/processes/:pid/kill', requireApiTokenIfConfigured, async (req, res) => {
    const pid = parseInt(req.params.pid);

    // Block invalid, 0, or negative PIDs (which target process groups)
    if (!pid || pid <= 0) {
        return res.status(400).json({ error: 'Invalid PID' });
    }

    try {
        const allow = await isKillPidAllowed(pid);
        if (!allow.allowed) {
            return res.status(403).json({ error: 'PID not allowed', pid });
        }

        process.kill(pid, 'SIGTERM');
        res.json({ success: true, message: `Process ${pid} termination signal sent` });
    } catch (error) {
        console.error(`Error killing process ${pid}:`, error);
        res.status(500).json({ error: `Failed to kill process: ${error.message}` });
    }
});

// API: Minecraft status
app.get('/api/services/minecraft/status', async (req, res) => {
    try {
        const processes = await si.processes();
        const port = Number(process.env.MC_PORT || DEFAULT_MC_PORT);
        const host = getMinecraftListenHost();
        const listening = await isPortListening(port, host);
        const proc = detectMinecraftProcess(processes.list);

        // Avoid false-positives: a port listener alone is not enough to claim "running".
        const running = Boolean(listening && proc.matched);

        // If we are listening but couldn't identify the process, try to resolve the PID via the socket owner.
        const listeningPid = listening && !proc.matched ? await getPidListeningOnPort(port) : null;

        res.json({
            success: true,
            running,
            listening,
            host,
            port,
            pid: proc.pid || listeningPid || null,
            processMatched: proc.matched,
            reasons: {
                running: running ? 'listening+process-match' : (!listening && proc.matched ? 'process-match-but-not-listening' : (listening ? 'listening-without-process-match' : 'not-listening')),
                process: proc.reason
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error getting Minecraft status:', error);
        res.status(500).json({ error: 'Failed to get Minecraft status' });
    }
});

// API: Start Minecraft Server (with verification)
app.post('/api/services/minecraft/start', requireApiTokenIfConfigured, async (req, res) => {
    const startCommand = process.env.MC_START_COMMAND || 'echo "MC_START_COMMAND not configured" >> /tmp/mc_start_log.txt';
    const port = Number(process.env.MC_PORT || DEFAULT_MC_PORT);
    const host = getMinecraftListenHost();
    const logPath = process.env.MC_LOG_PATH || '/home/beto/minecraft_n/server-start.log';

    try {
        // If already running, do nothing.
        const processes = await si.processes();
        const listening = await isPortListening(port, host);
        const proc = detectMinecraftProcess(processes.list);

        if (listening && proc.matched) {
            return res.json({
                success: true,
                message: `Minecraft already running (host ${host} port ${port} listening + process matched)`,
                running: true,
                listening,
                processMatched: true,
                pid: proc.pid
            });
        }

        console.log(`Starting Minecraft with command: ${startCommand}`);
        await runCommandDetached(startCommand);

        // Verify startup (don't lie)
        const maxWaitMs = Number(
            process.env.MC_START_VERIFY_TIMEOUT_MS ?? (process.env.NODE_ENV === 'test' ? 0 : 15000)
        );

        if (maxWaitMs > 0) {
            const intervalMs = 1000;
            const startedAt = Date.now();
            while ((Date.now() - startedAt) < maxWaitMs) {
                const nowListening = await isPortListening(port, host);
                if (nowListening) {
                    const nowProcs = await si.processes();
                    const nowProc = detectMinecraftProcess(nowProcs.list);
                    if (nowProc.matched) {
                        return res.json({
                            success: true,
                            message: `Minecraft started (host ${host} port ${port} listening + process matched)`,
                            running: true,
                            listening: true,
                            processMatched: true,
                            pid: nowProc.pid
                        });
                    }
                }
                await sleep(intervalMs);

            }

            const tail = tailFile(logPath, 120);
            const lastProcs = await si.processes().catch(() => ({ list: [] }));
            const lastProc = detectMinecraftProcess(lastProcs.list);

            return res.status(500).json({
                error: `Minecraft did not start (host ${host} port ${port} listening + process match) after ${maxWaitMs}ms`,
                host,
                port,
                listening: false,
                processMatched: lastProc.matched,
                pid: lastProc.pid,
                reasons: { process: lastProc.reason },
                logTail: tail
            });
        }

        return res.json({ success: true, message: 'Minecraft start command executed' });
    } catch (error) {
        console.error('Error starting Minecraft:', error);
        const tail = tailFile(process.env.MC_LOG_PATH || '/home/beto/minecraft_n/server-start.log', 120);
        res.status(500).json({ error: `Failed to start Minecraft: ${error.message}`, logTail: tail });
    }
});

// API: Restart Minecraft Server
app.post('/api/services/minecraft/restart', requireApiTokenIfConfigured, async (req, res) => {
    try {
        // 1. Find and kill
        const processes = await si.processes();
        const mcProcs = processes.list.filter(p =>
            (p.name.includes('java') && (p.command || '').includes('minecraft')) ||
            p.name.includes('minecraft')
        );

        for (const proc of mcProcs) {
            try {
                process.kill(proc.pid, 'SIGKILL');
            } catch (e) { /* ignore */ }
        }

        // 2. Wait and Start
        setTimeout(async () => {
            const startCommand = process.env.MC_START_COMMAND || 'echo "MC_START_COMMAND not configured"';
            await runCommandDetached(startCommand).catch(err => console.error('Restart-Start error:', err));
        }, 2000);

        res.json({ success: true, message: 'Minecraft restart sequence initiated' });
    } catch (error) {
        console.error('Error restarting Minecraft:', error);
        res.status(500).json({ error: 'Failed to restart Minecraft' });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve frontend for all other routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`🚀 VPS Dashboard running at http://localhost:${PORT}`);
    });
}

// Export for testing
module.exports = {
    app,
    formatBytes,
    formatUptime,
    monthKey,
    updateMonthlyBandwidth,
    // Exported for testing
    getMinecraftListenHost,
    isPortListening,
    getPidListeningOnPort,
    detectMinecraftProcess,
    parseMinecraftProcessMatchers,
    isMinecraftProcess,
    // Disk breakdown (exported for testing)
    parseDuBytesOutput,
    getDiskUsageBreakdown
};
