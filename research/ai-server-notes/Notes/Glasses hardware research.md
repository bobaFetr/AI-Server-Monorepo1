# Glasses hardware research

_Research snapshot: 2026-08-20; last audited: 2026-08-22_

## Recommendation

Build the first wearable prototype as a **split system**:

```text
GLASSES FRAME                         POCKET / NECK COMPANION
scene camera ───────────────┐         Raspberry Pi Zero 2 W
microphone(s) ──────────────┼─ cable/BLE/Wi-Fi ─ Python device agent
display + optics ───────────┤         battery + charger + fuel gauge
IMU + input button ─────────┘         Wi-Fi connection to C# AI server
```

Do not try to run the LLM on the glasses or Raspberry Pi. The Pi captures and compresses images, handles audio and device state, renders/sends UI data, queues offline requests, and communicates with the C# server. The Ubuntu machine performs vision inference.

Putting a Linux computer, regulator, and large battery directly on the frame creates heat, temple imbalance, thick wiring, and short runtime. Once the complete flow works, replace the companion with a custom low-power board or phone connection.

## Compute options

| Option | Good for | Problems | Decision |
|---|---|---|---|
| Raspberry Pi Zero 2 W | First portable prototype | Only 512 MB RAM, 2.4 GHz Wi-Fi, Linux boot time, still too large/warm for elegant frames | **Recommended companion** |
| Raspberry Pi Compute Module 5 | High-performance embedded prototype | Requires carrier board; much higher power and thermal load | Bench or pocket use only |
| Phone companion | Later everyday prototype | Mobile integration and permissions are more complex | Strong phase-two option |
| Custom MCU/SoC board | Final frame | Expensive and difficult before requirements are measured | Do not start here |

