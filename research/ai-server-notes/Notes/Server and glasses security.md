# Server and glasses security

_Threat-model and hardening snapshot: 2026-08-21; last audited: 2026-08-22_

## Security objective

Protect the wearer, captured data, device credentials, server, database, and local network even when:

- the glasses or pocket companion are lost or stolen;
- the Wi-Fi network is hostile or misconfigured;
- an attacker discovers the API address;
- an image, prompt, model response, or database record is malicious;
- a normal device tries to access another device's information;
- Ollama, PostgreSQL, or the C# service fails;
- a software update is interrupted or compromised.

The system handles camera images, microphone audio, location, gaze-derived interaction, conversations, device state, and potentially navigation. These are sensitive data. Security and privacy are product requirements, not final-stage additions.

## Architecture and trust boundaries

The intended product path is:

```text
UNTRUSTED PHYSICAL ENVIRONMENT
        │ camera, microphone, buttons, sensors
        ▼
GLASSES / PYTHON COMPANION
        │ per-device authenticated TLS
        ▼
C# API SECURITY BOUNDARY
        ├── validates requests and authorizes device/user
        ├── reads/writes PostgreSQL
        └── sends bounded prompts/images to loopback Ollama
                     │
                     ▼
               UNTRUSTED AI OUTPUT
```

Important rules:

1. The glasses and Python agent are clients, not trusted administrators.
2. C# is the only public gateway to Ollama and PostgreSQL.
3. PostgreSQL and Ollama must not be exposed directly to the glasses LAN.
4. Model output is untrusted content, never authorization.
5. Possession of one device must not grant access to another device's records.
6. Loss of the glasses must not grant server power-control access.

The development repository also has an ARGUS server-side proxy that sends selected images directly to C#. That is acceptable for UI development, but the physical product path should use the Python device agent and per-device identity.

## Threat model

| Threat | Example | Impact | Required protection |
|---|---|---|---|
| Lost or stolen companion | Attacker removes the Pi SD card | API credential and queued images stolen | Encrypted storage, revocable per-device credentials, short token lifetime |
| LAN interception | Hostile access point observes or changes traffic | Images/prompts disclosed or modified | TLS with valid server verification; no routine `--insecure` |
| Device impersonation | Shared API key copied from one unit | Unauthorized inference and record access | Pairing, unique device key/certificate, rotation and revocation |
| Replay | Captured valid request is resent | Duplicate jobs, data, or actions | Request ID, timestamp/nonce, idempotency record, expiry window |
| Broken object authorization | Device requests another conversation ID | Cross-user privacy breach | Ownership check on every object and query |
| Resource exhaustion | Repeated 5 MiB images and long prompts | RAM, GPU, disk, or queue exhaustion | Size/time/output limits, per-device quotas, bounded queue and retention |
| Malicious image | Decoder exploit or decompression attack | Server compromise or denial of service | Patched decoder, type/dimension limits, sandboxing and fuzz tests |
| Prompt injection | Scene text tells AI to reveal data or run actions | Unsafe or misleading response | No secrets/tools in model context; deterministic authorization outside AI |
| Malicious model output | AI returns commands, HTML, or false certainty | User harm or injection into another component | Treat as text, encode output, confirm actions, show uncertainty |
| Database theft | Disk or backup is copied | Long-term exposure of user history | Encryption, least privilege, retention, protected backups |
| Server takeover | Weak SSH, old packages, leaked admin key | Full data and service compromise | SSH keys, firewall, patching, service isolation, monitoring |
| Supply-chain compromise | Malicious dependency or update | Device/server code execution | Locked dependencies, trusted repositories, signed releases, SBOM/scanning |
| Sensor abuse | Camera/mic records without clear indication | Severe privacy violation | Physical shutter/mute, hardware-linked indicator, consent and retention controls |

