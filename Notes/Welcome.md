# AI glasses and local AI server

This vault describes a wearable AI-glasses system backed by a local Ubuntu AI server.

## Start here

- [[AI glasses server architecture]] — consolidated architecture, protocols, data model, security, and roadmap
- [[Research note 1]] — original exploration and Ubuntu setup notes
- [[HardwareNOte]] — hardware decisions still to be benchmarked
- [[Glasses hardware research]] — researched component options, power architecture, prototype bill of materials, and test plan
- [[Waveguide and Vegalas display research]] — analysis of miniature RGB laser engines, waveguide optics, display trade-offs, and the recommended ARGUS display path
- [[Minimum AI server hardware]] — minimum and comfortable server specifications derived from the C#, PostgreSQL, Ollama vision, and glasses-to-Python data flow
- [[Server and glasses security]] — threat model, current protections and gaps, device/server/database hardening, privacy, and security acceptance tests
- [[Accessibility for blind and low-vision users]] — assessment of the project's potential as an audio-first scene assistant, current gaps, safety boundaries, and an accessible MVP
- [[Project calculations]] — battery, image transport, server capacity, timing, heartbeat, and simulated UI calculations
- `PythonClient/client.py` — current command-line client
- `UbuntuServerOSVMCode-main/UbuntuServerOSVMCode-main/` — ASP.NET Core prototype

## Current phase

See [[Thinger.io integration]] for an optional device telemetry dashboard, HTTP integration experiment, configuration approach, privacy boundaries, and deployment costs.

The repository is at the infrastructure and interface-prototype stage. The C# server has authenticated health endpoints, diagnostics, API-key protection, rate limiting, disabled-by-default restart/shutdown operations, validated JPEG/WebP upload, and synchronous Ollama vision inference. Its current readiness check covers API-key configuration only, and its liveness route is not yet independent of authentication configuration. `GlassesUI/` contains an interactive React prototype with two lenses, an in-lens status display, a hamburger application menu, a draggable targeting reticle, and a server-side proxy that can send a selected image to the C# vision endpoint. PostgreSQL CRUD, device identities, live telemetry, SignalR, persistent inference jobs, the Python hardware-agent integration, and physical glasses hardware remain designs rather than complete implementations.
