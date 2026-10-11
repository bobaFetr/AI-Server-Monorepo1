# Northstar repository review

Reviewed 2026-10-11.

## Current architecture

The repository implements a local SSH console, despite AGENTS.md describing a simulated prototype. README.md describes the implementation more accurately. The connection form authenticates through a POST server function; dashboard commands use a fixed allowlist; processes use an NDJSON POST stream; file browsing uses read-only SFTP; the terminal uses a development-only WebSocket bridge and real remote shell.

Useful existing safeguards include password-only authentication, host-key verification against OpenSSH known_hosts, loopback Vite binding, same-origin checks, production rejection, output/time limits, container-ID validation, and cleanup of streams and terminal sessions. The tests exercise real loopback SSH/SFTP handshakes rather than only mocking authentication.

## Changes made

- Clicking the selected dashboard view now preserves its output, timestamp, errors, and notices. The navigation exposes its current view to assistive technology.
- Process monitoring preserves the last successful timestamp during reconnects and interval changes, so old displayed output retains its sample age. Corrected status punctuation and the sampling message.
- SSH command output now uses separate incremental UTF-8 decoders for stdout and stderr. Previously a character split between network chunks could become replacement characters. Added fragmented Unicode output to the SSH integration regression test.
- Added npm test and typecheck scripts.

## Remaining findings

1. **Project intent needs alignment.** AGENTS.md specifies a front-end prototype without credential retention or unrestricted shell access, but the code intentionally implements both in-memory credentials and a real terminal. TASKS.md also describes already implemented work as pending and asks for simulated failures that no longer exist. Align these documents after deciding whether the product is a local console or a hosted demo; this review does not silently override the supplied project instructions.
2. **Production has no useful connection path.** The gateway correctly rejects production requests, but the form still invites users to connect. Provide a clear deployed landing state or an explicitly separate credential-free demo.
3. **HTTP peer restrictions are weaker than the terminal's.** Server-function and process guards validate URL hostname and Origin; the terminal additionally checks the socket peer address. Keep Vite bound to loopback. Before changing network topology, add and test a transport-level peer check for HTTP as well; browser Origin is not authentication for a network client.
4. **Reconnect freshness corrected in the follow-up review.** The process UI now explicitly shows that it is collecting a fresh sample until the replacement stream returns data, retaining the previous sample's age.
5. **Directory filtering is page-local.** This is documented correctly but can surprise users. Server-side directory search or a clear filtered-result count would improve navigation. Do not promise globally sorted results when each page is sorted independently.

## Local skills assessment

| Skill | Fit for Northstar |
| --- | --- |
| tanstack-start-server-functions | Applied to RPC boundaries and input validation. Existing inputValidator and server-only dynamic imports fit the guidance. |
| tanstack-start-api-routes | Applied to the process streaming HTTP route and response lifecycle. |
| tanstack-start-routes | Applied to route organization and the root document. |
| tanstack-start-project-setup | Applied to configuration and validation scripts. Its Vinxi/app.config.ts examples are older than this repository's Vite plugin setup; do not copy them over the working config. |
| tanstack-start-loaders | Useful for future routes. Keep credentials out of search parameters, loader cache data, and SSR hydration payloads. Current connection-dependent tools can remain client mounted. |
| tanstack-start-typesafe-routing | Useful when splitting tools into addressable routes; store only tool selection in the URL. |
| content-collections | Optional future documentation/runbook pages; unnecessary for the present dashboard. |
| netlify-forms-tanstack | Optional feedback forms. Never route SSH credentials or terminal input into Netlify Forms. References a base netlify-forms skill absent from the local skill folder. |
| tanstack-start-identity | Relevant only to a future hosted application. Account identity alone does not provide an SSH gateway or authorize remote operations; references a base skill absent from this folder. |

Official setup reference: https://tanstack.com/start/latest/docs/framework/react/build-from-scratch
The installed packages and successful typecheck/build remain the compatibility check for this repository.

## Suggested next work

1. Add connection diagnostics for host reachability, trusted host key, password authentication, and optional Docker/SFTP availability. Present a concrete recovery action for each failure.
2. Replace raw overview output with structured CPU, memory, disk, and uptime cards while retaining a raw-details panel. Use explicit units and last-success timestamps.
3. Add saved server profiles containing host, port, and username only. Ask for the password on each new session.
4. Add browser interaction coverage for tab reselect, process pause/resume, interval changes, file navigation, failed requests, and mobile layout. Existing backend tests do not establish visual or browser interaction correctness.
5. Add CI for test, typecheck, and build, then a real-VM smoke-test checklist. A loopback test SSH server does not validate Ubuntu permissions, procps versions, Docker access, or journal availability.

## Validation scope

### Follow-up fixes

