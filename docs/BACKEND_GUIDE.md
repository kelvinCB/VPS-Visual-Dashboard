# Backend Guide

Technical documentation for the VPS Dashboard backend.

## Table of Contents

- [Overview](#overview)
- [Structure](#structure)
- [Dependencies](#dependencies)
- [API Endpoints](#api-endpoints)
- [Configuration](#configuration)
- [Utility Functions](#utility-functions)
- [Running the Server](#running-the-server)
- [Error Handling](#error-handling)
- [Security Considerations](#security-considerations)

---

## Overview

Node.js + Express server providing system metrics via REST API.

## Structure

```
├── server.js           # Main server file
├── package.json        # Dependencies
└── public/             # Static files (served)
```

## Dependencies

| Package | Purpose |
|---------|---------| 
| `express` | Web server framework |
| `cors` | Cross-origin requests |
| `systeminformation` | System metrics collection |

## API Endpoints

### GET /api/metrics

Returns current system metrics.

**Response:**
```json
{
  "cpu": {
    "usage": 25.5,
    "cores": 4
  },
  "memory": {
    "usage": 45.2,
    "used": "3.6 GB",
    "total": "8 GB"
  },
  "disk": {
    "usage": 40,
    "used": "40 GB",
    "total": "100 GB"
  },
  "network": {
    "rxBytes": 125000000,
    "txBytes": 75000000,
    "rxFormatted": "119.2 MB",
    "txFormatted": "71.5 MB"
  },
  "timestamp": "2026-02-03T15:00:00.000Z"
}
```

### GET /api/system

Returns system information.

**Response:**
```json
{
  "hostname": "vps-server",
  "platform": "linux",
  "distro": "Ubuntu",
  "release": "22.04",
  "kernel": "5.15.0-generic",
  "arch": "x64",
  "uptime": "5d 12h 30m",
  "location": "Singapore"
}
```

### GET /api/health

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-02-03T15:00:00.000Z"
}
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `7847` | Server port |
| `SERVER_LOCATION` | `Local Server` | Display location |

### Caching

Metrics are cached for 5 seconds to avoid excessive system calls:

```javascript
const METRICS_CACHE_TTL = 5000; // 5 seconds
```

## Utility Functions

### formatBytes(bytes, decimals)

Converts bytes to human-readable format.

```javascript
formatBytes(1073741824) // "1 GB"
formatBytes(1536)       // "1.5 KB"
```

### formatUptime(seconds)

Converts seconds to human-readable uptime.

```javascript
formatUptime(192600) // "2d 5h 30m"
```

## Running the Server

### Development
```bash
npm run dev
# Server runs at http://localhost:7847
```

### Production
```bash
npm start
# Or with PM2:
pm2 start server.js --name "vps-dashboard"
```

## Error Handling

All API errors return:
```json
{
  "error": "Error message description"
}
```

With appropriate HTTP status codes (500 for server errors).

## Security Considerations

- CORS enabled for development
- No authentication (deploy behind firewall)
- Static files served from `/public`
- No sensitive data exposed
