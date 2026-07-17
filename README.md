# Northstar Server Console

Northstar is a polished remote-server management interface designed for Ubuntu Server. It guides an administrator through entering SSH server coordinates, displays a clear 404-style recovery screen when a host cannot be reached, and opens a detailed operations dashboard after a successful connection.

## Included Experience

- Server coordinate form for host, SSH port, username, and authentication method
- Designed connecting, connected, and unreachable-host states
- Overview with CPU, memory, disk, network, Docker, and activity information
- Interactive terminal prototype
- Docker container manager with start and stop controls
- Task manager with process and resource data
- Navigation for files, firewall, storage, users and groups, updates, and settings
- Responsive desktop, tablet, and mobile layouts

## Technology

- TanStack Start
- React 19
- TypeScript
- Vite
- Tailwind CSS 4 tooling with a custom CSS design system
- Lucide React icons
- Netlify deployment adapter

## Run Locally

```bash
npm install
npm run dev
```

The development server runs on the port configured by the project. For Netlify platform emulation, use Netlify CLI with the project configuration.

## Prototype Behavior

This project currently demonstrates the complete management UI without making real SSH connections. A normal host value opens the dashboard. Entering a host that contains `offline`, `invalid`, `fail`, or `404` opens the connection error experience.

A production implementation should connect through an authenticated server-side gateway or installed host agent. SSH credentials and private keys should never be exposed to browser code.
