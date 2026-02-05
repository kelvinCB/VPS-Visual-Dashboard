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
app.use(express.static(path.join(__dirname, 'public')));

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

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

async function isPortListening(port = DEFAULT_MC_PORT, host = '127.0.0.1') {
    // Portable check: attempt a TCP connection.
    // Note: this only confirms a listener is accepting connections on that host/port.
    return await new Promise((resolve) => {
        const socket = new net.Socket();
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
            socket.connect(port, host);
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

        // Check if Minecraft is running and get its PID
        const mcProc = processes.list.find(p =>
            p.name.includes('java') && (p.command || '').includes('minecraft') ||
            p.name.includes('minecraft')
        );

        res.json({
            breakdown: memoryBreakdown,
            processes: topProcesses,
            isMinecraftRunning: !!mcProc,
            minecraftPid: mcProc ? mcProc.pid : null, // EXPOSE PID HERE
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error getting processes:', error);
        res.status(500).json({ error: 'Failed to get process information' });
    }
});

// API: Kill process by PID
app.post('/api/processes/:pid/kill', requireApiTokenIfConfigured, async (req, res) => {
    const pid = parseInt(req.params.pid);

    // Block invalid, 0, or negative PIDs (which target process groups)
    if (!pid || pid <= 0) {
        return res.status(400).json({ error: 'Invalid PID' });
    }

    try {
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
        const mcProc = processes.list.find(p =>
            (p.name.includes('java') && (p.command || '').includes('minecraft')) ||
            p.name.includes('minecraft') ||
            (p.command || '').includes('/home/beto/minecraft_n')
        );

        const port = Number(process.env.MC_PORT || DEFAULT_MC_PORT);
        const listening = await isPortListening(port);

        res.json({
            success: true,
            running: Boolean(mcProc) || listening,
            listening,
            port,
            pid: mcProc ? mcProc.pid : null,
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
    const logPath = process.env.MC_LOG_PATH || '/home/beto/minecraft_n/server-start.log';

    try {
        // If already running, do nothing.
        if (await isPortListening(port)) {
            return res.json({ success: true, message: `Minecraft already running (port ${port} listening)` });
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
                if (await isPortListening(port)) {
                    return res.json({ success: true, message: `Minecraft started (port ${port} listening)` });
                }
                await sleep(intervalMs);
            }

            const tail = tailFile(logPath, 120);
            return res.status(500).json({
                error: `Minecraft did not start (port ${port} not listening after ${maxWaitMs}ms)`,
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
module.exports = { app, formatBytes, formatUptime, monthKey, updateMonthlyBandwidth };
