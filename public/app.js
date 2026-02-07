/**
 * VPS Dashboard - Frontend Application
 * Handles metrics fetching, chart rendering, and UI updates
 */

// ===== Configuration =====
// Runtime config can be injected via `public/index.html` (window.CONFIG) without hardcoding secrets.
const RUNTIME_CONFIG = (typeof window !== 'undefined' && window.CONFIG && typeof window.CONFIG === 'object')
    ? window.CONFIG
    : {};

const CONFIG = {
    API_BASE: '',
    REFRESH_INTERVAL: 25000, // 25 seconds
    DISK_REFRESH_INTERVAL: 150000, // 150 seconds (2.5 minutes)
    CHART_HISTORY_LENGTH: 20,
    CHART_COLORS: {
        cpu: { line: '#7c3aed', fill: 'rgba(124, 58, 237, 0.15)' },
        memory: { line: '#f97316', fill: 'rgba(249, 115, 22, 0.15)' },
        trafficIn: { line: '#22c55e', fill: 'rgba(34, 197, 94, 0.15)' },
        trafficOut: { line: '#3b82f6', fill: 'rgba(59, 130, 246, 0.15)' }
    },
    // Optional. Used only for sensitive endpoints.
    // Prefer server-injected config; allow localStorage override for convenience.
    API_TOKEN: RUNTIME_CONFIG.API_TOKEN
};

function getApiToken() {
    try {
        const override = localStorage.getItem('apiToken');
        if (override && String(override).trim()) return String(override).trim();
    } catch {
        // ignore
    }

    return CONFIG.API_TOKEN;
}

function getAuthHeaders() {
    const token = getApiToken();
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
}


// ===== State =====
const state = {
    cpuHistory: [],
    memoryHistory: [],
    trafficInHistory: [],
    trafficOutHistory: [],
    isLoading: false,
    lastError: null
};

// ===== DOM Elements =====
const elements = {
    // System Info
    osInfo: document.getElementById('os-info'),
    hostname: document.getElementById('hostname'),
    uptime: document.getElementById('uptime'),
    location: document.getElementById('location'),
    kernelInfo: document.getElementById('kernel-info'),
    archInfo: document.getElementById('arch-info'),
    coresInfo: document.getElementById('cores-info'),

    // Metrics
    cpuValue: document.getElementById('cpu-value'),
    memoryValue: document.getElementById('memory-value'),
    memoryDetail: document.getElementById('memory-detail'),
    diskValue: document.getElementById('disk-value'),
    diskDetail: document.getElementById('disk-detail'),
    trafficInValue: document.getElementById('traffic-in-value'),
    trafficInUnit: document.getElementById('traffic-in-unit'),
    trafficOutValue: document.getElementById('traffic-out-value'),
    trafficOutUnit: document.getElementById('traffic-out-unit'),
    bandwidthValue: document.getElementById('bandwidth-value'),
    bandwidthUnit: document.getElementById('bandwidth-unit'),
    bandwidthDetail: document.getElementById('bandwidth-detail'),
    bandwidthHint: document.getElementById('bandwidth-hint'),

    // Charts
    cpuChart: document.getElementById('cpu-chart'),
    memoryChart: document.getElementById('memory-chart'),
    diskChart: document.getElementById('disk-chart'),
    trafficInChart: document.getElementById('traffic-in-chart'),
    trafficOutChart: document.getElementById('traffic-out-chart'),
    bandwidthChart: document.getElementById('bandwidth-chart'),

    // Controls
    refreshBtn: document.getElementById('refresh-btn'),
    statusBadge: document.getElementById('status-badge'),
    lastUpdated: document.getElementById('last-updated'),

    // Theme
    themeToggle: document.getElementById('theme-toggle'),
    themeLabel: document.getElementById('theme-label')
};

// ===== Theme & Utilities =====
function getCssVar(name, fallback = '') {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name);
    return (value && value.trim()) || fallback;
}

function applyTheme(theme) {
    const normalized = theme === 'light' ? 'light' : 'dark';
    document.documentElement.dataset.theme = normalized;

    if (elements.themeLabel) {
        elements.themeLabel.textContent = normalized === 'light' ? 'Light' : 'Dark';
    }

    if (elements.themeToggle) {
        const next = normalized === 'light' ? 'dark' : 'light';
        elements.themeToggle.setAttribute(
            'aria-label',
            `Switch to ${next} mode`
        );
    }

    try {
        localStorage.setItem('theme', normalized);
    } catch {
        // Ignore storage errors (private mode, etc.)
    }
}

function initTheme() {
    let theme = 'dark';

    try {
        const stored = localStorage.getItem('theme');
        if (stored === 'light' || stored === 'dark') theme = stored;
    } catch {
        // Ignore storage errors
    }

    applyTheme(theme);

    if (elements.themeToggle) {
        elements.themeToggle.addEventListener('click', () => {
            const current = document.documentElement.dataset.theme || 'dark';
            applyTheme(current === 'light' ? 'dark' : 'light');
        });
    }
}

