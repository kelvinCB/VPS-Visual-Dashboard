# Product Requirements Document (PRD)

## Current Version: 1.0.0

## Table of Contents

- [Overview](#overview)
- [Core Features (v1.0)](#core-features-v10)
- [Future Ideas](#future-ideas)
- [Technical Debt](#technical-debt)
- [Non-Functional Requirements](#non-functional-requirements)

---

### Overview

VPS Visual Dashboard is a web-based monitoring tool that displays real-time system metrics for a VPS server.

### Core Features (v1.0)

| Feature | Status | Description |
|---------|--------|-------------|
| CPU Monitoring | ✅ | Real-time CPU usage with line chart |
| Memory Monitoring | ✅ | RAM usage with chart and details |
| Disk Usage | ✅ | Disk space with circular chart |
| Network Traffic | ✅ | Incoming/outgoing bandwidth |
| System Info | ✅ | OS, hostname, uptime, location |
| Auto Refresh | ✅ | 25s intervals for metrics |
| Dark Theme | ✅ | Modern Hostinger-inspired design |
| Responsive | ✅ | Mobile and desktop support |

---

## Future Ideas

### v1.1 - Enhanced Metrics

- [ ] **Process List** - Top processes by CPU/memory
- [ ] **Temperature Monitoring** - CPU/GPU temps
- [ ] **Load Average** - 1, 5, 15 minute averages
- [ ] **Swap Usage** - Separate swap monitoring
- [ ] **Per-Core CPU** - Individual core usage

### v1.2 - Alerts & Notifications

- [ ] **Threshold Alerts** - Set CPU/RAM/Disk thresholds
- [ ] **Email Notifications** - Alert emails when exceeded
- [ ] **Telegram Bot** - Send alerts via Telegram
- [ ] **Webhook Support** - Custom webhook integrations
- [ ] **Alert History** - Log of past alerts

### v1.3 - Historical Data

- [ ] **Metrics History** - Store historical data
- [ ] **Time Range Selector** - View last hour/day/week
- [ ] **SQLite Storage** - Lightweight local database
- [ ] **Export Data** - CSV/JSON export
- [ ] **Trend Analysis** - Identify patterns

### v1.4 - Multi-Server Support

- [ ] **Multiple VPS** - Monitor multiple servers
- [ ] **Server Groups** - Organize by project/region
- [ ] **Agent Mode** - Install agents on remote VPS
- [ ] **Centralized Dashboard** - Single view for all

### v1.5 - Security & Auth

- [ ] **User Authentication** - Login system
- [ ] **API Keys** - Secure API access
- [ ] **Rate Limiting** - Prevent abuse
- [x] **SSL/HTTPS** - Secure connections (via kelvin-vps.site)
- [ ] **Audit Logs** - Track access

### v1.6 - UI/UX Improvements

- [x] **Dark Mode** - Toggleable dark/light mode
- [ ] **Responsive Design** - Mobile-first layout
- [ ] **Animation** - Give life with animations

### v2.0 - Advanced Features

- [ ] **Docker Monitoring** - Container stats
- [ ] **Nginx/Apache Logs** - Web server metrics
- [ ] **Database Metrics** - MySQL/PostgreSQL stats
- [ ] **Custom Widgets** - User-defined metrics
- [ ] **Dashboard Sharing** - Public status pages

---

## Technical Debt

- [ ] Add TypeScript support
- [ ] Implement proper error boundaries
- [ ] Add service worker for offline support
- [ ] Optimize chart rendering performance
- [ ] Add unit test coverage to 80%+

---

## Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| Page Load Time | < 2 seconds |
| API Response Time | < 500ms |
| Uptime | 99.9% |
| Browser Support | Last 2 versions |
| Mobile Responsive | Yes |
