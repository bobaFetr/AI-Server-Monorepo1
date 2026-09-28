# Northstar Server Console

Local Ubuntu VM management through password-authenticated SSH.

## Start locally

```powershell
npm.cmd install
npm.cmd run dev
```

Open http://127.0.0.1:3000. Enter the VM host, SSH port, Ubuntu username,
and that user's password. The dashboard opens only after the VM accepts the
password and the overview command succeeds. Incorrect credentials fail the connection.
There is no SSH-key fallback or simulated connection mode.

## Prepare the VM

1. Install OpenSSH in Ubuntu: `sudo apt install openssh-server`.
2. Ensure SSH password authentication is enabled for your Ubuntu user. Accounts
   requiring keyboard-interactive/MFA authentication are not supported by this version.
3. Use the VM's reachable host-only/bridged IP and port 22, or configure NAT forwarding
   from host `127.0.0.1:2222` to guest port `22`.
4. Connect once from PowerShell with `ssh -p 2222 ubuntu@127.0.0.1`, replacing the
   coordinates as needed. Verify the host fingerprint against the VM console before
   accepting it. `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub` shows the VM's
   ED25519 fingerprint. Northstar verifies host keys against this Windows user's
   default `~/.ssh/known_hosts`, using the installed OpenSSH `ssh-keygen` command.
5. Enter those same coordinates and the Ubuntu user's password in Northstar.

## Live tools

System overview, processes, storage, running services, journal, Docker listing,
and confirmed container start/stop/restart by ID. The Processes view refreshes continuously using one-second top CPU samples plus SSH connection time; other views refresh on demand. Process updates can be paused, stop when you leave the view, and stop on errors until you resume.
Docker operations require existing Docker permissions for the Ubuntu user.
Northstar does not invoke sudo. Interactive terminal, file editing, firewall changes,
user administration, and package installation are not implemented.

## Password handling and local scope

The password travels to the loopback backend in a POST request and is used by the
SSH library over the encrypted SSH connection. It is never placed in command-line
arguments, written to files, logged, or saved to browser storage by the app. It remains
in browser memory while connected so later operations can authenticate, and is cleared
on a failed connection or Disconnect. Each operation reauthenticates with the supplied
password. Reloading the page requires signing in again.

The gateway accepts same-origin requests on the loopback development server only;
production builds disable remote management. Do not expose the development server
through a tunnel or reverse proxy. Commands are allowlisted and have time/output limits.

## Checks

```powershell
node --experimental-strip-types --test tests/ssh-input.test.mjs tests/password-ssh.test.mjs
node node_modules/typescript/bin/tsc --noEmit
npm.cmd run build
```

The SSH integration test starts a temporary loopback SSH server and verifies correct
passwords, rejected passwords/users, rejected host keys, and no key/agent fallback.
It does not test your actual VM.
