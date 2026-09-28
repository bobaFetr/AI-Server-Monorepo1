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

## Connect to a local Ubuntu VM

Run `npm install` and `npm run dev`, then open `http://127.0.0.1:3000`.
On Windows PowerShell, use `npm.cmd` if execution policy blocks `npm.ps1`.
Real SSH mode is the default; Demo mode explicitly enables the original simulated dashboard.

The local backend invokes this PC's OpenSSH client. Private keys never enter the browser.
Password prompts are not supported: configure an SSH key or SSH agent first.

1. In Ubuntu, install OpenSSH with `sudo apt install openssh-server`.
2. Make the VM reachable: use a host-only/bridged address, or configure your hypervisor's NAT forwarding from `127.0.0.1:2222` to guest port `22`.
3. On Windows, generate a key if you do not already have one: `ssh-keygen -t ed25519`. Do not overwrite an existing key. Install the contents of the `.pub` file in the Ubuntu user's `~/.ssh/authorized_keys` (directory mode `700`, file mode `600`). Keep the private key on Windows. For a passphrase-protected key, load it into your Windows SSH agent with `ssh-add`.
4. Connect once from PowerShell: `ssh -p 2222 ubuntu@127.0.0.1` (replace port, username, and host). Verify the displayed host fingerprint against the VM console before accepting it. In the VM, `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub` shows the ED25519 fingerprint.
5. Verify noninteractive access: `ssh -o BatchMode=yes -o StrictHostKeyChecking=yes -p 2222 ubuntu@127.0.0.1 hostname`.
6. Enter the same host, port, and Ubuntu username in Northstar and click Connect.

Live tools: system overview, processes, storage, running services, journal, Docker listing,
and confirmed container start/stop/restart by container ID. Results refresh on demand.
Docker operations require existing Docker permissions for the SSH user; Northstar does not
grant permissions or invoke sudo. Interactive terminal, file editing, firewall changes,
user administration, and updates remain available only as demo screens, not live actions.

The gateway is restricted to same-origin requests on the loopback development server and is
disabled in production builds. Do not expose the dev server using a tunnel or reverse proxy.
Commands are allowlisted, arguments validated, host-key verification is required, and
operations have a 20-second deadline. Each operation opens a new SSH process; Disconnect
returns to the form. No SSH credentials are stored by Northstar.

## Original demo

With Demo mode selected, a normal host value opens the simulated dashboard. Entering a host that contains `offline`, `invalid`, `fail`, or `404` opens the demonstration connection error experience.

A production implementation should connect through an authenticated server-side gateway or installed host agent. SSH credentials and private keys should never be exposed to browser code.