// ===== API Functions =====
async function fetchMetrics() {
    try {
        const response = await fetch(`${CONFIG.API_BASE}/api/metrics`);
        if (!response.ok) throw new Error('Failed to fetch metrics');
        return await response.json();
    } catch (error) {
        console.error('Error fetching metrics:', error);
        throw error;
    }
}

async function fetchSystemInfo() {
    try {
        const response = await fetch(`${CONFIG.API_BASE}/api/system`);
        if (!response.ok) throw new Error('Failed to fetch system info');
        return await response.json();
    } catch (error) {
        console.error('Error fetching system info:', error);
        throw error;
    }
}

// ===== Chart Drawing Functions =====
function drawLineChart(canvas, data, color, maxValue = 100) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const padding = 2;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    if (data.length < 2) return;

    // Calculate points
    const stepX = (width - padding * 2) / (CONFIG.CHART_HISTORY_LENGTH - 1);
    const points = data.map((value, index) => ({
        x: padding + index * stepX,
        y: height - padding - (value / maxValue) * (height - padding * 2)
    }));

    // Draw gradient fill
    ctx.beginPath();
    ctx.moveTo(points[0].x, height - padding);
    points.forEach(point => ctx.lineTo(point.x, point.y));
    ctx.lineTo(points[points.length - 1].x, height - padding);
    ctx.closePath();

    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, color.fill);
    gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw line
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    // Smooth curve using bezier
    for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1];
        const curr = points[i];
        const cpX = (prev.x + curr.x) / 2;
        ctx.quadraticCurveTo(prev.x, prev.y, cpX, (prev.y + curr.y) / 2);
    }
    ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);

    ctx.strokeStyle = color.line;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
}

function drawCircularChart(canvas, percentage, color = '#7c3aed') {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 2 - 8;
    const lineWidth = 10;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Background circle
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.strokeStyle = getCssVar('--chart-track', 'rgba(255, 255, 255, 0.1)');
    ctx.lineWidth = lineWidth;
    ctx.stroke();

    // Progress arc
    const startAngle = -Math.PI / 2;
    const endAngle = startAngle + (percentage / 100) * Math.PI * 2;

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, startAngle, endAngle);

    // Gradient for progress
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#7c3aed');
    gradient.addColorStop(1, '#a855f7');
    ctx.strokeStyle = gradient;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.stroke();
}

// ===== UI Update Functions =====
function updateMetricsUI(metrics) {
    // CPU
    elements.cpuValue.textContent = metrics.cpu.usage.toFixed(1);
    state.cpuHistory.push(metrics.cpu.usage);
    if (state.cpuHistory.length > CONFIG.CHART_HISTORY_LENGTH) {
        state.cpuHistory.shift();
    }
    drawLineChart(elements.cpuChart, state.cpuHistory, CONFIG.CHART_COLORS.cpu);

    // Memory
    elements.memoryValue.textContent = metrics.memory.usage.toFixed(1);
    elements.memoryDetail.textContent = `${metrics.memory.used} / ${metrics.memory.total}`;
    state.memoryHistory.push(metrics.memory.usage);
    if (state.memoryHistory.length > CONFIG.CHART_HISTORY_LENGTH) {
        state.memoryHistory.shift();
    }
    drawLineChart(elements.memoryChart, state.memoryHistory, CONFIG.CHART_COLORS.memory);

    // Disk
    elements.diskValue.textContent = Math.round(metrics.disk.usage);
    elements.diskDetail.textContent = `${metrics.disk.used} / ${metrics.disk.total}`;
    drawCircularChart(elements.diskChart, metrics.disk.usage);

    // Network Traffic
    const { value: rxValue, unit: rxUnit } = formatTrafficValue(metrics.network.rxBytes);
    const { value: txValue, unit: txUnit } = formatTrafficValue(metrics.network.txBytes);

    elements.trafficInValue.textContent = rxValue;
    elements.trafficInUnit.textContent = rxUnit;
    elements.trafficOutValue.textContent = txValue;
    elements.trafficOutUnit.textContent = txUnit;

    // Traffic history (normalize to MB for chart)
    const rxMB = metrics.network.rxBytes / (1024 * 1024);
    const txMB = metrics.network.txBytes / (1024 * 1024);

    state.trafficInHistory.push(rxMB);
    state.trafficOutHistory.push(txMB);

    if (state.trafficInHistory.length > CONFIG.CHART_HISTORY_LENGTH) {
        state.trafficInHistory.shift();
    }
    if (state.trafficOutHistory.length > CONFIG.CHART_HISTORY_LENGTH) {
        state.trafficOutHistory.shift();
    }

    const maxTrafficIn = Math.max(...state.trafficInHistory, 1);
    const maxTrafficOut = Math.max(...state.trafficOutHistory, 1);

    drawLineChart(elements.trafficInChart, state.trafficInHistory, CONFIG.CHART_COLORS.trafficIn, maxTrafficIn);
    drawLineChart(elements.trafficOutChart, state.trafficOutHistory, CONFIG.CHART_COLORS.trafficOut, maxTrafficOut);

    // Bandwidth (monthly, persisted server-side)
    const monthBytes = metrics.network.monthBytes ?? (metrics.network.rxBytes + metrics.network.txBytes);
    const { value: bwValue, unit: bwUnit } = formatTrafficValue(monthBytes);
    elements.bandwidthValue.textContent = bwValue;
    elements.bandwidthUnit.textContent = bwUnit;

    if (elements.bandwidthDetail) {
        elements.bandwidthDetail.textContent = metrics.network.month
            ? `Month-to-date (${metrics.network.month})`
            : 'Month-to-date';
    }

    // Monthly bandwidth cap (client-side configurable)
    let capGb = null;
    try {
        const stored = localStorage.getItem('monthlyBandwidthCapGb');
        if (stored) capGb = Number(stored);
        if (capGb && capGb > 0) {
            const capBytes = capGb * 1024 * 1024 * 1024;
            const pct = Math.min((monthBytes / capBytes) * 100, 100);
            drawCircularChart(elements.bandwidthChart, pct);
            if (elements.bandwidthHint) elements.bandwidthHint.textContent = `${Math.round(pct)}% of ${capGb}GB limit`;
        } else {
            // Unknown cap → show neutral ring
            drawCircularChart(elements.bandwidthChart, 0);
            if (elements.bandwidthHint) elements.bandwidthHint.textContent = 'Click to set monthly limit';
        }
    } catch {
        drawCircularChart(elements.bandwidthChart, 0);
    }

    // Update cores info
    if (metrics.cpu.cores) {
        elements.coresInfo.textContent = metrics.cpu.cores;
    }
}

