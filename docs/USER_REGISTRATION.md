# User Registration + PostgreSQL (Issue #2644)

This feature adds real user registration backed by PostgreSQL.

## What was added

- `POST /api/auth/register`
- Automatic table bootstrap (`dashboard_users`) on first register
- New users are always created with role: `Player`
- Frontend register page now calls backend API (instead of mock timeout)

## Required env var

```bash
DATABASE_URL=postgres://user:password@host:5432/database
```

If `DATABASE_URL` is missing, registration returns `503` and `/register` shows a setup hint.

## Table schema

```sql
CREATE TABLE IF NOT EXISTS dashboard_users (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'Player',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## Manual verification

Register a user from UI:

- `https://kelvin-vps.site/register`

Then verify in PostgreSQL:

```sql
SELECT id, email, role, created_at
FROM dashboard_users
ORDER BY id DESC
LIMIT 20;
```

Expected: every new row has `role = 'Player'`.

## Notes

- Passwords are stored as salted `scrypt` hashes.
- Login/auth session is not part of this ticket.