- Programs now propagates DPKG command failures rather than masking them through a successful pipeline or optional package manager check. Shell-level tests cover installed-only filtering, optional managers, and DPKG failure.
- Process monitoring distinguishes a newly connecting stream from a stream returning live samples.
- Terminal reconnect is disabled during connection setup; closed/error messages immediately disable terminal input controls.
- Follow-up verification: 18 tests passed without skips, TypeScript passed, and the production build passed. Browser interactions and an actual Ubuntu VM remain unverified.

### Review after the visual task manager

- Added typed process-message validation, finite/range-checked timestamps, and a 1 MiB character limit for complete and incomplete browser-side stream messages. Malformed JSON no longer exposes parser excerpts in the displayed error.
- Added streaming UTF-8 regression coverage, including one-byte fragmentation and multiple messages in one chunk. Non-JSON HTTP errors now have a useful HTTP status message.
- Tightened top metric parsing: malformed, negative, overflowing, and inconsistent values remain unavailable; percentages no longer clamp impossible memory readings into a plausible 100%. Thread-mode summaries are supported.
- Added chart sample markers so isolated samples on either side of a pause remain visible.
- Close delayed SSH process channels if cancellation already completed, and make terminal server shutdown cleanup idempotent.
- Validate the process API JSON object before accessing its fields, avoiding internal TypeErrors on null requests.
- SFTP previews now omit an incomplete final UTF-8 character at the 64 KB limit instead of showing a replacement character. Tested through the loopback SFTP server.
- Verification: 26 tests pass without skips; TypeScript and diff whitespace checks pass. Production build result is reported in chat. Real-VM and browser interaction checks remain outstanding.

### Visual task manager accuracy audit

- CPU now reports execution (us + sy + ni + hi + si), excluding I/O wait and VM steal. Complete CPU categories must sum to 100% within top's per-field rounding tolerance; inconsistent summaries show unavailable.
- Both process commands force summary memory scaling to KiB with `-E k`, reducing percentage error from rounded GiB values. RAM still deliberately follows the installed top version's used/total definition.
- Counts identify Threads when thread-mode output is received.
- Charts render the first real sample, identify a missing latest metric rather than calling a previous value current, and expose timestamp/value tooltips for recorded points.
- Stream integration coverage now replays full top summaries split across SSH chunks and verifies both raw output and CPU/RAM values from the delivered frames. Additional cases test I/O-bound and VM steal scenarios.
- 28 tests pass without skips; typecheck and production build pass. These controlled checks do not establish agreement with the user's real VM at an identical sampling instant. CPU categories are rounded by top and displayed to one decimal; separately running tools use different sampling windows.

### History refresh correction

Replaced repeatedly restarted top processes with one line-buffered continuous top
process per monitor. Frame boundaries are detected across SSH chunks; the first
lifetime-average frame is discarded. Later complete frames are published at the
chosen interval, timestamped when their header arrived rather than when published.
Completion requires the following header, adding one interval of display latency;
initial collection takes two intervals. History charts now use explicitly labelled
automatic percentage ranges so small changes are visible without inventing movement.
Tests include one-second SSH frame delivery and bounded scales for low/constant values.

### Sampling option review

Fixed the stale-data threshold to allow the normal one-frame completion delay at
all four intervals: normal sample age can reach twice the selected interval.
The SSH sample deadline now restarts after authentication and the first header,
so setup time does not consume the first sample's timeout budget. A bounded queue
allows up to four frames, preventing a normal small batch of SSH data from closing
an otherwise healthy stream. Tests exercise actual timed 1/2/3/5-second fixture
delivery, normal/stale ages for each option, buffered frames, and abort cleanup.
These are loopback SSH fixtures; no real Ubuntu VM or browser timing was measured.

### Rolling history display

All three history charts now share a fixed 60-second window ending at the latest
sample. Earlier samples move left at each update and expire rather than compressing
an accumulating history into the chart. Removed all point markers. Pause freezes
the displayed window; resuming expires samples outside the new window. Targeted
tests verify identical duration and movement at 1/2/3/5-second intervals, expiration,
and scale behavior. Four targeted tests, TypeScript, and production build passed.

### Delayed-data status

The earlier age-based warning combined normal frame-completion delay with time
waiting for the next update. It could flicker for a regularly arriving, slower stream.
The status now distinguishes silence since receipt from completion latency, using
monotonic clocks on each side. Backend messages include validated completionDelayMs;
older messages remain compatible. Old completed frames and true update stalls remain
delayed. Real-server checks at 1/3/5 seconds stayed healthy through nine samples;
42 automated tests, TypeScript, and build pass.

The existing 15 tests passed before changes, TypeScript passed, and the production build completed with dependency unused-import warnings. Final verification is reported in the chat. No real Ubuntu VM or browser visual checks were performed. Generated deployment files remain ignored.