function updateSystemInfoUI(info) {
    elements.osInfo.textContent = `${info.distro} ${info.release}`;
    elements.hostname.textContent = info.hostname;
    elements.uptime.textContent = info.uptime;
    elements.location.textContent = info.location;
    elements.kernelInfo.textContent = info.kernel || 'N/A';
    elements.archInfo.textContent = info.arch || 'N/A';
}

function updateLastUpdated() {
    const now = new Date();
    elements.lastUpdated.textContent = now.toLocaleTimeString();
}

// ===== Helper Functions =====
function formatTrafficValue(bytes) {
    if (bytes === 0) return { value: '0', unit: 'B' };

    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const value = parseFloat((bytes / Math.pow(k, i)).toFixed(1));

    return { value: value.toString(), unit: units[i] };
}

function setLoadingState(isLoading) {
    state.isLoading = isLoading;
    if (isLoading) {
        elements.refreshBtn.classList.add('spinning');
    } else {
        elements.refreshBtn.classList.remove('spinning');
    }
}

function showError(message) {
    state.lastError = message;
    console.error(message);
    // Could add visual error indicator here
}

// ===== Main Functions =====
async function refreshData() {
    if (state.isLoading) return;

    setLoadingState(true);

    try {
        const [metrics, systemInfo] = await Promise.all([
            fetchMetrics(),
            fetchSystemInfo()
        ]);

        updateMetricsUI(metrics);
        updateSystemInfoUI(systemInfo);
        updateLastUpdated();
        state.lastError = null;
    } catch (error) {
        showError('Failed to fetch data');
    } finally {
        setLoadingState(false);
    }
}

async function refreshMetricsOnly() {
    if (state.isLoading) return;

    setLoadingState(true);

    try {
        const metrics = await fetchMetrics();
        updateMetricsUI(metrics);
        updateLastUpdated();
    } catch (error) {
        showError('Failed to fetch metrics');
    } finally {
        setLoadingState(false);
    }
}

// ===== Modal Functions =====
const modalElements = {
    overlay: document.getElementById('memory-modal'),
    closeBtn: document.getElementById('modal-close'),
    memoryCard: document.getElementById('memory-card'),
    memTotal: document.getElementById('mem-total'),
    memUsed: document.getElementById('mem-used'),
    memFree: document.getElementById('mem-free'),
    memAvailable: document.getElementById('mem-available'),
    memBuffers: document.getElementById('mem-buffers'),
    memCached: document.getElementById('mem-cached'),
    memSwap: document.getElementById('mem-swap'),
    processesTbody: document.getElementById('processes-tbody')
};

async function fetchProcesses() {
    try {
        const response = await fetch(`${CONFIG.API_BASE}/api/processes`);
        if (!response.ok) throw new Error('Failed to fetch processes');
        return await response.json();
    } catch (error) {
        console.error('Error fetching processes:', error);
        throw error;
    }
}

// Shared HTML escaping helper for modal tables
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// CPU Details Modal
const cpuModalElements = {
    overlay: document.getElementById('cpu-modal'),
    closeBtn: document.getElementById('cpu-modal-close'),
    cpuCard: document.getElementById('cpu-card'),
    overall: document.getElementById('cpu-overall'),
    cores: document.getElementById('cpu-cores'),
    load1m: document.getElementById('cpu-load-1m'),
    load5m: document.getElementById('cpu-load-5m'),
    load15m: document.getElementById('cpu-load-15m'),
    chart: document.getElementById('cpu-modal-chart'),
    processesTbody: document.getElementById('cpu-processes-tbody')
};

