# Project calculations

_Analysis snapshot: 2026-08-21; last audited: 2026-08-22_

This note collects the important calculations and numeric limits in the AI-glasses project. Values labeled **illustrative** or **simulated** are not measurements and must not be used as final hardware specifications.

## Battery calculations

### Battery energy

For the illustrative 3.7 V, 2000 mAh battery:

```text
capacity = 2000 mAh / 1000 = 2 Ah
battery energy = voltage × capacity
               = 3.7 V × 2 Ah
               = 7.4 Wh
```

This is the battery's theoretical stored energy.

### Usable battery energy

Assuming 80% conversion efficiency:

```text
usable energy = 7.4 Wh × 0.80
              = 5.92 Wh

conversion loss = 7.4 Wh − 5.92 Wh
                = 1.48 Wh
```

The 5.92 Wh estimate represents energy delivered to the electronics after assumed regulator and conversion losses. The assumption must be replaced with measured efficiency.

### Estimated runtime

At an illustrative 3 W average load:

```text
runtime = usable energy / average power
        = 5.92 Wh / 3 W
        = 1.973 hours
        ≈ 1 hour 58 minutes
```

Therefore, the hardware research note's “about 2 hours” result is correct for these assumptions.

### Proposed battery-size range

Using 3.7 V, 80% efficiency, and a 3 W average load:

```text
2000 mAh: 3.7 × 2.0 × 0.8 / 3 = 1.97 hours ≈ 1 h 58 min
3000 mAh: 3.7 × 3.0 × 0.8 / 3 = 2.96 hours ≈ 2 h 58 min
```

These are estimates, not promised runtimes. Measure average and peak power during idle, display use, audio, capture, compression, upload, and reconnection.

### HUD runtime inconsistency

The simulated ARGUS UI displays 72% battery and 4 h 18 min remaining. If 4.3 hours represents 72% of a full charge, and if reported state of charge is treated as proportional to usable remaining energy:

```text
implied full runtime = 4.3 h / 0.72
                     = 5.97 hours
```

With the illustrative 5.92 Wh usable battery energy:

```text
implied average power = 5.92 Wh / 5.97 h
                      ≈ 0.99 W
```

This conflicts with the 3 W research example. At 72% and 3 W:

```text
remaining energy = 5.92 Wh × 0.72 = 4.262 Wh
remaining runtime = 4.262 Wh / 3 W = 1.42 hours
                  ≈ 1 hour 25 minutes
```

The UI's `4H 18M` value is therefore demonstration data, not a calculated runtime. Real remaining-runtime estimation must use the fuel gauge, recent measured load, battery condition, temperature, and shutdown threshold; battery percentage alone is not guaranteed to be perfectly proportional to remaining energy.

## Image and transport calculations

### Base64 overhead

Base64 converts every 3 binary bytes into 4 characters:

```text
expansion ratio = 4 / 3 = 1.3333
overhead ≈ 33.33%
```

For the maximum 5 MiB image:

```text
binary size = 5 × 1024 × 1024
            = 5,242,880 bytes

Base64 length = 4 × ceil(5,242,880 / 3)
              = 6,990,508 characters

additional data = 6,990,508 − 5,242,880
                = 1,747,628 bytes
                ≈ 1.67 MiB
```

This is why the device-to-server protocol uses binary multipart. Base64 is used only inside the Ollama adapter.

### Upload limits and multipart allowance

The configured limits are:

```text
maximum image = 5 × 1024 × 1024 = 5,242,880 bytes
maximum request = 5,300,000 bytes

multipart allowance = 5,300,000 − 5,242,880
                    = 57,120 bytes
                    ≈ 55.8 KiB
```

The allowance carries multipart boundaries, headers, prompt, and request ID. The implementation is internally consistent.

The UI says “5 MB,” but the image check uses 5 MiB:

```text
5 MB  = 5,000,000 bytes
5 MiB = 5,242,880 bytes
difference = 242,880 bytes
```

The project should use one term consistently.

### Decoded-image memory for one frame

The maximum configured dimensions are 1920×1080:

```text
pixels = 1920 × 1080
       = 2,073,600 pixels
```

Approximate uncompressed pixel storage:

```text
RGB  = 2,073,600 × 3 = 6,220,800 bytes ≈ 5.93 MiB
RGBA = 2,073,600 × 4 = 8,294,400 bytes ≈ 7.91 MiB
```

A compressed upload under 5 MiB can therefore occupy more memory after decoding. These figures cover one RGB/RGBA frame only; they are **not** a proven upper bound for the current endpoint. JPEG is single-frame, but WebP can be animated, and the current validator checks width and height without rejecting multiple frames or limiting total decoded frames. ImageSharp, additional frames, and the sanitized output can therefore require more temporary memory. Add an explicit single-frame check (or a total decoded-pixel/frame limit) before treating the calculation as a maximum-memory bound.

