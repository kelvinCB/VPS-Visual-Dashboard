# VPS-Visual-Dashboard — Backend Guide

## Architecture

A small Node.js/Express app that serves a static dashboard UI and exposes REST endpoints for:

- System metrics (CPU, RAM, disk, network)
- Top processes + process termination (guarded by optional auth + allowlist)
- Minecraft service control (start/restart/status)
- Bandwidth tracking and health checks

The frontend is vanilla JS (served from `public/`) and calls the backend under `/api/*`.

---

## Technology Stack

- **Node.js** — runtime
- **Express.js** — HTTP server + REST API
- **systeminformation** — host metrics + process list
- **pm2** (deployment) — process manager (recommended)
- **Vitest** — unit/integration tests
- **Supertest** — HTTP assertions for API tests
- **Playwright** — E2E tests (optional)
- **Postgres (optional)** — only used if `DATABASE_URL` is set (lazy pool), intended for future persistence

---

## Project Structure

```
VPS-Visual-Dashboard/
├── server.js                  # Main server (Express app + API routes)
├── db.js                      # Optional Postgres pool (only when DATABASE_URL is set)
├── public/                    # Static frontend
│   ├── index.html
│   ├── app.js
│   ├── styles.css
│   ├── sw.js
│   └── manifest.webmanifest
├── data/
│   └── bandwidth.json         # Persisted bandwidth tracking
├── docs/
│   └── Database Schema.md     # Optional DB schema notes (future)
├── scripts/                   # Deploy/setup helpers
├── tests/
│   ├── backend/               # API tests
│   └── frontend/              # JS/DOM tests
├── playwright.config.js       # E2E config
└── vitest.config.js           # Test config
```

---

## Authentication (Optional)

Sensitive endpoints can be protected by setting:

- `DASHBOARD_API_TOKEN=<your token>`

Behavior:
- If **unset** → current behavior remains (no auth required)
- If **set** → requests must include one of:
  - `Authorization: Bearer <token>` (preferred)
  - `X-API-KEY: <token>` (fallback)

On failure, the API returns:
- `401 { "error": "Unauthorized" }`

### Frontend token

Frontend sends auth headers only if a token exists. You can set it with:

- `localStorage.setItem('apiToken', '<token>')`

---

## Key Endpoints (REST)

### System / Health

- `GET /health` — basic health check
- `GET /api/system` — summary system metrics
- `GET /api/metrics` — time-series / cached dashboard metrics (used by UI refresh)

### Processes

- `GET /api/processes` — top processes by memory + memory breakdown + minecraft PID detection
- `POST /api/processes/:pid/kill` — send SIGTERM to a PID

#### PID allowlist behavior

By default, the kill endpoint only allows killing the **detected Minecraft PID**.

Optional env overrides:
- `ALLOWED_KILL_PIDS=123,456`
- `ALLOWED_KILL_PROCESS_MATCH=node,minecraft`

If PID is not allowed:
- `403 { "error": "PID not allowed", "pid": 456 }`

### Minecraft service

- `GET /api/services/minecraft/status` — reports `running`, `listening`, and detected `pid`
- `POST /api/services/minecraft/start` — runs `MC_START_COMMAND` (detached) and verifies startup
- `POST /api/services/minecraft/restart` — kill + start sequence

Relevant env:
- `MC_PORT` (default 25565)
- `MC_START_COMMAND` (required for real start)
- `MC_LOG_PATH` (optional)
- `MC_START_VERIFY_TIMEOUT_MS` (default 15000 in prod; recommended 60000 for modded)

---

## Testing

Run unit/integration tests:

```bash
npm test
```

E2E (if configured):

```bash
npm run test:e2e
```
