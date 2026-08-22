# Minimum AI server hardware

_Research and sizing snapshot: 2026-08-21_

## Decision

For a useful single-user ARGUS prototype running the project's current `gemma3:4b` vision model locally, use this as the **minimum planning baseline**:

| Component | Minimum recommended | Why |
|---|---:|---|
| CPU | Modern 64-bit 6-core processor | Runs Ubuntu, ASP.NET Core, PostgreSQL, image validation, networking, and fallback inference without starving the system |
| System RAM | **16 GB** | Leaves working space beyond the model, Ollama, database cache, decoded images, OS, and C# process |
| GPU | Ollama-supported NVIDIA GPU with **8 GB VRAM** | Plausible baseline for fully offloaded Q4 Gemma 3 4B vision inference at a short context; latency must still be benchmarked |
| Storage | **256 GB NVMe SSD** | Holds Ubuntu, Ollama, model versions, PostgreSQL, logs, updates, and prototype data with useful free-space margin |
| Network | Gigabit Ethernet to the router; Wi-Fi handled by the glasses/companion | Stable server connection and low LAN latency; Ethernet avoids adding server-side Wi-Fi variability |
| Power supply | Quality unit meeting the GPU vendor's system recommendation, connector, and transient requirements | Wattage cannot be selected from VRAM capacity; it depends on the exact CPU and GPU |
| Cooling | Sustained CPU/GPU cooling, not passive or tiny-form-factor cooling | Vision inference is a sustained compute load and throttling directly increases response time |

For this minimum configuration, set:

```text
Vision__Model=gemma3:4b
Vision__MaxConcurrentRequests=1
OLLAMA_NUM_PARALLEL=1
OLLAMA_CONTEXT_LENGTH=4096
```

The code currently defaults to two concurrent inference requests. That default is too aggressive for a minimum 8 GB VRAM system until real measurements prove that two complete vision contexts fit and remain responsive. `Vision__MaxConcurrentRequests` controls admission in C#, while `OLLAMA_NUM_PARALLEL` independently controls Ollama's parallel processing. Both must be bounded.

This baseline is not a universal guarantee. Two GPUs with 8 GB VRAM can have very different compute throughput, memory bandwidth, driver support, thermals, and response latency. Do not buy from VRAM capacity alone; benchmark the exact GPU or obtain results for the exact model tag and context.

## Intended data flow

The intended product architecture is:

```text
glasses sensors and controls
          ↓
Python device agent on the glasses companion
  capture, compression, telemetry, retry, offline queue
          ↓  HTTPS multipart / REST; later SignalR
ASP.NET Core C# server
  authentication, validation, policy, orchestration
       ↙                         ↘
PostgreSQL                       Ollama
devices, state, messages,        local multimodal AI
jobs, telemetry, metadata             ↓
       ↘                         ↙
        C# combines/stores the result
                    ↓
          Python device agent
                    ↓
             glasses display/audio
```

Python is the intended device-side hardware and communication agent. It should not be the central AI server. C# is the trusted gateway: it authenticates the device, validates inputs, calls the AI, reads or writes database information, and returns the result. PostgreSQL does not send information directly to the glasses; C# queries it and returns only authorized data.

The current repository has two development request paths:

```text
Python CLI → C# → Ollama
ARGUS browser → ARGUS server-side /api/vision proxy → C# → Ollama
```

The React UI does not currently communicate through the Python device agent. That is the intended physical-device architecture, not present behavior. PostgreSQL CRUD, device identities, SignalR, persistent jobs, telemetry, and the offline queue are also still designs. The hardware recommendation reserves capacity for them without pretending they are already implemented.

## Why the AI model determines the minimum