let cpuModalLastFocus = null;

async function fetchCpuDetails() {
    try {
        const response = await fetch(`${CONFIG.API_BASE}/api/cpu/details`);
        if (!response.ok) throw new Error('Failed to fetch CPU details');
        return await response.json();
    } catch (error) {
        console.error('Error fetching CPU details:', error);
        throw error;
    }
}

function closeCpuModal() {
    cpuModalElements.overlay?.classList.remove('active');

    try {
        const toFocus = cpuModalLastFocus || cpuModalElements.cpuCard;
        toFocus?.focus?.();
    } catch {
        // ignore
    } finally {
        cpuModalLastFocus = null;
    }
}

function sizeChartCanvas(canvas, heightCssPx = 90) {
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const cssWidth = canvas.parentElement?.clientWidth || canvas.clientWidth || canvas.width || 560;

    canvas.style.width = '100%';
    canvas.style.height = `${heightCssPx}px`;
    canvas.width = Math.max(1, Math.floor(cssWidth * dpr));
    canvas.height = Math.max(1, Math.floor(heightCssPx * dpr));

    const ctx = canvas.getContext('2d');
    if (ctx) ctx.setTransform(1, 0, 0, 1, 0, 0);
}

async function openCpuModal() {
    if (!cpuModalElements.overlay) return;

    cpuModalLastFocus = document.activeElement;
    cpuModalElements.overlay.classList.add('active');

    cpuModalElements.closeBtn?.focus?.();
    if (cpuModalElements.processesTbody) {
        cpuModalElements.processesTbody.innerHTML = '<tr><td colspan="4">Loading...</td></tr>';
    }

    try {
        const data = await fetchCpuDetails();

        if (cpuModalElements.overall) cpuModalElements.overall.textContent = `${data.breakdown.overall}%`;
        if (cpuModalElements.cores) cpuModalElements.cores.textContent = String(data.breakdown.cores);
        if (cpuModalElements.load1m) cpuModalElements.load1m.textContent = String(data.breakdown.loadAvg1m);
        if (cpuModalElements.load5m) cpuModalElements.load5m.textContent = String(data.breakdown.loadAvg5m);
        if (cpuModalElements.load15m) cpuModalElements.load15m.textContent = String(data.breakdown.loadAvg15m);

        if (cpuModalElements.chart) {
            sizeChartCanvas(cpuModalElements.chart, 90);
            drawLineChart(cpuModalElements.chart, state.cpuHistory, CONFIG.CHART_COLORS.cpu);
        }

        if (cpuModalElements.processesTbody) {
            cpuModalElements.processesTbody.innerHTML = (data.topProcesses || [])
                .map(proc => `
                    <tr>
                        <td>${escapeHtml(proc.name)}</td>
                        <td>${proc.pid}</td>
                        <td>${proc.cpu}</td>
                        <td>${proc.mem}</td>
                    </tr>
                `)
                .join('') || '<tr><td colspan="4">No data</td></tr>';
        }
    } catch (error) {
        console.error(error);
        if (cpuModalElements.processesTbody) {
            cpuModalElements.processesTbody.innerHTML = '<tr><td colspan="4">Error loading data</td></tr>';
        }
    }
}

// Disk Details Modal
const diskModalElements = {
    overlay: document.getElementById('disk-modal'),
    closeBtn: document.getElementById('disk-modal-close'),
    diskCard: document.getElementById('disk-card'),
    filesystemsTbody: document.getElementById('disk-filesystems-tbody'),
    note: document.getElementById('disk-note'),
    breakdownBtn: document.getElementById('disk-breakdown-btn'),
    breakdownList: document.getElementById('disk-breakdown-list'),
    breakdownStatus: document.getElementById('disk-breakdown-status')
};

let diskModalLastFocus = null;

async function fetchDiskDetails() {
    try {
        const response = await fetch(`${CONFIG.API_BASE}/api/disk/details`);
        if (!response.ok) throw new Error('Failed to fetch disk details');
        return await response.json();
    } catch (error) {
        console.error('Error fetching disk details:', error);
        throw error;
    }
}

async function fetchDiskBreakdown({ mount = '/', depth = 1, limit = 12, signal } = {}) {
    const params = new URLSearchParams({ mount, depth: String(depth), limit: String(limit) });
    const response = await fetch(`${CONFIG.API_BASE}/api/disk/breakdown?${params.toString()}`, { signal });

    if (!response.ok) {
        const errPayload = await safeParseJsonResponse(response).catch(() => null);
        const msg = errPayload?.error || `Failed to fetch disk breakdown (HTTP ${response.status})`;
        throw new Error(msg);
    }

    return await response.json();
}

