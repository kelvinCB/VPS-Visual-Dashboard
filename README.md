# VPS Visual Dashboard

A modern, real-time dashboard to monitor your VPS server metrics. Inspired by Hostinger's VPS panel design.

![Dashboard Preview](docs/preview.png)

## Features

- 📊 **Real-time Metrics** - CPU, Memory, Disk, Network
- 🎨 **Modern Dark Theme** - Beautiful Hostinger-inspired UI
- 📈 **Live Charts** - Smooth line and circular charts
- 📱 **Responsive Design** - Works on desktop and mobile
- ⚡ **Lightweight** - No heavy frameworks, vanilla JS

## Quick Start

```bash
# Clone the repository
git clone https://github.com/kelvinCB/VPS-Visual-Dashboard.git
cd VPS-Visual-Dashboard

# Install dependencies
npm install

# Start the server
npm start

# Open in browser
# http://localhost:7847
```

## Deploy to VPS

```bash
# SSH to your VPS
ssh user@your-vps-ip

# Clone and install
git clone https://github.com/kelvinCB/VPS-Visual-Dashboard.git
cd VPS-Visual-Dashboard
npm install

# Run with PM2 (recommended)
npm install -g pm2
pm2 start server.js --name "vps-dashboard"
pm2 save
pm2 startup

# Access at http://your-vps-ip:7847
```

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `7847` | Server port |
| `SERVER_LOCATION` | `Local Server` | Display location |

Set via environment:
```bash
PORT=8080 SERVER_LOCATION="New York" npm start
```

## Testing

```bash
npm test              # Run all unit tests
npm run test:e2e      # Run E2E tests
npm run test:coverage # Generate coverage report
```

## Documentation

- [Frontend Guide](docs/FRONTEND_GUIDE.md) - UI, components, styling
- [Backend Guide](docs/BACKEND_GUIDE.md) - API endpoints, configuration
- [Testing Guide](docs/TESTING_GUIDE.md) - How to run and write tests
- [PRD Guide](docs/PRD_GUIDE.md) - Features roadmap

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/metrics` | CPU, RAM, Disk, Network stats |
| `GET /api/system` | OS, hostname, uptime, location |
| `GET /api/health` | Health check |

## Tech Stack

- **Backend**: Node.js, Express, systeminformation
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Testing**: Vitest, Playwright

## License

MIT
