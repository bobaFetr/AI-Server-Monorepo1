# AI glasses and local AI server

This vault describes a wearable AI-glasses system backed by a local Ubuntu AI server.

## Start here

- [[AI glasses server architecture]] — consolidated architecture, protocols, data model, security, and roadmap
- [[Research note 1]] — original exploration and Ubuntu setup notes
- [[HardwareNOte]] — hardware decisions still to be benchmarked
- [[Glasses hardware research]] — researched component options, power architecture, prototype bill of materials, and test plan
- `PythonClient/client.py` — current command-line client
- `UbuntuServerOSVMCode-main/UbuntuServerOSVMCode-main/` — ASP.NET Core prototype

## Current phase

The repository is at the infrastructure and interface-prototype stage. The C# server has health checks, diagnostics, API-key protection, rate limiting, and disabled-by-default restart/shutdown operations. `GlassesUI/` contains an interactive React prototype with two lenses, an in-lens status display, a hamburger application menu, and a draggable targeting reticle. Vision inference, PostgreSQL CRUD, live device telemetry, real-time server integration, and physical glasses hardware are still designs rather than complete implementations.
