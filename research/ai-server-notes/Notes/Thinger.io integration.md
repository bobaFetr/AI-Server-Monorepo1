# Thinger.io integration for ARGUS

_Research snapshot: 2026-10-05. Integration proposal; not implemented._

## Purpose

[Thinger.io](https://thinger.io/) can provide a development dashboard and device-management layer for ARGUS. Its strongest initial use is collecting operational measurements from the glasses companion and C# server, then displaying current values and historical trends without building a separate administration interface.

Keep the existing local vision path: Python or the ARGUS UI sends an image to the ASP.NET Core API, which validates it and calls Ollama. Thinger.io should initially receive telemetry and performance measurements alongside that path. Camera capture and AI answers should continue working when Thinger.io is unavailable.

Related notes: [[AI glasses server architecture]], [[Project calculations]], [[Server and glasses security]], and [[Accessibility for blind and low-vision users]].

## Current project and proposed additions

The repository already contains a Python CLI, authenticated C# endpoints, synchronous Ollama vision inference, and a React glasses interface with image upload. It does not yet contain a Python hardware agent or a Thinger.io integration. Battery, Wi-Fi, connection, camera, and gaze indicators in the UI remain simulations.

| Need | Proposed Thinger.io use |
|---|---|
| Battery and thermal testing | Plot battery percentage, charging state, and companion temperature during capture and inference |
| Connection monitoring | Record Wi-Fi strength, heartbeat times, reconnects, and upload failures |
| AI performance testing | Plot model request duration, success/failure counts, timeout counts, and inference-busy responses |
| Device configuration | Store capture interval, narration preferences, and telemetry interval as device properties |
| Several prototypes | Register each glasses/companion unit separately and compare measurements |
| Development alerts | Use endpoints or available rule-processing features to notify developers about low battery, overheating, or failures |

Thinger.io dashboards support current values, historical charts, and controls. Data buckets store time-series measurements and events for visualization or export. Alert automation and plugins must be checked against the selected deployment and plan. Sources: [dashboards](https://github.com/thinger-io/Docs/blob/main/features/dashboards.md), [data buckets](https://docs.thinger.io/features/buckets), and [platform overview](https://docs.thinger.io/).

## Architecture

```text
Glasses sensors and controls
           |
           v
Python device agent on companion
           | images/questions                  | telemetry
           v                                   v
ASP.NET Core API -------------------------> Thinger.io
           |            inference metrics      |
           v                                   v
        Ollama                         Development dashboard
           |
           v
Answer -> Python -> glasses display/audio
```

This is a proposed division of responsibilities:

- Python owns camera/sensor access, local controls, compression, and offline behavior.
- C# owns authorization, image validation, inference orchestration, and future conversations/jobs.
- Thinger.io owns the prototype's telemetry dashboards, measurement history, and selected configuration properties.
- PostgreSQL remains the planned application database for conversations, media metadata, and inference jobs. Decide later whether telemetry history also needs PostgreSQL; avoid duplicating every measurement without a reason.

Thinger.io device credentials do not automatically authorize requests to the existing C# API. Device pairing and per-device authorization for that API remain separate work.

## Start with HTTP devices

The simplest fit for the existing Python and C# code is Thinger.io's HTTP device integration. It accepts JSON over HTTP requests, can store received measurements in a bucket, update device properties, invoke configured endpoints, and return selected properties in the response. Use HTTPS and a scoped token in the Authorization header. The documentation also shows tokens in query strings; prefer headers to reduce credential exposure through URL logs.

HTTP devices have fewer capabilities than persistent native clients. Configuration returned with a heartbeat is retrieved on the next request; it should not be treated as an immediate push command. For HTTP devices, the configured connection timeout determines when the platform marks a device disconnected. Recent contact does not prove that the camera or AI model works. Source: [HTTP device documentation](https://docs.thinger.io/http-devices).

### First integration experiment

1. Create an HTTP device named `argus-prototype-01` in the Thinger.io console.
2. Configure its callback, authorization, data bucket, and connection timeout. Copy the request URL from that deployment's callback overview rather than guessing the host or API path.
3. Add a separate telemetry sender to the future Python device agent. For an initial connectivity test, use clearly labeled simulated measurements; do not present them as hardware readings.
4. Send a heartbeat every 30 seconds as a starting experiment. Measure its battery/network cost before choosing a final interval. Set the disconnected timeout longer than the heartbeat interval to tolerate missed messages.
5. Create dashboard widgets for last contact, battery, temperature, Wi-Fi strength, and upload failures.
6. Add a separate C# server profile or bucket for inference measurements. Publish asynchronously with a bounded buffer so a telemetry outage cannot delay an AI answer.
7. Verify missing-token rejection, historical recording, offline indication, and continued local AI operation when telemetry delivery fails.

Example proposed payload, not a required Thinger.io schema:

```json
{
  "deviceId": "argus-prototype-01",
  "sequence": 1842,
  "capturedAtUtc": "2026-10-05T10:15:30Z",
  "source": "hardware",
  "batteryPercent": 72,
  "isCharging": false,
  "wifiRssiDbm": -58,
  "companionTemperatureC": 43.5,
  "cameraAvailable": true,
  "pendingUploads": 0
}
```

Only send fields actually measured by the agent. Omit unavailable readings instead of inventing defaults. Use `"source": "simulation"` during simulated tests. UTC timestamps and sequence numbers help distinguish delayed records from current state.

### Minimal Python connectivity example

This standalone example uses the standard library, matching the current CLI's dependency-light approach. It is not yet a hardware agent or a production retry implementation.

Set `ARGUS_THINGER_CALLBACK_URL` to the callback URL copied from the console, without a token in its query string. Set `ARGUS_THINGER_TOKEN` to the callback's scoped token.

```python
import json
import os
import urllib.request
from datetime import datetime, timezone

payload = {
    "deviceId": "argus-prototype-01",
    "capturedAtUtc": datetime.now(timezone.utc).isoformat(),
    "source": "simulation",
    "batteryPercent": 72,
    "wifiRssiDbm": -58,
}

callback_url = os.environ["ARGUS_THINGER_CALLBACK_URL"]
if not callback_url.startswith("https://"):
    raise ValueError("Use an HTTPS callback URL.")

request = urllib.request.Request(
    callback_url,
    data=json.dumps(payload).encode("utf-8"),
    headers={
        "Authorization": "Bearer " + os.environ["ARGUS_THINGER_TOKEN"],
        "Content-Type": "application/json",
    },
    method="POST",
)

with urllib.request.urlopen(request, timeout=5) as response:
    print("Telemetry HTTP status:", response.status)
```

In the agent, handle network failures independently of capture and inference. Use bounded retries with backoff, limit queued telemetry, and retain the original timestamp when replaying an older sample. Heartbeat delivery is not a replacement for the planned local image/job queue.

## Configuration and automation

Device properties could hold `telemetryIntervalSeconds`, `automaticNarrationEnabled`, or `speechRate`. With HTTP callbacks, the agent can read configured response properties during a heartbeat, validate allowed fields and ranges, then acknowledge the applied configuration version.

Local privacy controls take precedence over remote settings. A remote configuration must not override a local camera-off control. Automatic narration should require explicit user opt-in. Keep Linux restart/shutdown and administrator credentials out of wearable configuration and ordinary dashboard controls.

For the first version, use Thinger.io as the developer dashboard. Continue using `GlassesUI` as the wearer-facing interface. Showing real readings in that UI still requires an authenticated integration and a distinction between current, stale, unavailable, and simulated data.

## Privacy and deployment

Send operational measurements by default, not camera images, prompts, answers, raw gaze, audio, or precise location. Thinger.io cloud telemetry is external data transfer even when Ollama inference remains local. Define what is collected and how long it is retained; battery and connection history can also reveal usage patterns.

Use separate scoped credentials for glasses telemetry and server metrics. Keep tokens out of browser bundles, Git, screenshots, and logs. Do not give the telemetry integration the C# administrator key.

The documentation describes private-cloud and on-premises deployment options. Verify licensing, feature availability, maintenance requirements, and local-network operation before selecting on-premises hosting. The open-source branding does not establish that the entire current platform is freely self-hostable. Source: [server deployment](https://docs.thinger.io/server/deployment).

## Cost and decision

At this research snapshot, the private-cloud pricing page lists Cloud Small at **EUR 45/month billed annually (EUR 540/year)** with 100 devices and 40 GB storage. It states that there is no free trial. Other documentation mentions free/community accounts, so verify the currently available entry option and its HTTP-device, bucket, dashboard, and plugin limits before subscribing. Source: [current pricing](https://pricing.thinger.io/pricing).

For one ARGUS prototype, evaluate Thinger.io first as a telemetry experiment. It is useful if ready-made charts and device administration save enough development time to justify the cost. It does not replace camera drivers, speech recognition, text-to-speech, the offline queue, inference jobs, stale-answer handling, or safety validation.

Success for the first experiment: real battery/temperature readings and C# inference measurements appear in a dashboard, historical data can be inspected, disconnected devices are identifiable, credentials are scoped, and losing Thinger.io does not interrupt the local scene-assistance loop.
