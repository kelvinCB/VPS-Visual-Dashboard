# Database Schema (Postgres)

This project currently runs without a database.

To keep behavior **non-breaking**, database connectivity is optional and is only enabled when `DATABASE_URL` is set.

A lightweight Postgres “plumbing” module exists at `db.js` for future use.

---

## Database

Recommended database name on the VPS:
- `vps_visual_dashboard_secure`

You can choose a different name, but keep the `DATABASE_URL` consistent.

### Create database (psql)

```bash
# as the postgres superuser (or a user with CREATEDB)
psql -U postgres -h 127.0.0.1 -c "CREATE DATABASE vps_visual_dashboard_secure;"

# (optional) create a dedicated user
psql -U postgres -h 127.0.0.1 -c "CREATE USER vps_visual_dashboard_app WITH PASSWORD 'REPLACE_ME';"
psql -U postgres -h 127.0.0.1 -c "GRANT ALL PRIVILEGES ON DATABASE vps_visual_dashboard_secure TO vps_visual_dashboard_app;"
```

### App env var

Example `DATABASE_URL`:

```bash
DATABASE_URL=postgres://vps_visual_dashboard_app:REPLACE_ME@127.0.0.1:5432/vps_visual_dashboard_secure
```

---

## Tables (planned / minimal v0)

No tables are created automatically yet. The following schema is a **proposed minimal starting point** for secure/audited actions.

### 1) `action_audit`

Tracks sensitive actions taken via the API (kill/restart/start), who requested them (when auth is enabled), and results.

Suggested columns:
- `id` (bigserial, pk)
- `created_at` (timestamptz, default now())
- `action` (text) — e.g. `kill_process`, `minecraft_restart`
- `target` (text) — e.g. pid or service name
- `success` (boolean)
- `error` (text, nullable)
- `request_ip` (inet, nullable)
- `user_agent` (text, nullable)

### 2) `metrics_snapshots` (optional)

If you later want historical charts beyond in-memory history.

Suggested columns:
- `id` (bigserial, pk)
- `created_at` (timestamptz, default now())
- `cpu_usage` (real)
- `memory_usage` (real)
- `disk_usage` (real)
- `rx_bytes` (bigint)
- `tx_bytes` (bigint)

---

## Notes

- Keep DB usage optional: if `DATABASE_URL` is not set, nothing should attempt to connect.
- When the DB is introduced for real, add migrations instead of creating tables in code.
