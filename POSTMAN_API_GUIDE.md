# VPS-Visual-Dashboard — Postman API Guide

Use this doc to quickly test the VPS-Visual-Dashboard API from Postman.

---

## 1) Base URL

Set an environment variable in Postman:

- `BASE_URL` = `https://<your-domain>`

Examples:
- `https://kelvin-vps.site`
- `http://<server-ip>:<port>`

---

## 2) Auth (Optional)

If the VPS has `DASHBOARD_API_TOKEN` configured, protected endpoints require a token.

Create an environment variable:

- `API_TOKEN` = `<your token>`

Then add a header to requests:

- `Authorization: Bearer {{API_TOKEN}}`

Fallback header also supported:
- `X-API-KEY: {{API_TOKEN}}`

If you get:
- `401 {"error":"Unauthorized"}` → token missing/incorrect

---

## 3) Requests (Copy/Paste)

### Health

**GET** `{{BASE_URL}}/health`

---

### System Metrics

**GET** `{{BASE_URL}}/api/system`

**GET** `{{BASE_URL}}/api/metrics`

---

### Processes

**GET** `{{BASE_URL}}/api/processes`

Returns:
- `breakdown` (memory categories)
- `processes` (top processes)
- `isMinecraftRunning`, `minecraftPid`

---

### Kill Process (Protected if token enabled)

**POST** `{{BASE_URL}}/api/processes/{{PID}}/kill`

Headers:
- `Authorization: Bearer {{API_TOKEN}}` (if token enabled)

Notes:
- By default only the detected Minecraft PID is allowed.
- If blocked: `403 {"error":"PID not allowed","pid":<pid>}`

---

### Minecraft Status

**GET** `{{BASE_URL}}/api/services/minecraft/status`

---

### Minecraft Start (Protected if token enabled)

**POST** `{{BASE_URL}}/api/services/minecraft/start`

Headers:
- `Authorization: Bearer {{API_TOKEN}}` (if token enabled)

---

### Minecraft Restart (Protected if token enabled)

**POST** `{{BASE_URL}}/api/services/minecraft/restart`

Headers:
- `Authorization: Bearer {{API_TOKEN}}` (if token enabled)

---

## 4) Common Troubleshooting

### I get HTML instead of JSON

This often means a reverse proxy (nginx) returned an error page (502/504). Check:
- the backend is running (pm2)
- the domain/proxy points to the correct port

### Start says it failed but Minecraft actually starts

Increase verification time:
- `MC_START_VERIFY_TIMEOUT_MS=60000`

Restart the service.

### Unauthorized errors

- Ensure the token is configured on the VPS: `DASHBOARD_API_TOKEN=...`
- Ensure Postman is sending: `Authorization: Bearer {{API_TOKEN}}`