function closeDiskModal() {
    // Stop any in-flight scan to avoid background work + stale UI updates.
    try { diskBreakdownController?.abort(); } catch { /* ignore */ }
    diskBreakdownController = null;
    diskBreakdownLastPromise = null;

    if (diskModalElements.breakdownBtn) diskModalElements.breakdownBtn.disabled = false;

    diskModalElements.overlay?.classList.remove('active');

    try {
        const toFocus = diskModalLastFocus || diskModalElements.diskCard;
        toFocus?.focus?.();
    } catch {
        // ignore
    } finally {
        diskModalLastFocus = null;
    }
}

async function openDiskModal() {
    if (!diskModalElements.overlay) return;

    diskModalLastFocus = document.activeElement;
    diskModalElements.overlay.classList.add('active');

    diskModalElements.closeBtn?.focus?.();

    if (diskModalElements.filesystemsTbody) {
        diskModalElements.filesystemsTbody.innerHTML = '<tr><td colspan="5">Loading...</td></tr>';
    }

    if (diskModalElements.breakdownStatus) diskModalElements.breakdownStatus.textContent = '';
    if (diskModalElements.breakdownList) diskModalElements.breakdownList.innerHTML = '';

    try {
        const data = await fetchDiskDetails();

        if (diskModalElements.note) {
            diskModalElements.note.textContent = data.note || '';
        }

        if (diskModalElements.filesystemsTbody) {
            diskModalElements.filesystemsTbody.innerHTML = (data.filesystems || [])
                .map(fs => `
                    <tr>
                        <td>${escapeHtml(fs.mount || fs.fs || '-')}</td>
                        <td>${escapeHtml(fs.size)}</td>
                        <td>${escapeHtml(fs.used)}</td>
                        <td>${escapeHtml(fs.avail)}</td>
                        <td>${escapeHtml(fs.usePercent)}%</td>
                    </tr>
                `)
                .join('') || '<tr><td colspan="5">No data</td></tr>';
        }
    } catch (error) {
        console.error(error);
        if (diskModalElements.filesystemsTbody) {
            diskModalElements.filesystemsTbody.innerHTML = '<tr><td colspan="5">Error loading data</td></tr>';
        }
    }
}

let diskBreakdownController = null;
let diskBreakdownLastPromise = null;

async function loadDiskBreakdown(mount = '/') {
    if (!diskModalElements.breakdownStatus || !diskModalElements.breakdownList) return;

    // Abort any in-flight scan.
    try { diskBreakdownController?.abort(); } catch { /* ignore */ }
    diskBreakdownController = new AbortController();

    if (diskModalElements.breakdownBtn) diskModalElements.breakdownBtn.disabled = true;

    diskModalElements.breakdownStatus.textContent = 'Scanning...';
    diskModalElements.breakdownList.innerHTML = '';

    try {
        const promise = fetchDiskBreakdown({ mount, depth: 1, limit: 12, signal: diskBreakdownController.signal });
        diskBreakdownLastPromise = promise;
        const data = await promise;

        // Race guard: only render latest request.
        if (diskBreakdownLastPromise !== promise) return;

        const entries = Array.isArray(data.entries) ? data.entries : [];

        diskModalElements.breakdownStatus.textContent = entries.length
            ? `Top paths for ${data.mount} (depth ${data.depth}) — cached`
            : 'No data.';

        // DOM-based rendering (no innerHTML) to avoid XSS.
        for (const e of entries) {
            const li = document.createElement('li');
            const code = document.createElement('code');
            code.textContent = String(e.path || '');
            li.appendChild(code);
            li.appendChild(document.createTextNode(' — ' + String(e.formatted || '')));
            diskModalElements.breakdownList.appendChild(li);
        }
    } catch (err) {
        if (err?.name === 'AbortError') return;
        console.error(err);
        diskModalElements.breakdownStatus.textContent = 'Error scanning disk breakdown.';
    } finally {
        if (diskModalElements.breakdownBtn) diskModalElements.breakdownBtn.disabled = false;
    }
}