The Zero 2 W is 65 × 30 mm and about 12 g, with a quad-core 1 GHz Cortex-A53, 512 MB RAM, 2.4 GHz Wi-Fi, Bluetooth 4.2/BLE, USB OTG, and one CSI-2 camera connector ([Raspberry Pi Zero 2 W](https://www.raspberrypi.com/products/raspberry-pi-zero-2-w/)). Its product brief specifies a 5 V input and sizes the recommended supply at up to 2.5 A; this is a supply ceiling, not the expected continuous draw ([Zero 2 W product brief](https://pip-assets.raspberrypi.com/categories/584-raspberry-pi-zero-2-w/documents/RP-008359-DS-1-raspberry-pi-zero-2-w-product-brief.pdf)).

Compute Module 5 is 55 × 40 × 4.7 mm with a 2.4 GHz Cortex-A76 and current 2, 4, 8, or 16 GB RAM options, but it needs a custom carrier ([official CM5 product page](https://www.raspberrypi.com/products/compute-module-5/)). Raspberry Pi's development kit includes a 27 W USB-C supply, but that supply rating is not the module's measured power draw. The CM5's substantially higher compute and cooling requirements still make it a bench or pocket candidate rather than a sensible first choice for a glasses temple; measure the complete carrier, camera, display, and workload before sizing power or cooling.

### Proposed Pi configuration

- Raspberry Pi Zero 2 W without a soldered GPIO header
- Raspberry Pi OS Lite, no desktop
- Python device agent started by `systemd`
- read-only/root filesystem hardening later to reduce SD-card corruption
- Wi-Fi to the Ubuntu server; BLE reserved for low-rate controls if needed
- camera connected through the Zero camera ribbon adapter
- digital microphone over I²S or a USB audio evaluation board
- battery/fuel gauge exposed to Python over I²C

## Cameras

### Outward scene camera

Start with **one** outward-facing camera. Two scene cameras only become useful if true stereo depth is required; they double bandwidth, calibration, synchronization, mounting, and inference cost.

Raspberry Pi Camera Module 3 is a good bench prototype: Sony IMX708, approximately 12 MP, phase-detection autofocus, CSI-2, HDR, and standard/wide/NoIR variants ([Camera Module 3 product brief](https://datasheets.raspberrypi.com/camera/camera-module-3-product-brief.pdf)). The board is approximately 25 × 24 × 11.5 mm and 4 g; the wide version is slightly taller. The standard lens has roughly a 75° diagonal field of view and the wide version about 120° ([Raspberry Pi camera comparison](https://www.raspberrypi.com/app/uploads/2025/03/Industrial-Customer-Presentation_Camera-Modules.pdf)).

Recommendation:

- use the standard Camera Module 3 for the first desk/indoor prototype;
- select Wide only if testing shows that head direction misses important context;
- capture a still at 1280×720 or similar, then compress to JPEG/WebP before upload;
- do not continuously stream full-resolution video to the AI server;
- add a visible capture LED wired independently enough that software cannot silently fake its state;
- design a physical camera shutter for later versions.

Camera Module 3 is too bulky for attractive final glasses. It validates optics, autofocus, Python capture, compression, and server transport. A final frame will need a smaller camera module on a flex cable and a custom PCB.

### Eye-tracking cameras

Eye tracking does **not** use the outward scene camera. Binocular gaze normally requires one inward-facing near-infrared camera per eye, controlled IR illumination, synchronization, calibration, and safe optical/mechanical design. That means the eventual design may have three cameras:

1. one outward scene camera;
2. one left-eye inward camera;
3. one right-eye inward camera.

Do not add custom eye cameras in the first hardware milestone. Validate the UI with mouse/head direction, then use an existing eye-tracking platform before attempting custom IR optics.

## Microphones and audio

Start with one digital MEMS microphone near the bridge or one temple, isolated from fan/regulator noise. Move to two microphones only after measuring outdoor wind and speech quality; a two-mic array can support noise reduction and beamforming but needs spacing, matching, calibration, and DSP.

Avoid copying old tutorials that specify the ICS-43434: its manufacturer now marks it end-of-life. A current candidate is the **TDK T5848**, an I²S MEMS microphone with 20-bit digital output, a 3.5 × 2.65 × 0.98 mm package, and acoustic activity detection as low as 20 µA ([TDK T5848](https://www.invensense.tdk.com/en-us/products/microphone/t5848)). Its modes include approximately 310 µA high-quality, 120 µA low-power, and 9 µA sleep according to the datasheet ([T5848 datasheet](https://invensense.tdk.com/wp-content/uploads/2024/04/DS-000479-T5848-Datasheet-v1.0.pdf)).

For the first prototype, use an evaluation/flex board rather than trying to hand-solder the bare MEMS package. Add:

- a microphone opening with acoustic mesh;
- mechanical wind protection;
- push-to-talk first, wake-word later;
- a clear microphone-active UI indicator;
- optional small speaker or bone-conduction transducer only after input works.

## Display and optics

The optical display is harder than the React UI. A web page cannot be projected into the eye without a microdisplay, driver/FPGA, prism or waveguide, collimating optics, mechanical alignment, and brightness management.

Brilliant Labs Frame is a useful reference architecture: a 640×400 color micro-OLED, 20° field of view, 720p camera, microphone, Bluetooth MCU, FPGA graphics/camera path, IMU, and 210 mAh of built-in battery ([Frame hardware manual](https://docs.brilliant.xyz/frame/hardware/)). It demonstrates that practical frame electronics use an MCU/FPGA and aggressively switch subsystems off; it is not equivalent to mounting a Raspberry Pi on the temple.

For the project:

- use an off-the-shelf monocular display/developer glasses for the first wearable UI;
- treat the current two-lens React view as a simulator—two visible browser panels do not require two physical displays;
- render sparse, high-contrast information and preserve the central view;
- never cover both eyes with opaque UI;
- do not use while driving or operating equipment.

## Battery, charging, and percentage reporting

Use a protected **single-cell Li-ion/LiPo pack** in the pocket companion for the first version. Do not put an unprotected pouch cell next to the temple, do not connect random cells in parallel, and do not design a custom charger as the first power prototype.

Required power blocks:

```text
protected 1S LiPo
      |
charger with power-path/load sharing
      |
efficient regulated 5 V rail -> Raspberry Pi
      |
3.3/1.8 V rails as required -> sensors

battery -> fuel gauge over I²C -> Python -> React battery percentage
```

The MAX17048 is a suitable single-cell fuel-gauge reference: it measures voltage/state of charge, reports over I²C, needs no current-sense resistor, and draws about 3 µA in hibernate ([Analog Devices MAX17048](https://www.analog.com/en/products/max17048.html)). A fuel gauge is better than converting battery voltage directly into a percentage because Li-ion discharge voltage is nonlinear and varies under load.

For a bench prototype, a charger/boost module with power-path sharing is safer than separate charger and boost boards. For example, Adafruit’s PowerBoost 1000C combines a 1-cell charger, load sharing, and regulated 5 V output, but its roughly 1 A output class may be insufficient for all Pi/camera/display combinations and must be validated under peak load ([PowerBoost 1000C guide](https://cdn-learn.adafruit.com/downloads/pdf/adafruit-powerboost-1000c-load-share-usb-charge-boost.pdf)). Do not treat this example board as the final wearable power design.

### Battery sizing method

Do not promise runtime from battery capacity alone. Measure average and peak power in these states:

- sleep/idle;
- display on;
- microphone listening;
- camera preview;
- still capture and compression;
- Wi-Fi upload;
- reconnect loop.

Use:

```text
battery energy (Wh) = nominal voltage × capacity (Ah)
estimated runtime (h) = battery Wh × conversion efficiency / average system W
```

Illustrative calculation only: a 3.7 V, 2000 mAh pack contains 7.4 Wh. At 80% usable conversion efficiency, about 5.9 Wh reaches the load. A measured 3 W average system would therefore run for about 2 hours. Actual runtime must come from a power meter, not this assumption.

Starting recommendation: prototype with a protected 2000–3000 mAh pocket pack, then downsize after measuring. Log battery voltage, reported percentage, charging state, board temperature, undervoltage events, and shutdown reason.

## Thermal, mechanical, and safety constraints

- Keep hot processors and boost converters away from skin.
- Measure temple, bridge, processor, regulator, and battery temperatures.
- Balance left/right mass; heavy asymmetry quickly becomes uncomfortable.
- Use strain relief on every flex/ribbon cable and rounded enclosures near skin.
- Keep RF antenna clearance; do not bury the Pi antenna behind a battery or metal hinge.
- Add a physical power button and safe shutdown, not just power removal.
- Add brownout detection and a local offline queue.
- Use certified protected cells and a charger matched to the exact chemistry/capacity.
- Include camera/microphone privacy indicators and retention controls.
- Expect later compliance work for battery transport, charging, EMC/RF, and optical safety.

## Prototype bill of materials

| Subsystem | First prototype | Later wearable version |
|---|---|---|
| Compute | Raspberry Pi Zero 2 W in pocket enclosure | Phone companion or custom low-power SoC/MCU |
| Scene camera | Camera Module 3 Standard + Zero ribbon | Small flex camera, custom mount/PCB |
| Microphone | T5848 evaluation/flex board or supported USB mic | One/two MEMS mics on custom PCB |
| Display | Existing monocular AR display/dev glasses | Custom micro-OLED + prism/waveguide |
| Motion | USB/I²C 6-axis IMU breakout | Low-power IMU on frame PCB |
| Battery | Protected 1S 2000–3000 mAh pocket pack | Split/custom pack only after safety engineering |
| Power | Power-path charger + validated 5 V regulator | Custom PMIC, charger, thermal monitoring |
| Fuel gauge | MAX17048 breakout | Fuel gauge on custom board |
| Input | Physical button + microphone | Gaze, tap, voice, and physical fallback |
| Enclosure | 3D-printed camera mount and companion case | Balanced custom frame and flex PCBs |

## Build sequence and acceptance tests

### Stage 1 — bench

1. Pi boots headless and starts the Python agent automatically.
2. Camera captures and locally stores a compressed still.
3. Button or CLI triggers capture; privacy LED activates.
4. Microphone records clean speech with a visible state indicator.
5. Battery board powers the system during capture and Wi-Fi bursts without undervoltage.
6. Fuel gauge percentage reaches the React UI.

### Stage 2 — wearable companion

1. Camera and input mount on safety glasses; Pi/battery remain in a pocket enclosure.
2. Cable has strain relief and cannot pull the frame off the face.
3. End-to-end capture-to-answer works while walking on Wi-Fi.
4. Measure runtime, skin-adjacent temperature, packet loss, audio wind noise, and total carried mass.

### Stage 3 — display

1. Integrate an existing monocular display.
2. Reduce ARGUS UI to legible high-priority elements.
3. Verify the user can always see the environment and dismiss overlays.
4. Test menu activation with a physical control before gaze.

### Stage 4 — eye tracking/custom frame

Only begin after the first three stages produce measured requirements. Evaluate a supported eye tracker, then decide whether custom inward cameras, IR lighting, optics, and a custom PCB are justified.

## Measurements needed before buying final hardware

- acceptable glasses/frame mass and companion mass;
- target continuous runtime and charge time;
- camera field of view and minimum useful resolution;
- capture-to-answer latency budget;
- indoor/outdoor brightness requirement;
- microphone performance in wind and traffic;
- maximum safe skin/contact temperature;
- peak and average power for every operating state;
- whether the product needs monocular or binocular display;
- whether raw images/audio are retained or deleted after inference.
