# Waveguide and Vegalas display research

_Research snapshot: 2026-08-21_

## Purpose

This note evaluates a miniature RGB laser light engine and the waveguide optics needed to turn it into a transparent smart-glasses display. It is relevant to the eventual ARGUS wearable display, but it does not change the recommendation to start with an existing monocular display or developer-glasses platform.

## Sources and source quality

- [IGS summary of the ams OSRAM Vegalas prototype](https://i-groupuk.com/ams-osram-vegalas-rgb-laser-module-prototype-demonstrates-a-0-7cm%C2%B3-light-engine-for-smart-glasses-that-fits-in-standard-consumer-fashion-frames/), published 2022-02-10. This closely repeats a manufacturer press release and should be treated as product/promotional material, not an independent benchmark.
- [Original ams OSRAM Vegalas announcement](https://ams-osram.com/ko/news/press-releases/ams-osram-vegalas%E2%84%A2-rgb-laser-module-prototype-demonstrates-a-0.7cm%C2%B3-light-engine-for-smart-glasses-that-fits-in-standard-consumer-fashion-frames), published 2022-01-24. This is the primary source for the dimensions, wavelengths, reference-design partners, and claimed size reduction.
- [Heise explanation of smart-glasses waveguides](https://www.heise.de/en/background/Waveguides-explained-How-the-display-in-smart-glasses-and-AR-glasses-works-10711288.html), published 2025-10-03. This is a useful technical overview, but some product comparisons and performance statements depend on manufacturer information.
- [SCHOTT overview of AR waveguide types](https://www.schott.com/en-hr/expertise/applications/waveguides-for-augmented-reality) and [SCHOTT geometric reflective waveguides](https://www.schott.com/en-pl/products/schott-reflective-waveguides-p1001190). These corroborate the optical principles but are also commercial sources.

## What Vegalas actually is

Vegalas is a hermetically sealed, surface-mount RGB laser-emitter module. The announced prototype combines:

- red at 640 nm;
- green at 520 nm;
- blue at 450 nm;
- a 7.0 × 4.6 mm footprint;
- a 1.2 mm package height.

The hermetic package protects the laser dies from contamination and degradation. RGB sources allow a scanning system to synthesize full-colour pixels by controlling the three channels.

The important distinction is:

```text
Vegalas module = RGB light source only

0.7 cm³ reference light engine = Vegalas RGB source
                                + STMicroelectronics MEMS mirror
                                + associated projection optics/package
                                + interface to a Dispelix waveguide
```

The 0.7 cm³ headline does not describe an entire display, lens, temple assembly, battery, processor, or pair of glasses.

## Size calculations

### Vegalas package volume

Treating its bounding box as a rectangular volume:

```text
volume = 7.0 mm × 4.6 mm × 1.2 mm
       = 38.64 mm³

1 cm³ = 1000 mm³
38.64 mm³ / 1000 = 0.03864 cm³
```

This is only the package's bounding-box volume. It does not give active optical volume, mass, required PCB area, keep-out zone, connector space, or thermal area.

### Reference light-engine volume

The reference engine dimensions were 10 × 11 × 6 mm:

```text
volume = 10 mm × 11 mm × 6 mm
       = 660 mm³
       = 0.66 cm³
       ≈ 0.7 cm³ when rounded to one decimal place
```

The published 0.7 cm³ figure is therefore arithmetically consistent with the dimensions.

The light-engine bounding volume is approximately:

```text
660 mm³ / 38.64 mm³ = 17.08
```

or about 17 times the RGB package's bounding volume. This does not mean that Vegalas occupies exactly 1/17 of the physical assembly; the two bounding boxes include different unused spaces and packaging constraints.

### Claimed reduction

The older three-emitter reference engine was stated as 1.7 cm³. Comparing it with the exact 0.66 cm³ bounding volume:

```text
reduction = (1.70 − 0.66) / 1.70 × 100
          = 61.18%

remaining volume = 0.66 / 1.70 × 100
                 = 38.82%
```

Using the rounded 0.7 cm³ headline instead:

```text
reduction = (1.70 − 0.70) / 1.70 × 100
          = 58.82%
```

Both support the press release's “some 60% smaller” language. “Up to half the size” and “about 60% smaller” are broad marketing descriptions based on different rounding or comparison language; the dimensions give the clearer result.

## How a waveguide display works

A transparent smart-glasses display has two major optical subsystems:

1. The **light engine** creates a tiny image and injects its light into the lens at controlled angles.
2. The **waveguide** transports that light across the lens and redirects it into the eye while still transmitting light from the real environment.

The waveguide process is:

```text
image/light engine
      ↓
input coupler injects light into the lens
      ↓
total internal reflection transports it through the substrate
      ↓
output coupler sends it toward the eye
      ↓
the user sees a virtual image over the real scene
```

### Total internal reflection

Light is retained when it travels from a higher-index material toward a lower-index material and strikes the boundary beyond the critical angle. The idealized critical-angle relationship is:

```text
critical angle θc = arcsin(n₂ / n₁), where n₁ > n₂
```

Here `n₁` is the waveguide's refractive index and `n₂` is the adjacent lower-index material. A higher substrate index can provide more angular design space, which can help field of view and compactness. It does not automatically guarantee a good display; coupling structures, colour, eyebox, efficiency, thickness, and manufacturing tolerances still dominate the result.

### Eye box and pupil expansion

The output optics normally repeat or expand the light so the image remains visible across a usable eye box rather than at one exact pupil location. This creates a central engineering trade-off:

```text
larger eye box / wider field of view
often requires more optical replication
which can reduce efficiency and uniformity
```

Without a sufficiently forgiving eye box, ordinary frame movement or imperfect fit makes the image disappear or clip.

## Diffractive and geometric reflective waveguides

### Diffractive waveguides

Diffractive designs use nano-scale gratings to couple, redirect, and extract light.

Advantages:

- can support wide fields of view;
- thin, lens-like form factors;
- mature research ecosystem and several prominent AR prototypes.

Challenges:

- wavelength-dependent diffraction complicates full-colour uniformity;
- rainbow artefacts and colour nonuniformity can appear;
- some display light can leak outward and make the display visible to other people;
- nanoimprint precision and low-defect manufacturing across a lens are difficult;
- optical efficiency can increase source power and battery requirements.

Heise cites Meta's Orion prototype as an extreme example: a silicon-carbide diffractive substrate and a claimed 70° field of view. The article says its projection area is around 16 times that of the smaller Meta HUD. Area ratio is not a direct field-of-view ratio, so the smaller display's angular FOV cannot be reliably calculated from those two numbers alone.

### Geometric reflective waveguides

Geometric reflective designs use carefully arranged partially reflective surfaces or mirrors in the lens rather than nano-gratings for extraction.

Advantages described by Heise, SCHOTT, and Lumus include:

- higher optical efficiency for suitable designs;
- good brightness and image quality;
- less wavelength-dependent behaviour;
- lower outward light leakage;
- a good match for compact, monocular HUDs.

Challenges:

- mirror coating and placement require extremely tight tolerances;
- brightness or colour can vary when surfaces are imperfect;
- field of view has historically been more constrained in consumer-sized implementations;
- the waveguide remains a specialized manufactured optical component, not a generic lens that can be built from the React UI or ordinary glass.

SCHOTT announced serial-production capability for geometric reflective waveguides in 2025. That improves supply-chain credibility, but it does not imply that small developers can buy arbitrary custom units cheaply or integrate them without an optical partner.

## Laser-scanning implications

The Vegalas reference design uses laser-beam scanning (LBS): RGB intensity is modulated while a MEMS mirror scans the beam to form the image. Potential advantages are a very small source and focus-free projection. The engineering burden includes:

- precise timing between RGB modulation and mirror position;
- scanner drive electronics and control firmware;
- optical alignment into the waveguide input coupler;
- brightness control using ambient-light sensing;
- speckle and image-uniformity management;
- heat and electrical peak-load management;
- fault detection if the scanner stalls or behaves abnormally;
- formal laser eye-safety analysis and certification for every operating and single-fault condition.

The last point is decisive: a laser aimed through optics toward the eye is not a safe hobby integration simply because each component is small. The completed product—not just the emitter—must be evaluated for accessible emission, scanner faults, drive faults, reflections, assembly tolerance, and foreseeable misuse by qualified optical-safety engineers.

## Missing information

The two articles do not provide enough information to select or design the ARGUS display. Missing decision data include:

- current Vegalas ordering status, price, minimum order, and developer kit availability;
- optical output power and wall-plug efficiency by colour;
- electrical average and peak power;
- achievable resolution, refresh rate, brightness, contrast, and colour gamut;
- field of view and eye-box dimensions for the reference design;
- waveguide transmission and complete-system optical efficiency;
- distortion, uniformity, speckle, ghosting, and outdoor visibility measurements;
- MEMS scanner lifetime, shock resistance, acoustic behaviour, and fault modes;
- driver ASIC, calibration equipment, firmware, and licensing requirements;
- engine mass and thermal limits;
- prescription-lens compatibility;
- eye-safety classification and evidence;
- whether the 2022 reference design entered accessible volume production as originally expected in 2023.

The old production forecast should not be treated as proof of present availability. Request a current datasheet, safety documentation, reference-design manual, sample quote, and integration agreement directly from ams OSRAM or an authorized optical partner.

## Assessment for ARGUS

### What I think

The technology is directionally excellent for a final consumer-looking product, but it is a poor choice for the project's first custom display prototype.

The 0.7 cm³ result solves only one portion of the wearable problem: projection-engine volume. It does not solve waveguide sourcing, eye box, display control, battery capacity, thermal management, prescription optics, mechanical alignment, calibration, laser safety, or manufacturability. Those are precisely the areas most likely to consume time and money before the current camera-to-AI flow and physical interaction design are validated.

For ARGUS, the best product direction is a **monocular, sparse HUD**, not a wide-field binocular AR system. The current application needs short AI answers, status, navigation cues, targeting feedback, and privacy indicators. It does not yet need anchored 3D graphics across a 70° field. A small field of view reduces pixel count, optical power, heat, rendering load, calibration difficulty, and obstruction of the real scene. It also aligns with the existing recommendation to keep one eye unobstructed.

Geometric reflective waveguides look particularly attractive for that final HUD goal because efficiency, outdoor brightness, colour quality, and low outward leakage matter more to ARGUS than maximum immersion. Vegalas-style LBS remains an interesting alternative light engine if a complete supported reference platform is obtainable. It should not be selected from package volume alone.

### Recommended development path

1. Keep the current dual-lens React design as a desktop simulator, but design the physical information hierarchy for one monocular display.
2. Integrate an existing commercial or developer monocular display first. Measure legibility, preferred eye, useful field of view, brightness, interaction timing, motion comfort, and power.
3. Convert the interface to sparse text and symbols suitable for a small eye box and outdoor contrast.
4. Ask suppliers for complete display-module proposals, not only emitters: light engine, waveguide, driver, calibration process, firmware, safety evidence, price, and availability.
5. Compare at least geometric reflective and diffractive solutions using measured FOV, eye box, nits at the eye, transmission, power, mass, colour uniformity, prescription support, and leakage.
6. Consider a Vegalas/MEMS custom path only after the server, camera, audio, battery, and monocular UX have measurable requirements and the project has an optical engineering and laser-safety partner.

## Decision

Do not purchase or design around the 2022 Vegalas prototype announcement alone. Record it as evidence that a sub-1 cm³ RGB scanning light engine is physically plausible. For the next wearable prototype, buy or partner for a complete monocular optical module; for a later custom frame, prioritize an efficient reflective-waveguide HUD unless testing establishes a real need for wide-field diffractive AR.