async function openMemoryModal() {
    modalElements.overlay.classList.add('active');
    modalElements.processesTbody.innerHTML = '<tr><td colspan="5">Loading...</td></tr>';

    try {
        const data = await fetchProcesses();

        // Update breakdown
        modalElements.memTotal.textContent = data.breakdown.total;
        modalElements.memUsed.textContent = data.breakdown.used;
        modalElements.memFree.textContent = data.breakdown.free;
        modalElements.memAvailable.textContent = data.breakdown.available;
        modalElements.memBuffers.textContent = data.breakdown.buffers;
        modalElements.memCached.textContent = data.breakdown.cached;
        modalElements.memSwap.textContent = data.breakdown.swapUsed;

        // Update processes table

        // Helper to escape HTML for attributes
        const escapeHtml = (str) => {
            if (!str) return '';
            return str
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        };

        modalElements.processesTbody.innerHTML = data.processes
            .map(proc => {
                const isHighMem = proc.memoryPercent > 20;
                let actions = '';
                const safeName = escapeHtml(proc.name);

                if (isHighMem) {
                    const isMinecraft = data.minecraftPid && proc.pid === data.minecraftPid;

                    if (isMinecraft) {
                        actions = `
                            <button class="btn-action btn-restart" data-action="restart" data-pid="${proc.pid}" data-name="${safeName}" title="Restart Minecraft Server">🔄</button>
                            <button class="btn-action btn-kill" data-action="kill" data-pid="${proc.pid}" data-name="${safeName}" title="Kill">💀</button>
                        `;
                    } else {
                        // Regular high mem process -> Kill only
                        actions = `
                            <button class="btn-action btn-kill" data-action="kill" data-pid="${proc.pid}" data-name="${safeName}" title="Kill">💀</button>
                        `;
                    }
                }

                return `
                <tr>
                    <td>${escapeHtml(proc.name)}</td>
                    <td>${proc.pid}</td>
                    <td>${proc.memoryFormatted}</td>
                    <td>${proc.memoryPercent}%</td>
                    <td>${actions}</td>
                </tr>
            `
            })
            .join('');

        // Show "Start Minecraft" button only when the server is actually stopped.
        // Using /api/services/minecraft/status avoids false positives/negatives from process heuristics.
        const statusRes = await fetch(`${CONFIG.API_BASE}/api/services/minecraft/status`);
        const status = await statusRes.json().catch(() => ({ running: false }));

        let startBtn = document.getElementById('btn-start-mc');
        if (!startBtn) {
            startBtn = document.createElement('button');
            startBtn.id = 'btn-start-mc';
            startBtn.className = 'btn-primary';
            startBtn.textContent = '▶️ Start Minecraft Server';
            startBtn.style.marginTop = '1rem';
            startBtn.style.width = '100%';
            startBtn.onclick = startMinecraft;
            document.querySelector('.modal-body').appendChild(startBtn);
        }

        // Default visibility based on actual server status.
        startBtn.style.display = status?.running ? 'none' : 'block';

        // Apply client-side starting UX state.
        if (mcStartState.starting) {
            startBtn.style.display = 'block';
            startBtn.disabled = true;
            startBtn.textContent = formatStartingLabel();
            scheduleMinecraftStartLoop();
        } else {
            startBtn.disabled = false;
            startBtn.textContent = mcStartState.timedOut ? '↻ Retry start' : '▶️ Start Minecraft Server';
        }

    } catch (error) {
        console.error(error);
        modalElements.processesTbody.innerHTML = '<tr><td colspan="5">Error loading data</td></tr>';
    }
}

