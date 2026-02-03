#!/usr/bin/env bash
set -euo pipefail

# VPS Visual Dashboard - Deploy Script
# Intended to be run on the VPS (via GitHub Actions over SSH)

APP_DIR="${APP_DIR:-/root/VPS-Visual-Dashboard}"
BRANCH="${BRANCH:-main}"

cd "$APP_DIR"

echo "[deploy] Working directory: $(pwd)"

echo "[deploy] Fetching latest from origin/${BRANCH}..."
git fetch origin "$BRANCH" --prune

echo "[deploy] Resetting working tree to origin/${BRANCH}..."
git reset --hard "origin/${BRANCH}"

echo "[deploy] Installing production dependencies..."
# Use npm ci for reproducible installs.
# --omit=dev keeps the VPS lean; remove if you need dev deps at runtime.
npm ci --omit=dev

echo "[deploy] Restarting PM2 process..."
# Try common process names first, fallback to restarting all.
if pm2 describe vps-dashboard >/dev/null 2>&1; then
  pm2 restart vps-dashboard
elif pm2 describe vps-visual-dashboard >/dev/null 2>&1; then
  pm2 restart vps-visual-dashboard
else
  pm2 restart all
fi

# Persist process list (in case it changed)
pm2 save || true

echo "[deploy] Done."