The configured Ollama model is `gemma3:4b`. Ollama lists the default Q4_K_M model file at approximately **3.3 GB**, with image input and a 128K maximum context window ([Ollama Gemma 3 model page](https://ollama.com/library/gemma3), [Ollama model details](https://docs.ollama.com/api-reference/show-model-details)). Google states that Gemma 3 4B and larger variants accept vision input; images are normalized to 896×896 and encoded as 256 tokens ([Gemma 3 model card](https://ai.google.dev/gemma/docs/core/model_card_3), [Gemma vision guidance](https://ai.google.dev/gemma/docs/capabilities/vision)).

The 3.3 GB file size is not the complete runtime requirement. Memory must also hold:

- Ollama and GPU runtime allocations;
- the vision encoder and image tensors;
- KV cache for the active context;
- prompt and generated tokens;
- temporary buffers;
- one or more simultaneous requests.

Therefore:

```text
3.3 GB model file ≠ 3.3 GB required VRAM
```

An 8 GB GPU is a defensible planning baseline for one short-context Q4 4B vision request, but it must be benchmarked. It is not a guarantee that arbitrary 128K contexts or two simultaneous requests will fit. Ollama currently defaults to a 4K context on GPUs with less than 24 GiB VRAM, and memory use grows with context and parallelism ([Ollama context-length documentation](https://docs.ollama.com/context-length), [Ollama concurrency FAQ](https://docs.ollama.com/faq)). The glasses use case should enforce short prompts, short answers, and bounded conversation history instead of allocating the model's advertised maximum context.

## Three hardware levels

### 1. Absolute functional minimum — CPU only

```text
CPU: 4 modern 64-bit cores
RAM: 8 GB
GPU: none
SSD: 80–100 GB
inference concurrency: 1
```

This is an **unverified lower-bound experiment**, not a promised minimum. It may run Ubuntu, C#, PostgreSQL, Ollama, and quantized Gemma 3 4B if memory usage is tightly controlled, but the repository has no CPU-only benchmark proving that 8 GB is sufficient. It is suitable only for installation checks and functional experiments.

I do **not** recommend it for wearable interaction because:

- vision generation may be slow enough to make the glasses frustrating;
- 8 GB RAM leaves little space for the model, OS, database, image decode, and file cache;
- swapping makes latency much worse and wears the storage device;
- the server has almost no room for a second request or future services.

“It starts” is not the same as “it is usable.”

### 2. Minimum recommended prototype

```text
CPU: 6 modern cores
RAM: 16 GB
GPU: NVIDIA, 8 GB VRAM
SSD: 256 GB NVMe
inference concurrency: 1
network: gigabit Ethernet
```

This is the minimum tier I would test for the current project. Subject to a successful benchmark, it is intended to support:

- one pair of glasses;
- event-triggered still images rather than video;
- Gemma 3 4B Q4 vision inference;
- ASP.NET Core API and SignalR later;
- PostgreSQL device state, conversations, telemetry, and job metadata;
- short response history and modest image retention;
- local development and diagnostics.

GPU compatibility must be checked against current [Ollama hardware support](https://docs.ollama.com/gpu). At this snapshot, Ollama documents NVIDIA compute capability 5.0 or newer with driver 531 or newer. These requirements can change, and a listed GPU can still perform poorly for this workload. NVIDIA is the conservative Linux choice for this prototype because support and diagnostic paths are generally clearer. A supported AMD platform may also work, but the exact device/runtime combination must be verified before purchase. Apple Metal is supported by Ollama, but Apple hardware is not an Ubuntu-server option and should be evaluated as a different deployment platform.

### 3. Comfortable development server

```text
CPU: 8 modern cores
RAM: 32 GB
GPU: 12–16 GB VRAM
SSD: 1 TB NVMe
inference concurrency: begin at 1, test 2
```

This tier is preferable if the budget allows. It provides room for:

- testing two glasses or two overlapping jobs;
- a larger vision model or higher quantization later;
- database backups and longer retention;
- containers, monitoring, development builds, and migration tools;
- less risk of CPU/RAM contention during inference;
- comparing models without immediately replacing the server.

It still does not guarantee that every 12B model or 128K context fits. Model tag, quantization, context, concurrency, and runtime overhead must be measured together.

## Component-by-component reasoning

### CPU

The CPU performs work even when inference is GPU accelerated:

- TLS and API-key authentication;
- multipart parsing;
- JPEG/WebP decode and re-encode at quality 88;
- EXIF/ICC/XMP removal;
- Base64 and JSON preparation for Ollama;
- PostgreSQL queries and serialization;
- SignalR connections and application logic;
- logging, background cleanup, and OS services.

Four cores are enough to prove the flow. Six modern cores are the practical minimum because image processing and database work must continue while Ollama is active. Core generation and sustained performance matter more than a large nominal core count.

### System RAM

A conservative 16 GB planning split is:

```text
Ubuntu and background services       1.5–2.5 GB
C# API and image-processing bursts   0.3–1.0 GB
PostgreSQL and filesystem cache      1–2 GB
Ollama/model CPU-side allocations    several GB, runtime-dependent
free/burst margin                    remaining capacity
```

These are planning allowances, not measurements. The repository has no runtime memory benchmark yet. If the model falls back partly or entirely to CPU RAM, 8 GB can become insufficient quickly; 16 GB is the minimum sensible capacity, and 32 GB is safer for development.

### GPU and VRAM

The GPU is likely to change user experience more than upgrading the web-server CPU, but VRAM does not measure inference speed. The current request is synchronous and has a 90-second Ollama timeout. A slow CPU-only response can occupy the only inference slot for a long time, while a suitable GPU should reduce time-to-answer; the exact improvement must be measured.

Use 8 GB VRAM only with:

- the 3.3 GB Q4 Gemma 3 4B tag;
- one concurrent request;
- short prompts and bounded output;
- measured VRAM monitoring;
- no other large GPU workloads.

Choose 12–16 GB VRAM if two concurrent jobs, larger contexts, higher-precision 4B variants, or model experimentation are important. Ollama lists Gemma 3 4B variants from about 3.3 GB for Q4_K_M to 5.0 GB for Q8 and 8.6 GB for FP16, before runtime overhead ([Ollama Gemma 3 tags](https://ollama.com/library/gemma3/tags)).

Ollama may queue work internally even when the C# inference gate rejects requests beyond its own limit. Ollama documents that parallel memory scales with `OLLAMA_NUM_PARALLEL × OLLAMA_CONTEXT_LENGTH`; inspect the actual processor split and allocation with `ollama ps` rather than assuming full GPU residency.

### Storage

The OS and current model do not require a large disk by themselves, but retained images dominate storage growth.

A reasonable minimum allocation is:

```text
Ubuntu, packages, updates       30–40 GB
Ollama 4B model and headroom    15–25 GB
PostgreSQL and indexes          10–20 GB initially
logs, builds, backups, temp     20–40 GB
unallocated safety margin       remainder
```

This is why 256 GB is preferred over a nearly full 80–100 GB installation.

Image-retention formula:

```text
storage/day = average stored image size × images/day × devices
```

Examples for one device:

```text
500 KiB × 100 images/day = 50,000 KiB/day ≈ 48.8 MiB/day
30 days ≈ 1.43 GiB/month

5 MiB × 100 images/day = 500 MiB/day
30 days = 14.65 GiB/month
```

With four devices at the worst accepted image size:

```text
14.65 GiB/month × 4 = 58.6 GiB/month
```

Do not store every image indefinitely. Prefer encrypted object/filesystem storage with metadata in PostgreSQL, and define retention/deletion before enabling capture history. If images are deleted after inference, database growth from messages and telemetry will be much smaller.

### Network

The server should use wired gigabit Ethernet. The glasses companion can use Wi-Fi, but the server should not add another wireless hop.

Upload-time lower-bound formula:

```text
time = file bits / effective link bits per second
```

For a 5 MiB image:

```text
5 MiB × 8 = 40 Mib

at 10 Mbit/s effective throughput: 40 / 10 ≈ 4.0 seconds
at 50 Mbit/s effective throughput: 40 / 50 ≈ 0.8 seconds
at 100 Mbit/s effective throughput: 40 / 100 ≈ 0.4 seconds
```

Protocol overhead and Wi-Fi contention make real time longer. A more typical 500 KiB capture is roughly one tenth of those transfer times. This supports resizing/compressing on the Python companion and sending event-triggered stills instead of continuous frames.

### Database

PostgreSQL does not require a separate machine for the first prototype. On a single-user server, AI inference is far more demanding than device-state and conversation queries.

The `GlassesUI/db` directory currently contains an empty Cloudflare D1/Drizzle scaffold and example schema. It is not the PostgreSQL implementation described by the architecture, and the C# project currently has no EF Core/Npgsql package or migrations. Do not count the scaffold as completed persistence or design production storage around it.

Store in PostgreSQL:

- device identities and latest state;
- conversations and messages;
- telemetry samples with retention;
- inference job state and timings;
- image keys, hashes, dimensions, size, and deletion time.

Do not send database credentials to Python or the glasses. Only C# should access PostgreSQL. Do not store Base64 image text. Use parameterized EF Core/Npgsql operations, migrations, backups, and indexes based on actual queries.

PostgreSQL memory settings are multiplicative across connections and operations. For example, `work_mem` can be consumed by several operations in one query and by several sessions at once. Keep conservative defaults initially and tune from measured queries rather than assigning a large fixed fraction of the 16 GB system ([PostgreSQL resource-consumption documentation](https://www.postgresql.org/docs/current/runtime-config-resource.html)).

## Concurrency and number of glasses

The current server permits 30 standard requests per minute per observed IP and defaults to two concurrent AI calls. These are software settings, not proof that the hardware can serve two devices simultaneously.

For the minimum server:

```text
supported target = 1 active vision inference at a time
additional requests = reject/queue through a future bounded job system
```

Heartbeat and database queries are cheap compared with inference, but they must receive a separate per-device rate-limit policy. Multiple glasses behind the same router can otherwise share one IP bucket.

Before claiming support for `N` glasses, measure:

```text
arrival rate λ = vision requests per second from all devices
service rate μ = completed inferences per second per inference slot
utilization ρ = λ / (slots × μ)
```

Keep utilization well below 1; as it approaches 1, queue delay grows sharply. The repository contains no measured `μ`, so no honest multi-device capacity number can be given yet.

## Operating-system and deployment requirements

- Ubuntu Server 24.04 LTS or another currently supported Ubuntu LTS release;
- 64-bit installation;
- current GPU driver supported by the selected Ollama version;
- ASP.NET Core runtime matching the project's target framework; Microsoft documents `aspnetcore-runtime-10.0` for framework-dependent .NET 10 deployment on supported Ubuntu releases ([Microsoft Ubuntu installation guidance](https://learn.microsoft.com/en-us/dotnet/core/install/linux-ubuntu-install));
- PostgreSQL on localhost/private network;
- Ollama bound to loopback/private network, not exposed publicly;
- wired LAN address reserved in the router;
- TLS termination and correctly configured forwarded headers if a reverse proxy is used;
- automatic security updates with controlled reboot policy;
- systemd services or containers with restart policies;
- SMART/health monitoring, temperature monitoring, and disk-space alerts;
- regular database backups to another physical device.

The current project targets .NET 10, and the current workspace reports stable SDK `10.0.400`. Deployment should use a supported .NET 10 runtime/SDK build and should not rely on an older preview build recorded during early validation. If ARGUS is hosted on the same machine, its Node-based server process also consumes CPU and RAM; include it in measurements even though it is modest compared with Ollama.

## Acceptance tests before calling the hardware sufficient

Run these tests on the exact purchased machine:

1. Confirm the complete model is GPU-resident during a vision request.
2. Record model file size, idle VRAM, loaded VRAM, and peak VRAM.
3. Measure cold-load time, warm time to first token, total latency, and tokens/second.
4. Test 1280×720 JPEG/WebP images at typical compression, not only tiny samples.
5. Run at least 100 sequential vision requests and record failures and temperatures.
6. Test one and two simultaneous requests; keep concurrency at one if latency or memory becomes unstable.
7. Run PostgreSQL writes, telemetry, and SignalR connections during inference.
8. Confirm no swap thrashing, thermal throttling, GPU reset, or disk exhaustion.
9. Disconnect Ollama and PostgreSQL separately and verify readiness and error handling.
10. Measure wall power at idle and during sustained inference.

Suggested initial acceptance targets for one pair of glasses:

```text
warm image-to-answer latency: preferably ≤ 5 seconds, acceptable ≤ 10 seconds
vision request success rate: ≥ 99% over the local test set
sustained temperatures: below the component manufacturer's throttle limits
free SSD space after setup: ≥ 25%
swap during steady operation: approximately zero
```

These targets are engineering recommendations, not capabilities already demonstrated by the repository.

## Final recommendation

Use **6 modern CPU cores, 16 GB RAM, an Ollama-supported 8 GB NVIDIA GPU, and a 256 GB NVMe SSD** as the first minimum configuration to benchmark—not as a guaranteed performance specification. Configure one C# inference admission slot, one Ollama parallel request, and a 4K context initially. If buying new hardware and the budget permits, choose **8 CPU cores, 32 GB RAM, 12–16 GB VRAM, and a 1 TB NVMe SSD**; this is much less likely to be replaced when PostgreSQL, jobs, SignalR, multiple devices, and larger-model experiments are implemented.

Do not size the server from C# or database requirements alone. They are important but comparatively light. Size it around the exact local vision model, quantization, context, image rate, desired response latency, and concurrent glasses—and verify those values with benchmarks before treating the specification as final.
