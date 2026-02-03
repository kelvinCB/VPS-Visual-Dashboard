# Frontend Guide

Technical documentation for the VPS Dashboard frontend.

## Table of Contents

- [Structure](#structure)
- [Technologies](#technologies)
- [Design System](#design-system)
- [Components](#components)
- [JavaScript Architecture](#javascript-architecture)
- [Responsive Breakpoints](#responsive-breakpoints)
- [Browser Support](#browser-support)

---

## Structure

```
public/
├── index.html    # Main HTML page
├── styles.css    # All CSS styles
└── app.js        # JavaScript application
```

## Technologies

- **HTML5** - Semantic markup
- **CSS3** - Custom properties, Grid, Flexbox
- **Vanilla JavaScript** - No frameworks
- **Canvas API** - Charts rendering

## Design System

### CSS Variables

```css
--bg-primary: #0f0f13       /* Page background */
--bg-card: #1e1e26          /* Card background */
--accent-primary: #7c3aed   /* Purple accent */
--text-primary: #ffffff     /* Main text */
--text-secondary: #a0a0b0   /* Secondary text */
```

### Color Palette

| Purpose | Color | Hex |
|---------|-------|-----|
| CPU Chart | Purple | `#7c3aed` |
| Memory Chart | Orange | `#f97316` |
| Traffic In | Green | `#22c55e` |
| Traffic Out | Blue | `#3b82f6` |
| Success | Green | `#22c55e` |
| Error | Red | `#ef4444` |

## Components

### Metric Card

```html
<article class="metric-card">
  <div class="metric-header">
    <span class="metric-title">CPU usage</span>
    <svg class="metric-icon">...</svg>
  </div>
  <div class="metric-value">
    <span id="cpu-value">0</span>
    <span class="metric-unit">%</span>
  </div>
  <div class="metric-chart">
    <canvas id="cpu-chart"></canvas>
  </div>
</article>
```

### Charts

Two chart types are used:
1. **Line Chart** - CPU, Memory, Network traffic
2. **Circular Chart** - Disk usage, Bandwidth

Charts are rendered using Canvas API with smooth bezier curves.

## JavaScript Architecture

### Configuration

```javascript
const CONFIG = {
  REFRESH_INTERVAL: 25000,      // 25 seconds
  DISK_REFRESH_INTERVAL: 150000, // 150 seconds
  CHART_HISTORY_LENGTH: 20
};
```

### State Management

```javascript
const state = {
  cpuHistory: [],      // Last 20 CPU readings
  memoryHistory: [],   // Last 20 memory readings
  trafficInHistory: [],
  trafficOutHistory: [],
  isLoading: false
};
```

### API Functions

- `fetchMetrics()` - GET /api/metrics
- `fetchSystemInfo()` - GET /api/system

### Refresh Logic

1. Initial load fetches both metrics and system info
2. Every 25s: only metrics are refreshed
3. Manual refresh: both endpoints called

## Responsive Breakpoints

| Breakpoint | Layout |
|------------|--------|
| > 1200px | 3-column grid |
| 768-1200px | 2-column grid |
| < 768px | 1-column stack |
| < 480px | Compact mobile |

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+
