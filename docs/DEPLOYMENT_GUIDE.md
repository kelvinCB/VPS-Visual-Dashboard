# Deployment Guide (Auto-deploy to VPS)

This repo can auto-deploy to a VPS running **Node + PM2** whenever changes are pushed to `main`.

## How it works

- A GitHub Actions workflow runs on every push to `main`.
- It connects to your VPS over SSH.
- It runs `scripts/deploy.sh`, which:
  - `git fetch` + `git reset --hard origin/main`
  - `npm ci --omit=dev`
  - `pm2 restart` (preferred process name) or `pm2 restart all`

## Required GitHub Secrets

Create these secrets in your repo:

- `VPS_HOST` — e.g. `86.48.24.125`
- `VPS_USER` — e.g. `kelvin` (or `root`)
- `VPS_SSH_KEY` — **private** SSH key for the deploy user
- `VPS_PORT` — optional, defaults to `22`

## Create a deploy SSH key (on the VPS)

Run on the VPS:

```bash
sudo -i
ssh-keygen -t ed25519 -C "github-actions-deploy" -f /root/.ssh/github_actions_ed25519
cat /root/.ssh/github_actions_ed25519.pub >> /root/.ssh/authorized_keys
chmod 600 /root/.ssh/authorized_keys
```

Then copy the private key into GitHub as the `VPS_SSH_KEY` secret:

```bash
cat /root/.ssh/github_actions_ed25519
```

## Notes

- This deployment strategy assumes your VPS already has the repo cloned at `/root/VPS-Visual-Dashboard`.
- If you run the app under a specific PM2 name, update `scripts/deploy.sh` to restart that name.
