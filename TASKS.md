# Northstar Real Server Tasks

This checklist tracks the work needed to test Northstar against an Ubuntu Server VM in VirtualBox and evolve the UI from a prototype into a safe local operations console.

## Phase 1: VirtualBox Ubuntu Server Test Host

- [ ] Create an Ubuntu Server VM in VirtualBox.
- [ ] Configure VM networking so the host machine can reach the guest.
  - Preferred for local testing: bridged adapter.
  - Alternative: NAT with SSH port forwarding from host port `2222` to guest port `22`.
- [ ] Install and start OpenSSH inside the VM.
- [ ] Create a non-root admin user with `sudo` access.
- [ ] Confirm the host can SSH into the VM from a terminal.
- [ ] Record the VM host, SSH port, username, and auth method in a local `.env` file.

## Phase 2: Local SSH Gateway

- [ ] Add a server-side SSH gateway so browser code never receives private keys or raw server credentials.
- [ ] Keep the gateway local-only during early testing.
- [ ] Load connection settings from environment variables.
- [ ] Support a read-only health check command such as `uname -a` or `systemctl is-system-running`.
- [ ] Add strict command allowlists for dashboard actions.
- [ ] Return structured JSON responses to the React UI.
- [ ] Add timeout handling for slow or unreachable hosts.
- [ ] Redact sensitive values from logs and UI errors.

## Phase 3: Northstar UI Integration

- [ ] Replace simulated connection success with a real gateway health check.
- [ ] Keep the existing demo failure path for hosts containing `offline`, `invalid`, `fail`, or `404`.
- [ ] Show clear connection errors for refused ports, auth failures, and timeouts.
- [ ] Populate overview metrics from safe system commands.
- [ ] Wire the Tasks view to real process data.
- [ ] Keep terminal execution disabled until command permissions are explicit.
- [ ] Add loading, empty, and stale-data states for live server panels.

## Phase 4: Safe Admin Actions

- [ ] Define explicit allowed actions for updates, firewall, services, users, storage, and containers.
- [ ] Require confirmation for restart, shutdown, package install, firewall changes, and user changes.
- [ ] Log every admin action locally with timestamp, user, command id, and result.
- [ ] Prevent arbitrary shell input from reaching the gateway.
- [ ] Add per-action validation on the server side.

## Phase 5: Verification

- [ ] Test successful connection to the VirtualBox VM.
- [ ] Test failed connection with an offline VM.
- [ ] Test failed auth with an invalid username or key.
- [ ] Test mobile and desktop responsive layouts after live data is added.
- [ ] Run `npm run build`.
- [ ] Document the local VM setup in `README.md`.

## First Implementation Target

Build the smallest safe path first:

1. Add environment variables for `NORTHSTAR_SSH_HOST`, `NORTHSTAR_SSH_PORT`, and `NORTHSTAR_SSH_USER`.
2. Add a local server endpoint for `GET /api/server/health`.
3. Have that endpoint run one allowlisted health check through SSH.
4. Change the Connect button to call that endpoint before entering the dashboard.
