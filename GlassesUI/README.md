# ARGUS Vision OS interface prototype

ARGUS is an interactive React prototype for the AI-glasses project. It presents the interface as two optical lenses rather than a conventional phone or desktop dashboard.

## Implemented prototype behavior

- two connected lens-shaped HUD surfaces
- scene targeting and simulated object confidence in the left lens
- AI response area and application controls in the right lens
- battery, remaining runtime, Wi-Fi, gaze, camera, server, and AI status inside the lenses
- hamburger menu contained in the upper-right of the right lens
- Look & Ask, Voice, Recent, Map, and eye-calibration menu options
- compact simulated navigation map
- draggable targeting reticle that returns to center when released
- simulated capture/analysis state and responsive narrow-screen layout

All values and responses are currently simulated. The interface is not yet connected to the Python device agent, physical glasses sensors, ASP.NET Core server, PostgreSQL, or a vision model.

## Requirements

- Node.js 22.13 or newer
- npm

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Validate

```bash
npm run build
npm test
```

## Main files

- `app/page.tsx` — interface state and interactions
- `app/globals.css` — lens geometry and cyberdeck styling
- `tests/rendered-html.test.mjs` — production-render smoke tests

## Planned integration

The React interface should communicate with a local Python device service. Python will own the camera, battery controller, eye tracker, microphone, offline queue, and communication with the C# server. See `../Research notes/AI glasses server architecture.md` for the system design.

This project is part of the main `AiServerReasearchNotes` repository and must not be treated as a separate Git repository.
