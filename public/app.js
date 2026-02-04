/**
 * VPS Dashboard - Frontend Application
 * Handles metrics fetching, chart rendering, and UI updates
 */

// ===== Configuration =====
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
    }
};

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

async function openMemoryModal() {
    modalElements.overlay.classList.add('active');
    modalElements.processesTbody.innerHTML = '<tr><td colspan="4">Loading...</td></tr>';

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
        modalElements.processesTbody.innerHTML = data.processes
            .map(proc => `
                <tr>
                    <td>${proc.name}</td>
                    <td>${proc.pid}</td>
                    <td>${proc.memoryFormatted}</td>
                    <td>${proc.memoryPercent}%</td>
                </tr>
            `)
            .join('');

    } catch (error) {
        modalElements.processesTbody.innerHTML = '<tr><td colspan="4">Error loading data</td></tr>';
    }
}

function closeMemoryModal() {
    modalElements.overlay.classList.remove('active');
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

    // Modal close handlers
    modalElements.closeBtn.addEventListener('click', closeMemoryModal);
    modalElements.overlay.addEventListener('click', (e) => {
        if (e.target === modalElements.overlay) {
            closeMemoryModal();
        }
    });

    // Close modal on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modalElements.overlay.classList.contains('active')) {
            closeMemoryModal();
        }
    });

    console.log('VPS Dashboard initialized');
}

// Start the application
document.addEventListener('DOMContentLoaded', () => {
    // Register service worker for PWA installability
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch(() => {
            // Ignore SW registration failures
        });
    }

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
