# Northstar Server Console

## Project Overview

Northstar is a responsive user-interface prototype for connecting to and managing Ubuntu servers. It presents a connection flow, a connection-failure state, and an operations dashboard for common administrative tools.

## Architecture

- **Framework:** TanStack Start with React 19 and file-based routing.
- **Deployment:** Netlify through the TanStack Start Vite adapter.
- **Styling:** Tailwind CSS is available, while the current interface uses custom global CSS for its visual system and responsive layouts.
- **Icons:** Lucide React.
- **State:** Local React state controls the prototype connection and dashboard interactions.

## Key Directories

- `src/routes/` contains file-based application routes.
- `src/routes/index.tsx` contains the connection screen, error state, dashboard shell, and tool views.
- `src/routes/__root.tsx` defines the document shell and page metadata.
- `src/styles.css` contains design tokens, component styles, animations, and responsive rules.
- `public/` contains static assets served from the site root.

## Conventions

- Use PascalCase for React components and camelCase for functions and state.
- Keep route components accessible with semantic labels and keyboard-focusable controls.
- Prefer existing CSS variables and component classes over introducing one-off colors.
- Preserve the industrial, warm-neutral visual language and IBM Plex Mono accents.
- Use Lucide icons rather than emoji or hand-built icon SVGs.
- Keep responsive behavior working at desktop, tablet, and mobile widths.

## Important Decisions

- The connection behavior is intentionally a front-end prototype; it does not open a real SSH session or retain credentials.
- Hosts containing `offline`, `invalid`, `fail`, or `404` trigger the designed error state for demonstration.
- Real remote administration requires a separately secured backend agent or gateway. Browser code must never receive private SSH keys or direct unrestricted shell access.

## Local Development

Install dependencies with `npm install`, then run `npm run dev`. Do not commit generated build output.
