# AI glasses and local AI server

This vault describes a wearable AI-glasses system backed by a local Ubuntu AI server.

## Start here

- [[Research notes/AI glasses server architecture]] — consolidated architecture, protocols, data model, security, and roadmap
- [[Research notes/Research note 1]] — original exploration and Ubuntu setup notes
- [[HardwareInfo/HardwareNOte]] — hardware decisions still to be benchmarked
- `PythonClient/client.py` — current command-line client
- `UbuntuServerOSVMCode-main/UbuntuServerOSVMCode-main/` — ASP.NET Core prototype

## Current phase

The repository is at the infrastructure-prototype stage. Health checks, diagnostics, API-key protection, rate limiting, and disabled-by-default restart/shutdown operations exist. Vision inference, PostgreSQL CRUD, device telemetry, real-time state, and the glasses UI are designs, not implementations yet.
