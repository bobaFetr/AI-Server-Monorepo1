# Real-server verification

Read-only verification on 2026-10-11 using the supplied server account. Passwords
were supplied in memory only; no credentials were written to verification files.
Host-key verification used the existing trusted OpenSSH known_hosts entry.

The tested host reported Linux 7.0.0-34-generic and procps-ng 4.0.4.
Tests loaded the actual repository SSH, streaming, metric parsing, and SFTP source.
No browser was available in this session; this does not validate the rendered UI,
local RPC integration, interactive terminal, or visual animation.

## Timing observations

Three completed samples per interval were received and parsed. Timings below are
the two gaps between those samples, not a long-term latency or reliability benchmark.

| Requested interval | Initial observed gaps | Repeated observed gaps |
| --- | --- | --- |
| 1 s | 2.506 / 2.138 s | 1.039 / 1.069 s |
| 2 s | 2.241 / 2.409 s | 2.014 / 2.013 s |
| 3 s | 3.017 / 3.014 s | Not repeated |
| 5 s | 5.017 / 5.022 s | Not repeated |

A separate direct top command also showed irregular 1–2 second header spacing at
the 1-second setting. The delay was not consistently reproduced. These observations
do not isolate VM scheduling, remote collection overhead, or network latency as the
sole cause. Northstar now shows the last actual arrival interval beside the requested
interval, making slower updates visible rather than presenting the requested rate as
a measured guarantee.

All process samples yielded CPU, RAM, I/O-wait, task, cache, swap, and load metrics.
CPU varied approximately 0.2–0.9%; RAM was approximately 18.2–18.4% during the checks;
I/O wait was often 0% and occasionally 0.1–0.2%. Flat traces are expected for unchanged
measurements. Stream cancellation released each monitor exactly once.

## Other tools

Overview, Programs, Storage, Services, Journal, and container listing succeeded.
Programs returned 766 output lines (including headings), not a claim of 766 apps.
SFTP root listing returned 22 entries; read-only preview of /etc/os-release succeeded.
No package installations, file edits, container mutations, or sudo commands were run.

The temporary verification harness was removed after testing.

## Extended verification through the running application

The local development server was available during the follow-up. Tests used its
actual TanStack RPC endpoints, /api/processes HTTP route, and /api/terminal WebSocket
endpoint. This extends the earlier direct-library checks; a browser remained unavailable.

Passed against the real server:

- Overview, Programs, Storage, Services, Journal, Containers, and the one-off Processes RPC.
- Rejection of unsupported operations, invalid container IDs, invalid port, empty password,
  relative file paths and negative pagination offsets; cross-origin and wrong-method requests.
- One intentionally incorrect password was rejected, followed by successful valid login.
- Root/Home/etc listings, hidden files, symlink resolution, text preview, binary detection,
  large-file truncation, and refresh. Two /usr/bin pages had 400 unique entries.
- Expected permission denial for /root, missing-path error, and refusal to read /dev/null.
- Process API invalid/null requests, stream start, cancellation, reconnect, and capacity:
  four monitors accepted, two excess requests rejected, capacity restored after cancellation.
- Real terminal PTY login, command input/output, resize to 120x40, Ctrl+C interruption,
  Tab completion, Cyrillic/Japanese text, shell exit, and a second successful session.
- Terminal cross-origin rejection and socket capacity: four accepted, fifth rejected,
  successful reconnect after closing. Capacity checks did not open remote shells.

Diagnostic shell sessions disabled bash history persistence before commands were run.
Temporary sleep processes used for Ctrl+C checks were interrupted. No real container
was started, stopped, restarted, removed, or otherwise changed. Container actions are
covered by a loopback SSH fixture using the same command construction as the gateway;
this verifies command validation and error propagation, not real Docker mutations or
their browser confirmation buttons.

Unverified: browser rendering, keyboard focus, responsive layout, click-driven navigation,
and confirmation dialogs. Their backend operations are covered above; no blanket claim
that every UI interaction was exercised is made.

Final checks: 39 automated tests passed without skips, TypeScript passed, production
build passed, and 13 gateway checks passed again after extracting the shared validated
command builder for Docker fixture coverage. No functional failure remained in the
real-server checks listed above. Temporary harness files were removed and the password
was absent from the repository files checked after testing.

## Delayed-data correction

Separated frame completion latency from elapsed time since the browser received a
sample. Freshness now uses browser monotonic time and server-measured monotonic
completion delay, avoiding cross-machine clock comparisons and false warning flicker
while completed samples continue arriving normally. Truly silent streams and abnormally
old completed frames still show delay.

Real HTTP process streams were checked again with three samples each at 1, 3, and
5 seconds. Observed gaps were 1.013–1.301 s, 3.016–3.029 s, and 5.030–5.037 s respectively.
The revised freshness calculation reported no delay before or after these updates.
Tests cover regular slower 1-second arrivals, old frames, interrupted streams, delay
field validation, and all four configured intervals. All 42 automated tests, TypeScript,
and production build passed. Browser rendering remains unverified.

## Shared Bash history

Configured shared history for the supplied Linux user's Bash sessions as requested.
Installed the repository script at ~/.config/northstar/history-sync.bash and sourced
it from ~/.bashrc. Existing finite default history limits were changed to unlimited;
duplicate and leading-space commands are retained. Existing prompt hooks are preserved.

Backups on the server:

- /home/vboxuser/.bashrc.northstar-backup.U3ZQ3v
- /home/vboxuser/.bash_history.northstar-backup.MNNOVm

A real Northstar WebSocket terminal and a separate SSH Bash PTY were open together.
Verified existing saved history appears in Northstar, a Northstar command appears in
the other session, and a command from the other session appears in Northstar after
refreshing its prompt. The old history file remained an unchanged prefix of the updated
file. Only benign printf/history diagnostic commands were added for this check.

Already-open terminals must run source ~/.bashrc once or reconnect. At an idle prompt,
Enter imports the other session's newly saved commands. This shares history for the
same user and Bash; other accounts and shells are separate. Previously discarded or
unsaved commands cannot be retroactively recovered from the saved file.

Follow-up VirtualBox console inspection: the console is vboxuser's Bash on tty1,
started at 14:34 on the server. The current .profile sources .bashrc, and .bashrc
sources the shared-history script. The process start time does not establish whether
the user has subsequently sourced the new config. To apply it deterministically in
that existing console, run `source ~/.bashrc; _northstar_history_sync; history` there.
Configuration files and SSH sessions cannot directly update another already-running
Bash process's in-memory history or prompt hooks.

# Overview disk analyzer verification

Read-only tests through the actual local server-function endpoint succeeded for
`/`, the SSH user's home directory, `/etc`, and `/etc/os-release` (resolved regular
file). The complete root traversal returned 17 immediate entries in about 14.4
seconds, with permission restrictions correctly marked partial rather than hidden.
Home returned 23 entries without a partial flag. Filesystem capacity was about
42.76 GB total and 10.73 GB used (decimal bytes); the UI formats binary units.
An intentionally short two-second read-only scan reproduced GNU du being killed
mid-record. The parser now preserves complete records and rejects/discards the
unfinished suffix appropriately. Regression tests cover this, hierarchy, filenames
containing tabs/newlines, shell quoting, malformed paths/sizes and ring geometry.
TypeScript, all 48 automated tests, and production build passed. Browser visual
inspection was unavailable in this session; responsive styles and accessibility
controls were implemented but are not claimed to have been visually verified.
