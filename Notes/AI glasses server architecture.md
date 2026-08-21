# AI glasses server architecture

_Research and design snapshot: 2026-08-20_

## Goal and current state

Build glasses that capture a scene and user input, pass them through a Python device agent to an ASP.NET Core server, and receive an answer from a local multimodal LLM. The glasses need a menu, battery and connection indicators, eye-gaze input, and safe offline/reconnect behavior. PostgreSQL is planned to store devices, conversations, messages, telemetry, jobs, and image metadata.

The .NET 10 prototype already has API/admin-key middleware, per-IP rate limits, health/readiness, diagnostics, guarded Linux power operations, a legacy text-command endpoint, validated JPEG/WebP upload, synchronous Ollama vision inference, and a dependency-free Python CLI. `GlassesUI/` provides an interactive React interface prototype with two lenses, lens-contained simulated telemetry, a hamburger menu, and a spring-return targeting reticle. Its server-side proxy can send a user-selected JPEG/WebP image to the C# vision endpoint when configured, but the UI is not connected to physical hardware or the Python device agent. PostgreSQL/CRUD, device identities, persistent job queues, live telemetry, SignalR events, and conversations remain unimplemented. Current readiness only checks key configuration, not the database, model, storage, or queue.

## Recommended architecture

```text
Glasses hardware / glasses OS
 camera + display + battery + eye tracker
                    |
                    | local device APIs
                    v
Python device agent
 capture, compress, queue, retry, telemetry
                    |
                    | HTTPS REST: commands/images/CRUD
                    | SignalR: live status and answers
                    v
ASP.NET Core gateway/orchestrator
 auth, validation, sessions, jobs, status
          |                         |
          v                         v
PostgreSQL + image storage     Local multimodal LLM
```

During development the laptop or Raspberry Pi can run Python. In the product, it runs on the glasses' paired compute unit. Python should own camera/sensor drivers; C# should own policy, orchestration, persistence, and the public API.

## Protocol choices

| Need | Choice | Reason |
|---|---|---|
| Image/chat requests and CRUD | HTTPS REST | Simple, testable, and retryable |
| Answer tokens, job progress, state | ASP.NET Core SignalR | Server push and managed connections |
| Future multi-device telemetry | MQTT 5, optional later | Retained state, QoS, and last-will support |
| Internal services | gRPC only when needed | Avoid premature protocol complexity |