OWASP identifies broken object authorization, broken authentication, broken property/function authorization, and unrestricted resource consumption as leading API risks. These directly apply to device records, conversations, inference jobs, image uploads, and administrator routes ([OWASP API Security Top 10](https://owasp.org/API-Security/editions/2023/en/0x11-t10/)). NIST's IoT baseline emphasizes device identification, configuration, data protection, logical access, secure software update, and cybersecurity-state awareness ([NIST IoT capability catalog](https://pages.nist.gov/IoT-Device-Cybersecurity-Requirement-Catalogs/), [NIST IR 8259 Rev. 1](https://csrc.nist.gov/pubs/ir/8259/r1/final)).

## Current protections in the repository

The C# prototype already provides useful foundations:

- standard and separate administrator API keys;
- fail-closed behavior when a required key is empty;
- fixed-time comparison of SHA-256 key digests;
- one required key-header value rather than accepting ambiguous duplicates;
- standard per-IP rate limit of 30 requests/minute;
- separate power-route rate limit of 5 requests/minute;
- disabled-by-default restart and shutdown;
- Linux-only guarded power execution and bounded command timeout;
- maximum whole request and image byte sizes;
- JPEG/WebP signature and decoder validation;
- maximum 1920×1080 decoded dimensions;
- EXIF, ICC, and XMP removal followed by re-encoding;
- maximum 1,000-character prompt and UUID request ID validation;
- bounded inference concurrency and Ollama timeout;
- the C# Ollama client targets `127.0.0.1:11434` by default; this does not configure or enforce Ollama's own listening address;
- server-side ARGUS proxy keeps the C# API key out of browser JavaScript;
- logs use structured parameters instead of string-built commands.

These controls reduce obvious abuse, but they are prototype controls. A shared API key authenticates possession of a secret; it does not provide device identity, user ownership, replay resistance, or fine-grained authorization.

## Current weaknesses and corrections

### 1. Shared, long-lived API keys

All normal clients use the same configured `Authentication:ApiKey`. If one companion is compromised, every device credential must be replaced.

Required migration:

```text
initial physical pairing
→ unique device identity
→ device-specific credential or client certificate
→ short-lived access token
→ server-side revoke/rotate capability
```

For an early prototype, a random 256-bit per-device secret stored as a hash/credential verifier is acceptable if TLS, rotation, and revocation exist. For stronger deployment, use mutual TLS or a hardware-backed private key. ASP.NET Core supports client-certificate authentication at the TLS layer and validates certificate chains, validity, and intended use; proxy termination requires particularly careful handling ([Microsoft certificate-authentication guidance](https://learn.microsoft.com/en-us/aspnet/core/security/authentication/certauth?view=aspnetcore-10.0)).

Never provision the administrator key to wearable devices.

### 2. Transport security

The project permits HTTP during development, and both Python clients offer `--insecure`. That option disables certificate validation and makes man-in-the-middle attacks possible.

Rules:

- use HTTP only on an isolated development machine;
- use TLS on the LAN for real devices;
- install a trusted local CA or pin an appropriate server public key/certificate;
- never ship routine production instructions using `--insecure`;
- reject expired, wrong-host, or untrusted certificates;
- keep clocks synchronized so certificate and token expiry work;
- do not expose ports 5000/5024/7020 directly to the internet.

HSTS and HTTPS redirection are not substitutes for correctly configuring Kestrel or a trusted reverse proxy to terminate TLS.

### 3. Reverse proxy and IP rate limiting

Rate limits are partitioned by `RemoteIpAddress`. Behind a proxy, all devices may appear to use the proxy address, or untrusted forwarded headers may spoof addresses if configured carelessly.

Required controls:

- explicitly configure known proxy addresses and forwarded headers;
- do not trust forwarded headers from arbitrary LAN clients;
- rate-limit primarily by authenticated device ID/user, with IP as a secondary signal;
- use separate policies for inference, telemetry, pairing, login, and administration;
- record safe security events when quotas are exceeded.

`AllowedHosts` is currently `*`. Set expected host names in deployment as defense in depth, but do not treat Host filtering as authentication or a firewall.

### 4. Replay and idempotency

The vision endpoint validates a UUID but does not persist it or reject reuse. A captured request can be replayed.

For every write or inference request, include:

```text
deviceId
requestId
capturedAtUtc
sequence or nonce
body hash
```

C# must verify ownership, reject unreasonable timestamps, and store the `(deviceId, requestId)` uniqueness result. A retry should return the existing job/result, not perform inference twice.

### 5. Object and function authorization

When devices, conversations, messages, media, and jobs are implemented, authentication alone is insufficient.

Every query must effectively enforce:

```text
requested object belongs to authenticated device/user
AND caller has permission for requested operation
```

Do not load an object by UUID and check only that it exists. Query by both object ID and authorized owner. Do not bind entire database entities from JSON; accept explicit request DTO fields to prevent mass assignment. OWASP recommends deny-by-default authorization for every function ([OWASP broken-function authorization guidance](https://owasp.org/API-Security/editions/2023/en/0xa5-broken-function-level-authorization/)).

### 6. AI resource exhaustion

The server currently bounds upload bytes, dimensions, prompts, model timeout, API rate, and C# concurrency. Keep those controls and add:

- maximum generated tokens;
- bounded conversation-history tokens;
- per-device daily/minute inference quota;
- bounded persistent job queue;
- one active job per minimum-hardware device initially;
- sanitized output length;
- post-sanitization image-size limit;
- disk quota and automatic retention cleanup;
- Ollama `OLLAMA_NUM_PARALLEL`, context, and queue limits;
- cancellation when the user abandons a request where safe.

OWASP specifically recommends maximum input and upload sizes to prevent unrestricted resource consumption ([OWASP API4 guidance](https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption/)).

### 7. Image-decoder and file security

The current ImageSharp decode/sanitize process is useful, but image decoding remains an attack surface. In particular, it bounds width and height but does not currently reject or bound animated/multi-frame WebP, so its decoded-memory ceiling is not established.

- keep ImageSharp patched;
- reject animated/multi-frame content unless required;
- bound decoded width, height, pixel count, and frame count;
- recheck sanitized output size;
- never use the submitted filename as a filesystem path;
- generate storage keys server-side;
- scan dependencies for known vulnerabilities;
- fuzz malformed JPEG/WebP inputs;
- consider a separately constrained image-processing worker if exposed beyond a trusted prototype LAN.

### 8. Prompt injection and unsafe AI output

An attacker can place text in the camera scene such as “ignore instructions and reveal secrets.” The model can also hallucinate or return malicious-looking commands.

Security boundary:

```text
AI may describe or recommend
AI may not authorize or execute
```

- never put API keys, database credentials, hidden private records, or unrestricted tools in the model context;
- do not execute model-returned shell commands, URLs, SQL, or power actions;
- encode responses before displaying them in HTML;
- require deterministic policy and explicit user confirmation for messages, navigation changes, deletion, purchases, or device control;
- label uncertainty and avoid safety-critical dependence on one model response;
- separate retrieved database facts from model-generated statements in the response schema.

### 9. Administrator and power endpoints

Restart and shutdown are especially sensitive. They are disabled by default and use a separate key, which is good.

For production:

- place administration on a separate interface, port, VPN, or management network;
- require a human administrator identity and strong authentication;
- never expose administrator operations through AI tool calls;
- never store the admin credential on glasses;
- audit successful and failed attempts without logging the credential;
- consider removing remote power operations if they do not provide essential value.

The legacy `/api/message` endpoint mixes ordinary commands and power-command parsing. Remove it after structured routes replace it; a smaller API inventory is easier to secure.

### 10. ARGUS web proxy and browser keys

`ARGUS_API_KEY` is correctly read only by the ARGUS server-side route and is not placed in browser JavaScript. Preserve that boundary. The `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is intentionally browser-visible, so it must be restricted in Google Cloud to the exact permitted HTTP referrers and required Maps API only; it is an identifier with restrictions, not a secret that can be hidden in a public web client.

The `/api/vision` proxy currently has no browser-user authentication or anti-CSRF mechanism. If ARGUS is reachable by other machines or a browser visits a malicious site, cross-origin requests may be able to consume local inference resources even when the attacker cannot read the response. Before exposing ARGUS beyond localhost:

- require an authenticated user session or device-bound local authorization;
- validate `Origin`/same-site expectations and use an anti-CSRF design where cookies are used;
- set strict SameSite, Secure, and HttpOnly cookie attributes;
- configure a Content Security Policy that allows only required resources and the intended Google Maps frame origin;
- set explicit frame-ancestor protection for ARGUS itself;
- keep the upstream C# API key server-side;
- apply proxy-side upload, request-rate, and timeout limits in addition to C# limits.

## Glasses and Python companion security

### Physical loss

Assume an attacker can hold the companion, read removable storage, access USB/debug interfaces, and attempt offline credential extraction.

Minimum protections:

- unique device credential, immediately revocable from the server;
- encrypted companion storage where supported;
- no administrator or database credentials;
- minimum offline retention;
- encrypted local SQLite queue or encrypted sensitive fields;
- automatic lock/credential invalidation policy after reported loss;
- do not display old private answers without wearer authentication;
- disable unused serial consoles, debug services, Bluetooth profiles, USB gadget modes, and listening ports.

Full-disk encryption on a headless Pi creates boot-key-management challenges. A TPM/secure element or phone companion can protect keys better than a secret stored beside encrypted data on the same SD card. If hardware-backed storage is unavailable, acknowledge that a determined attacker with the device may extract long-lived credentials; short lifetime and rapid revocation then become essential.

### Least privilege

Run the Python agent as a dedicated non-root user. Grant only the exact camera, audio, GPIO/I²C, and network permissions it needs. Do not solve permission problems by running the full agent as root.

Split high-risk functions where practical:

```text
small privileged hardware helper
        ↕ narrow local interface
unprivileged Python network/application agent
```

Use a hardened `systemd` unit with filesystem, device, capability, namespace, and syscall restrictions appropriate to the hardware libraries. Bind any local UI API to loopback or a Unix socket and authenticate it if other local users/processes are possible.

### Camera and microphone privacy

- physical camera shutter for later hardware;
- physical microphone mute or power isolation where possible;
- capture indicator driven close to the sensor power path so normal software cannot silently fake “off”;
- visible/on-lens indication during camera or microphone use;
- push-to-capture and push-to-talk before wake-word/background capture;
- no continuous upload by default;
- immediate local cancellation;
- clear retention and deletion controls;
- never log raw audio, images, full prompts, or gaze by default.

### Updates and boot integrity

NIST treats secure software update and cybersecurity-state awareness as baseline IoT capabilities. The companion needs:

- authenticated, integrity-checked updates;
- version and update status reporting;
- rollback or A/B update strategy;
- recovery from interrupted update;
- supported OS and dependency security updates;
- a defined support and end-of-life period;
- read-only/root filesystem hardening only after updates and persistence paths are designed;
- secure boot or measured boot when the chosen hardware supports a trustworthy implementation.

Do not download and execute arbitrary Python files as an update mechanism.

### Wi-Fi and Bluetooth

- use WPA2/WPA3 with a unique strong network credential;
- do not automatically join arbitrary open networks;
- treat LAN peers as untrusted even on home Wi-Fi;
- remove forgotten networks when ownership changes;
- keep Bluetooth undiscoverable except during explicit pairing;
- use authenticated BLE pairing for controls; do not send images or secrets in clear custom characteristics;
- disable unused radios and services.

## Server and Linux host security

### Network exposure

Recommended firewall policy:

```text
LAN/VPN → TLS reverse proxy or Kestrel API port only
admin workstation/VPN → SSH and management endpoint
localhost only → PostgreSQL and Ollama
internet → no direct inbound service
```

Use router DHCP reservation, but do not confuse a stable address with access control. Segment the glasses/IoT network from trusted personal devices where practical. Restrict outbound traffic from server services to what they need.

Ollama binds to `127.0.0.1:11434` by default; keep it there. Changing `OLLAMA_HOST` can expose it to the network, so do not do that unless a separately authenticated proxy and firewall are deliberately designed ([Ollama networking FAQ](https://docs.ollama.com/faq)).

### SSH and accounts

- disable root SSH login;
- use SSH keys, not reusable passwords;
- disable password authentication after recovery access is tested;
- use a non-root deployment account and separate service users;
- limit `sudo` to exact administrative needs;
- remove unused accounts and packages;
- protect and rotate recovery keys;
- do not give the C# service unrestricted `sudo`.

If power operations remain enabled, grant only the exact shutdown command/arguments through a carefully reviewed mechanism. Never grant passwordless unrestricted shell execution.

### Secrets

The checked-in `appsettings.json` correctly contains empty keys. Keep real secrets out of Git, logs, screenshots, shell history, and client bundles.

Environment variables are better than committed secrets but are not encrypted storage and can be exposed after process or host compromise. Microsoft explicitly warns that environment variables are commonly plain text ([ASP.NET Core secret-storage guidance](https://learn.microsoft.com/en-us/aspnet/core/security/app-secrets?view=aspnetcore-10.0)). For deployment, prefer:

- a root/service-readable credentials file with strict permissions;
- `systemd` credentials;
- a dedicated secrets manager;
- hardware-backed key storage where available.

Implement rotation without rebuilding the application. Keep separate development, test, and production credentials.

### Service isolation and patching

- separate Unix users for C#, PostgreSQL, Ollama, reverse proxy, and ARGUS UI;
- restrict file access between services;
- patch Ubuntu, .NET, Node, Python dependencies, ImageSharp, PostgreSQL, GPU driver, and Ollama;
- use lockfiles and review dependency updates;
- avoid mounting Docker control sockets into application containers;
- configure service restart limits so a crash loop cannot consume the machine;
- monitor disk, memory, GPU memory, temperatures, queue depth, and failed authentication;
- preserve sufficient logs for investigation without collecting sensitive content.

## PostgreSQL security

PostgreSQL is planned but not implemented. Secure defaults must be part of its first migration, not added after data exists.

### Connection security

- bind to localhost or a private database socket;
- block the database port at the host firewall;
- use a dedicated application role with no superuser, role creation, or database creation rights;
- use a separate migration role not available to the running API;
- prefer peer authentication on a local Unix socket or SCRAM-SHA-256 for password authentication;
- never use `trust` for a reachable production connection.

PostgreSQL documents that `trust` allows any connecting party to log in as any PostgreSQL user, while `scram-sha-256` verifies a password using SCRAM ([PostgreSQL `pg_hba.conf` documentation](https://www.postgresql.org/docs/current/auth-pg-hba-conf.html)).

### Authorization and data isolation

- include owner/device/user constraints in every application query;
- use foreign keys and unique `(device_id, request_id)` constraints;
- expose explicit DTOs rather than database entities;
- consider row-level security as defense in depth, not a replacement for application authorization;
- separate administrator reporting from device APIs;
- test cross-device access attempts automatically.

### Data protection and retention

Classify data before storing it:

| Data | Default handling |
|---|---|
| Device identity/state | Store only required operational fields |
| Conversation text | User-visible retention and deletion policy |
| Images/audio | Delete after inference by default unless user explicitly enables history |
| Media metadata/hash | Retain only as long as operationally required |
| Telemetry | Downsample and expire automatically |
| Raw gaze | Do not store by default |
| Derived gaze action | Store minimally if needed for interaction history |
| Credentials | Store verifier/hash or public certificate, never recoverable plaintext where avoidable |

Encrypt host disks and backup destinations. Application-level encryption may be appropriate for especially sensitive fields, but key storage must be separated from the data. Backups must have the same or stronger protection and retention as the live database. Test restoration and deletion behavior.

## Logging, monitoring, and incident response

Log security-relevant metadata:

- device ID and request/correlation ID;
- endpoint, result status, latency, and byte size;
- authentication failures and credential revocation;
- rate-limit and queue rejection;
- power-operation attempts;
- configuration/readiness failures;
- software version and update result;
- unusual restart, clock, storage, or integrity state.

Do not log:

- API keys, tokens, certificates' private material, or database passwords;
- raw images/audio/gaze;
- full prompts and AI answers by default;
- multipart bodies or authorization headers;
- sensitive location beyond operational need.

Protect logs from modification and uncontrolled reading. Define alerts for repeated authentication failure, unexpected admin calls, sudden inference volume, disk growth, and service exposure.

Incident-response essentials:

1. Revoke one device without rotating all devices.
2. Rotate server, database, and administrator credentials.
3. Identify affected records by device/request/time.
4. Disable inference or uploads without losing health visibility.
5. Restore the database from a verified backup.
6. Notify the user about exposed retained media or conversations.
7. Securely decommission a device and delete its credentials/data.

## Priority implementation plan

### Before connecting physical glasses

1. Use validated TLS without `--insecure`.
2. Create unique per-device credentials and a revocation table.
3. Ensure wearable credentials cannot access power routes.
4. Set C# and Ollama concurrency/context limits.
5. Run Python as a dedicated non-root service user.
6. Keep Ollama and PostgreSQL on loopback.
7. Add physical capture/microphone indication.
8. Stop logging command/prompt contents that may be sensitive.

### Before multiple devices

1. Implement pairing and short-lived tokens or mutual TLS.
2. Enforce ownership on every resource.
3. Persist idempotency and replay protection.
4. Rate-limit by device and endpoint class.
5. Add bounded persistent inference jobs.
6. Add PostgreSQL least-privilege roles, migrations, retention, and backups.
7. Add cross-device authorization tests.
8. Configure trusted proxy handling explicitly.

### Before use outside a controlled LAN

1. Commission a professional penetration test and privacy review.
2. Implement signed/recoverable device updates and vulnerability response.
3. Use hardware-backed device keys where practical.
4. Segment the IoT network and require VPN for administration.
5. Implement incident response, audit retention, deletion, and device decommissioning.
6. Review applicable privacy, biometric, recording, radio, and product-security obligations for deployment regions.

## Security acceptance tests

- Missing keys make protected endpoints fail closed.
- Standard device credentials cannot call restart/shutdown.
- Expired, revoked, wrong-device, and malformed credentials fail.
- Reusing `(deviceId, requestId)` does not repeat inference or database writes.
- Device A cannot read/update/delete Device B's state, jobs, media, or conversations.
- HTTP, invalid certificate, wrong hostname, and `--insecure` production configurations are rejected.
- Duplicate auth headers are rejected.
- Oversized bodies, dimensions, prompts, output, contexts, and queue depth are rejected.
- Malformed JPEG/WebP corpus does not crash or exhaust the server.
- Model output containing HTML, commands, URLs, or tool instructions remains inert text.
- Ollama and PostgreSQL cannot be reached from the glasses network.
- Proxy spoofing does not change the trusted client identity.
- Lost-device credential can be revoked without affecting other devices.
- Interrupted companion update safely boots the previous or recovery version.
- Database backup is encrypted, restorable, and subject to deletion policy.

## Final assessment

The current C# prototype is security-aware and better protected than a typical early project, particularly around fail-closed keys, image validation, bounded inference, and guarded power actions. Its largest security limitation is the shared-secret model: it protects an endpoint but does not establish individual device/user ownership.

The highest-priority security architecture is therefore:

```text
unique revocable device identity
+ validated TLS
+ least-privilege Python agent
+ per-object authorization in C#
+ bounded AI resources
+ minimal encrypted retention
+ secure updates and visible sensor state
```

Do not expose the current prototype to the public internet. Keep it on a controlled LAN while per-device identity, persistence authorization, replay protection, secure updates, and incident recovery are implemented and tested.
