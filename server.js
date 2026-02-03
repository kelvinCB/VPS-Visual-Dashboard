const express = require('express');
const cors = require('cors');
const path = require('path');
const os = require('os');
const si = require('systeminformation');

const app = express();
const PORT = process.env.PORT || 7847;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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
                txFormatted: formatBytes(primaryNetwork.tx_bytes || 0)
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

// API: Get top processes by memory usage
app.get('/api/processes', async (req, res) => {
    try {
        const processes = await si.processes();
        const mem = await si.mem();

        // Sort by memory usage and take top 15
        const topProcesses = processes.list
            .sort((a, b) => b.memRss - a.memRss)
            .slice(0, 15)
            .map(proc => ({
                name: proc.name,
                pid: proc.pid,
                memoryBytes: proc.memRss,
                memoryFormatted: formatBytes(proc.memRss),
                memoryPercent: Math.round((proc.memRss / mem.total) * 100 * 100) / 100,
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

        res.json({
            breakdown: memoryBreakdown,
            processes: topProcesses,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error getting processes:', error);
        res.status(500).json({ error: 'Failed to get process information' });
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
module.exports = { app, formatBytes, formatUptime };