## Server capacity and timing

### Standard request limiter

The standard API allows 30 requests per 1-minute fixed window per observed IP:

```text
30 / 60 = 0.5 requests per second
average interval = 60 / 30 = 2 seconds per request
```

This is an abuse-control limit, not guaranteed throughput. A fixed window permits bursts, and excess requests are not queued.

### Power-operation limiter

The structured restart/shutdown API allows 5 requests per minute per observed IP:

```text
5 / 60 = 0.0833 requests per second
average interval = 60 / 5 = 12 seconds per request
```

Authentication and disabled-by-default configuration remain the primary power-operation protections.

### Inference concurrency

The default maximum is two simultaneous inference calls, with no queue. The configured value is clamped between 1 and 16.

If both slots remain occupied for exactly the full 90-second timeout on every request:

```text
timeout-duration slot turnover = 2 slots × 3600 seconds / 90 seconds
                               = 80 requests/hour
```

This is not a capacity ceiling: requests that finish faster can produce more than 80 responses per hour. It is only the slot-turnover result for the special case where every request occupies a slot for 90 seconds. Actual capacity depends on measured inference latency, hardware, model, image size, and thermals. A third concurrent request receives `503` and `Retry-After: 2` when both default slots are occupied.

### Timeout chain

```text
Ollama HTTP timeout = 90 seconds
Python vision timeout = at least 90 seconds
ARGUS proxy timeout = 95 seconds
proxy margin = 95 − 90 = 5 seconds
```

The ARGUS proxy has a five-second outer margin over the Ollama timeout, although that may be tight for server processing and response transfer. The Python client's minimum 90-second timeout is equal to the server's Ollama timeout, so either side may time out first because of connection and processing overhead. The Python vision timeout should be set above 90 seconds—approximately 100–105 seconds with the current server setting—to create a clear timeout order.

### Restart and shutdown timing

```text
default delay = 1 minute = 60 seconds
allowed delay = 1–60 minutes = 60–3600 seconds
scheduling-command timeout = 10 seconds
```

The ten-second timeout covers execution of the Linux scheduling command, not the configured wait before restart or shutdown.

## Planned heartbeat traffic

The architecture proposes a heartbeat every 15–30 seconds:

```text
15-second interval = 60 / 15 = 4 heartbeats/minute
30-second interval = 60 / 30 = 2 heartbeats/minute
```

Per device:

```text
2–4 heartbeats/minute
120–240 heartbeats/hour
2,880–5,760 heartbeats/day
```

If heartbeats used the current 30-request-per-minute IP bucket, devices behind one address would share it. At a 15-second heartbeat:

```text
30-request limit / 4 heartbeats per device
= 7.5 devices
```

In practice, only about seven devices could heartbeat reliably before leaving room for image and command requests. Future telemetry should use per-device authentication and a separate rate-limit policy.

## Simulated ARGUS UI calculations

These values demonstrate interface behavior and do not represent hardware measurements or model output.

### Gaze calibration

Calibration advances in 25-percentage-point steps:

```text
0 → 25 → 50 → 75 → 100
100 / 25 = 4 confirmation points
```

No real gaze coefficients are calculated or stored.

### Reticle range

```text
horizontal range = −190 to +190 = 380 pixels
vertical range = −150 to +150 = 300 pixels
keyboard step = 12 pixels

center to horizontal limit = ceil(190 / 12) = 16 presses
center to vertical limit = ceil(150 / 12) = 13 presses
```

Target selection uses hard-coded regions rather than image coordinates or gaze calibration:

- `x < -55`: window
- `x > 55` and `y > 15`: coffee cup
- `x > 55`: network hub
- otherwise: workstation

### Simulated scan

```text
scan duration = 1800 ms = 1.8 seconds
displayed progress = fixed 79%
```

The percentage is not calculated from elapsed time or model progress.

### Simulated confidence

The four target confidence values are 94%, 87%, 91%, and 83%:

```text
mean confidence = (94 + 87 + 91 + 83) / 4
                = 355 / 4
                = 88.75%
```

These are fixed demonstration values and have no statistical relationship to the Gemma model.

### Decorative code animation

The Terminator display advances every 150 ms and contains 21 lines:

```text
line rate = 1000 / 150 = 6.67 lines/second
full cycle = 21 × 150 ms = 3150 ms = 3.15 seconds
```

## Measurements still required

The following cannot be calculated reliably from the current repository:

- real image-to-first-token and total response latency;
- tokens per second;
- peak server RAM and GPU VRAM;
- model cold-load time;
- real maximum concurrent inference jobs;
- Pi idle, capture, compression, and Wi-Fi power;
- battery regulator efficiency under each load;
- actual battery runtime and temperature;
- image bandwidth per user and per day;
- storage growth and retention cost;
- packet loss and reconnect behavior.

Record these measurements before buying final server hardware or promising wearable runtime.