// Action Handlers
async function handleKillProcess(pid, name) {
    if (!confirm(`Are you sure you want to KILL process "${name}" (PID: ${pid})?`)) return;

    try {
        const res = await fetch(`${CONFIG.API_BASE}/api/processes/${pid}/kill`, {
            method: 'POST',
            headers: { ...getAuthHeaders() }
        });
        const data = await res.json();

        if (data.success) {
            alert('Process killed successfully');
            openMemoryModal(); // Refresh
        } else {
            alert('Failed to kill process: ' + data.error);
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

async function handleRestartProcess(pid) {
    if (!confirm(`Restart Minecraft Server (PID: ${pid})? This will kill the process and attempt to start it again.`)) return;

    try {
        const res = await fetch(`${CONFIG.API_BASE}/api/services/minecraft/restart`, {
            method: 'POST',
            headers: { ...getAuthHeaders() }
        });
        const data = await res.json();
        if (data.success) {
            alert('Minecraft is restarting...');
            openMemoryModal(); // Refresh
        } else {
            alert('Failed: ' + data.error);
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

async function safeParseJsonResponse(res) {
    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    const text = await res.text();

    if (contentType.includes('application/json')) {
        try {
            return JSON.parse(text);
        } catch {
            return { ok: false, error: 'Invalid JSON response', raw: text };
        }
    }

    // Some upstream errors (e.g. nginx/502) return HTML.
    return { ok: false, error: `Non-JSON response (HTTP ${res.status})`, raw: text };
}

// ===== Minecraft start UX (no manual refresh) =====
const MC_STARTING_REFRESH_MS = 5000;
const MC_STARTING_LABEL_TICK_MS = 1000;
const MC_STARTING_TIMEOUT_MS = 180000; // 3 minutes
const MC_STARTING_HINT = 'This can take up to 3 minutes';

const mcStartState = {
    starting: false,
    startedAt: 0,
    elapsedSec: 0,
    timedOut: false,
    statusTimer: null,
    labelTimer: null
};

function getMcStartBtn() {
    return document.getElementById('btn-start-mc');
}

function setMcStartButtonState({ visible, disabled, label } = {}) {
    const btn = getMcStartBtn();
    if (!btn) return;

    if (typeof visible === 'boolean') btn.style.display = visible ? 'block' : 'none';
    if (typeof disabled === 'boolean') btn.disabled = disabled;
    if (typeof label === 'string') btn.textContent = label;
}

function clearMcStartLoop() {
    if (mcStartState.statusTimer) {
        clearTimeout(mcStartState.statusTimer);
        mcStartState.statusTimer = null;
    }
    if (mcStartState.labelTimer) {
        clearTimeout(mcStartState.labelTimer);
        mcStartState.labelTimer = null;
    }
}

function markMcStarting() {
    mcStartState.starting = true;
    mcStartState.startedAt = Date.now();
    mcStartState.elapsedSec = 0;
    mcStartState.timedOut = false;
}

function markMcNotStarting({ timedOut = false } = {}) {
    mcStartState.starting = false;
    mcStartState.startedAt = 0;
    mcStartState.elapsedSec = 0;
    mcStartState.timedOut = timedOut;
    clearMcStartLoop();
}

function getStartingElapsedMs() {
    return mcStartState.startedAt ? (Date.now() - mcStartState.startedAt) : 0;
}

function getStartingFrameIcon() {
    // Simple 2-frame "animation" that flips every second.
    return (mcStartState.elapsedSec % 2 === 0) ? '⏳' : '⌛';
}

function formatElapsedCompact(totalSec) {
    const sec = Math.max(0, Number(totalSec) || 0);
    const minutes = Math.floor(sec / 60);
    const seconds = sec % 60;

    if (minutes <= 0) return `${seconds}s`;

    const minLabel = minutes === 1 ? '1min' : `${minutes}min`;
    const secLabel = seconds === 1 ? '1 second' : `${seconds} seconds`;
    return `${minLabel} ${secLabel}`;
}

function formatStartingLabel() {
    const sec = Math.max(0, Number(mcStartState.elapsedSec) || 0);
    const icon = getStartingFrameIcon();
    const elapsed = formatElapsedCompact(sec);
    return `${icon} Starting… ${elapsed} (${MC_STARTING_HINT})`;
}

async function refreshMinecraftStartUI() {
    // Only care while the memory modal is open.
    if (!modalElements?.overlay?.classList?.contains('active')) return;

    const elapsed = getStartingElapsedMs();

    // Timeout path: allow retry without calling it a failure.
    if (mcStartState.starting && elapsed >= MC_STARTING_TIMEOUT_MS) {
        markMcNotStarting({ timedOut: true });
        setMcStartButtonState({ visible: true, disabled: false, label: '↻ Retry start' });
        return;
    }

    try {
        const res = await fetch(`${CONFIG.API_BASE}/api/services/minecraft/status`);
        const data = await res.json().catch(() => ({}));

        if (data?.running) {
            markMcNotStarting({ timedOut: false });
            setMcStartButtonState({ visible: false });
            return;
        }

        // Not running
        if (mcStartState.starting) {
            setMcStartButtonState({ visible: true, disabled: true, label: formatStartingLabel() });
        } else {
            const label = mcStartState.timedOut ? '↻ Retry start' : '▶️ Start Minecraft Server';
            setMcStartButtonState({ visible: true, disabled: false, label });
        }
    } catch {
        // Ignore transient status errors while booting.
        if (mcStartState.starting) {
            setMcStartButtonState({ visible: true, disabled: true, label: formatStartingLabel() });
        }
    }
}

function scheduleMinecraftStartingLabelTick() {
    const tick = () => {
        if (!mcStartState.starting) return;

        // Prefer wall-clock elapsed, but fall back to ticking when timers are throttled.
        const wall = Math.floor(getStartingElapsedMs() / 1000);
        if (Number.isFinite(wall) && wall >= 0) {
            mcStartState.elapsedSec = wall;
        } else {
            mcStartState.elapsedSec = (Number(mcStartState.elapsedSec) || 0) + 1;
        }

        // Update label even if status polling is slower.
        setMcStartButtonState({ visible: true, disabled: true, label: formatStartingLabel() });
        mcStartState.labelTimer = setTimeout(tick, MC_STARTING_LABEL_TICK_MS);
    };

    // Start immediately.
    mcStartState.labelTimer = setTimeout(tick, 0);
}

function scheduleMinecraftStartLoop() {
    clearMcStartLoop();

    // Label tick (1s) for countdown + icon animation.
    scheduleMinecraftStartingLabelTick();

    // Status polling (5s)
    const tick = async () => {
        await refreshMinecraftStartUI();

        // Keep looping only while we're still in the starting window.
        if (!mcStartState.starting) return;

        mcStartState.statusTimer = setTimeout(tick, MC_STARTING_REFRESH_MS);
    };

    mcStartState.statusTimer = setTimeout(tick, 0);
}

// Make startMinecraft global as it is used directly
window.startMinecraft = async function () {
    // Lock immediately to prevent double-click.
    markMcStarting();
    setMcStartButtonState({ visible: true, disabled: true, label: formatStartingLabel() });

    // Start UI loop (only updates while the modal is open)
    scheduleMinecraftStartLoop();

    try {
        const res = await fetch(`${CONFIG.API_BASE}/api/services/minecraft/start`, {
            method: 'POST',
            headers: { ...getAuthHeaders() }
        });

        // If auth is enabled and token is missing/invalid, stop the starting state.
        if (res.status === 401 || res.status === 403) {
            markMcNotStarting({ timedOut: false });
            setMcStartButtonState({ visible: true, disabled: false, label: '▶️ Start Minecraft Server' });
            alert('Unauthorized. Please set your API token and try again.');
            return;
        }

        // Do not show errors here; the status polling decides when to allow retry.
        await safeParseJsonResponse(res).catch(() => null);
    } catch (error) {
        // Network/JS error -> allow retry (but don't call it "failed").
        markMcNotStarting({ timedOut: true });
        setMcStartButtonState({ visible: true, disabled: false, label: '↻ Retry start' });
        alert('Error: ' + error.message);
    }
};

function closeMemoryModal() {
    modalElements.overlay.classList.remove('active');
    // Stop polling when the modal is not visible.
    clearMcStartLoop();
}

// ===== Initialization =====
function init() {
    // Theme
    initTheme();

    // Initial data fetch
    refreshData();

    // Set up refresh intervals
    setInterval(refreshMetricsOnly, CONFIG.REFRESH_INTERVAL);

    // Refresh button click handler
    elements.refreshBtn.addEventListener('click', refreshData);

    // Memory card click handler (open modal)
    modalElements.memoryCard.addEventListener('click', openMemoryModal);

    // CPU card click handler (open modal)
    cpuModalElements.cpuCard?.addEventListener('click', openCpuModal);
    cpuModalElements.cpuCard?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openCpuModal();
        }
    });

    // Disk card click handler (open modal)
    diskModalElements.diskCard?.addEventListener('click', openDiskModal);
    diskModalElements.diskCard?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openDiskModal();
        }
    });

    // Process Table Event Delegation
    modalElements.processesTbody.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-action');
        if (!btn) return;

        const action = btn.dataset.action;
        const pid = btn.dataset.pid;
        const name = btn.dataset.name;

        if (action === 'kill') {
            handleKillProcess(pid, name);
        } else if (action === 'restart') {
            handleRestartProcess(pid);
        }
    });

    // Bandwidth card click handler (set monthly cap)
    const bandwidthCard = document.getElementById('bandwidth-card');
    if (bandwidthCard) {
        bandwidthCard.addEventListener('click', () => {
            const current = (() => {
                try { return localStorage.getItem('monthlyBandwidthCapGb') || ''; } catch { return ''; }
            })();

            const input = prompt('Set monthly bandwidth limit (GB). Leave empty to clear.', current);
            if (input === null) return;

            const trimmed = String(input).trim();
            try {
                if (!trimmed) {
                    localStorage.removeItem('monthlyBandwidthCapGb');
                } else {
                    const value = Number(trimmed);
                    if (!Number.isFinite(value) || value <= 0) {
                        alert('Please enter a valid positive number (GB).');
                        return;
                    }
                    localStorage.setItem('monthlyBandwidthCapGb', String(value));
                }
            } catch {
                // ignore
            }

            // Refresh UI immediately
            refreshMetricsOnly();
        });
    }

    // Disk breakdown button
    diskModalElements.breakdownBtn?.addEventListener('click', () => {
        loadDiskBreakdown();
    });

    // Modal close handlers
    modalElements.closeBtn.addEventListener('click', closeMemoryModal);
    modalElements.overlay.addEventListener('click', (e) => {
        if (e.target === modalElements.overlay) {
            closeMemoryModal();
        }
    });

    cpuModalElements.closeBtn?.addEventListener('click', closeCpuModal);
    cpuModalElements.overlay?.addEventListener('click', (e) => {
        if (e.target === cpuModalElements.overlay) {
            closeCpuModal();
        }
    });

    diskModalElements.closeBtn?.addEventListener('click', closeDiskModal);
    diskModalElements.overlay?.addEventListener('click', (e) => {
        if (e.target === diskModalElements.overlay) {
            closeDiskModal();
        }
    });

    // Close modal on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;

        if (modalElements.overlay.classList.contains('active')) {
            closeMemoryModal();
        }

        if (cpuModalElements.overlay?.classList.contains('active')) {
            closeCpuModal();
        }

        if (diskModalElements.overlay?.classList.contains('active')) {
            closeDiskModal();
        }
    });

    console.log('VPS Dashboard initialized');
}

// Start the application
document.addEventListener('DOMContentLoaded', () => {
    // Mark that JS is running and animations are enabled for this session.
    // We keep this separate from `is-ready` so the UI doesn't get stuck hidden
    // if app.js fails before it can flip the ready flag.
    document.body.classList.add('animate');

    // Register service worker for PWA installability
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch(() => {
            // Ignore SW registration failures
        });
    }

    // Trigger entrance animations (CSS-driven)
    requestAnimationFrame(() => {
        document.body.classList.add('is-ready');
    });

    init();
});

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        CONFIG,
        state,
        formatTrafficValue,
        fetchMetrics,
        fetchSystemInfo
    };
}