For version one, REST plus SignalR is enough. Do not send the same events through raw WebSockets, SignalR, and MQTT. SignalR prefers WebSockets and falls back to Server-Sent Events or long polling ([Microsoft SignalR overview](https://learn.microsoft.com/en-us/aspnet/core/signalr/introduction?view=aspnetcore-8.0)). MQTT is designed as lightweight publish/subscribe for constrained/IoT systems and supports QoS and abnormal-disconnect notification ([OASIS MQTT 5](https://docs.oasis-open.org/mqtt/mqtt/v5.0/mqtt-v5.0.html)).

## Images and Base64

### Python to C#: use binary multipart

Send HTTPS `multipart/form-data` with:

- `image`: compressed JPEG or WebP bytes
- `prompt`
- `deviceId`, `sessionId`, `capturedAtUtc`, and client-generated UUID `requestId`
- optional gaze point, orientation, and dimensions

Do **not** use Base64 as the normal device protocol. Base64 encodes 3 bytes as 4 characters, approaching 33% size overhead before JSON overhead, and adds CPU/memory copies—bad for wearable bandwidth and battery. ASP.NET Core supports buffered multipart uploads for small files and streaming for larger ones ([Microsoft upload guidance](https://learn.microsoft.com/en-us/aspnet/core/mvc/models/file-uploads?view=aspnetcore-10.0)).

Starting limits: one JPEG/WebP, at most 1920×1080 and 5 MB, decoded-image validation, server-generated name, timeout, and per-device rate limit. Never trust filename, extension, or claimed MIME type. Strip EXIF unless intentionally needed.

### C# to LLM: Base64 may be an adapter detail

Put the model behind `IVisionModelClient`. Ollama vision accepts text plus images; its REST API requires Base64 images, while SDKs can accept paths or raw bytes ([Ollama vision](https://docs.ollama.com/capabilities/vision)). Convert validated bytes to Base64 only inside the Ollama adapter. This keeps the glasses API efficient and the model runtime replaceable.

Flow: capture an event-triggered still → resize/compress and hash locally → multipart upload → validate/store metadata → bounded inference job → model call → persist result → stream status/answer → Python acknowledges and removes its queued copy. Do not continuously upload camera frames to an LLM: it wastes power and bandwidth and creates privacy/overload risk.

## Proposed API v1

```text
POST   /api/v1/device/register
PUT    /api/v1/devices/{deviceId}/state
GET    /api/v1/devices/{deviceId}/state
POST   /api/v1/devices/{deviceId}/telemetry
POST   /api/v1/conversations
GET    /api/v1/conversations/{id}
POST   /api/v1/conversations/{id}/messages
POST   /api/v1/conversations/{id}/vision-requests  (multipart)
GET    /api/v1/inference-jobs/{id}
DELETE /api/v1/inference-jobs/{id}                (cancel)
GET    /api/v1/health/live
GET    /api/v1/health/ready
GET    /api/v1/server/status
HUB    /hubs/device-state
```

Return `202 Accepted` and a job ID for longer inference. Make writes idempotent using `requestId`; use problem-details errors and cancellation. Suggested device state:

```json
{
  "deviceId": "glasses-001",
  "sequence": 1842,
  "capturedAtUtc": "2026-08-20T10:15:30Z",
  "batteryPercent": 72,
  "isCharging": false,
  "network": { "connected": true, "rssiDbm": -58 },
  "camera": { "available": true },
  "eyeTracker": { "available": true, "calibrated": true },
  "activeMenu": "assistant",
  "clientVersion": "0.1.0"
}
```

`sequence` increases per device so stale state can be rejected. Battery comes from the glasses/compute-unit controller; the server records it. Send on change plus a 15–30 second heartbeat, never per eye sample.

## PostgreSQL design

Start with:

- `devices`: identity, name, credential reference, last seen, version
- `device_state_latest`: one current row per device
- `telemetry_samples`: battery/charging/temperature/network with retention
- `conversations` and `messages`: text, roles, model and latency metadata
- `media_assets`: object key, type, size, dimensions, SHA-256, deletion time
- `inference_jobs`: queued/running/succeeded/failed/cancelled, request ID, timings
- `gaze_events`: derived menu target/dwell/click only at first

Use typed columns for queried fields and `jsonb` for changing metadata; PostgreSQL supports GIN indexing for `jsonb` ([PostgreSQL JSON](https://www.postgresql.org/docs/17/datatype-json.html)). Small prototype images may use `bytea`, PostgreSQL's raw-binary type ([PostgreSQL binary data](https://www.postgresql.org/docs/17/datatype-binary.html)). At scale, use encrypted filesystem/S3-compatible object storage and keep only keys/metadata in PostgreSQL. Never store Base64 text. Use EF Core, Npgsql, migrations, UTC, and retention cleanup.

## Eye tracking

Eye tracking is separate from the outward scene camera. A custom binocular system normally needs inward near-infrared cameras, illumination, calibration, synchronization, and a gaze API; heat, comfort, optical safety, and privacy make this a later hardware stage.

Prototype in order:

1. Simulate gaze with mouse/head direction to validate the menu.
2. Use a research device before custom optics. Pupil Labs Neon provides real-time streams and a Python API ([Neon Real-Time API](https://docs.pupil-labs.com/neon/real-time-api/)).
3. If the final runtime supports OpenXR, use its eye-gaze extension and check support at runtime ([Khronos eye-gaze extension](https://registry.khronos.org/OpenXR/specs/1.0/man/html/XR_EXT_eye_gaze_interaction.html)).

Process high-rate gaze locally and send only derived interactions or consented, downsampled diagnostics. Include calibration quality/timestamps and always provide non-gaze input.

## Glasses OS and menu

Do not build a full OS first. Build a kiosk-style app on supported Linux, Android, or XR:

```text
BOOT -> PAIRING -> READY -> CAPTURING -> UPLOADING -> THINKING -> PRESENTING
                      \-> OFFLINE_QUEUED
any state -> DEGRADED / ERROR
```

Always show battery, connection, privacy/capture, and server/AI readiness. Menu: **Ask AI**, **Look and ask**, **Recent answers**, **Server status**, **Battery/device**, **Eye calibration**, **Settings/privacy**. Use gaze+dwell or gaze+physical/voice confirmation; gaze alone must not invoke destructive actions. Cache the menu and offline queue locally (SQLite is suitable).

## Health, security, and privacy

- **Liveness:** API process responds; no dependencies.
- **Readiness:** PostgreSQL reachable, model available, queue below limit, storage sufficient.
- **Admin status:** model/load, queue, DB latency, GPU/CPU/RAM/disk, last inference.
- **Device online:** heartbeat/connection state; distinct from server health.

Use structured logs/correlation IDs but never log credentials, raw gaze, images, or full prompts by default. Bound the inference queue and respond with `429/503` plus `Retry-After` under load.

Use TLS even on LAN. Move from shared keys to per-device pairing with short-lived tokens or mutual TLS before multiple devices. Wearable credentials must never access power endpoints. Keep Ollama and PostgreSQL on loopback/private network. Encrypt retained images, define deletion/retention, show a clear capture indicator, and treat all LLM output/tool calls as untrusted and authorization-gated.

## Roadmap

1. **Vision slice:** benchmark one multimodal model; add multipart endpoint and `IVisionModelClient`; add Python `--image/--prompt`. Exit: photo → C# → local model → useful answer.
2. **Persistence/jobs:** PostgreSQL migrations, resource CRUD, idempotency, bounded queue, `202` jobs, cleanup, dependency readiness.
3. **Wearable state:** telemetry/heartbeat, SignalR, exponential reconnect with jitter, simulated menu, SQLite offline queue.
4. **Hardware:** scene camera, battery gauge, display/audio, confirmation/privacy controls, supported eye tracker; measure latency, thermals, weight, and battery.
5. **Hardening:** per-device auth, certificate management, encryption, deletion controls, load/failure tests, backups, systemd/container recovery and model rollback.

Open experiments: target model/quantization and actual GPU needs; on-frame versus companion compute; display/OS; eye-tracking platform; and whether images should be retained after inference at all.
