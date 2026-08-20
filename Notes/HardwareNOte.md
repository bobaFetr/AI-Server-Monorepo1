# Hardware notes

The required server hardware depends on the selected multimodal model, quantization, context/image size, desired response latency, and number of simultaneous devices. Do not buy final hardware from parameter count alone: benchmark the exact model/runtime first.

See [[AI glasses server architecture]] for the full system and milestone plan.

## Server measurements to record

- model and quantization
- model file size and peak RAM/VRAM
- cold-load time and warm image-to-first-token latency
- total response time and tokens/second
- idle and inference power consumption
- maximum safe concurrent jobs and thermals

## Glasses/companion hardware blocks

- outward-facing scene camera
- display/optics and supported Linux, Android, or OpenXR runtime
- battery plus fuel-gauge/charging controller
- Wi-Fi/Bluetooth radio
- microphone, speaker or bone-conduction audio
- physical confirmation/privacy control and capture indicator
- optional inward-facing near-infrared cameras and illumination for eye tracking
- compute module on the frame or a paired pocket/phone/Raspberry Pi-class companion

Start with off-the-shelf camera, display, and eye-tracking hardware. Custom frames, optics, and eye tracking should follow functional, power, heat, and comfort tests.
