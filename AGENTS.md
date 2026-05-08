# NoteBender Agent Guide

## Project Shape

NoteBender is a Vite React 19 app for harmonica players. It combines real-time microphone pitch detection, diatonic harmonica layout mapping, MusicXML tab injection and playback, a note-highway practice game, a practice trainer, and a circle-of-fifths theory view.

Use the project-local skills in `skills/` before changing a subsystem:

- `skills/notebender-app-shell` for routing, Vite, Tailwind, navigation, and notation language behavior.
- `skills/notebender-harmonica-core` for harmonica layouts, hole notation, pitch detection, and tuning feedback.
- `skills/notebender-musicxml` for MusicXML loading, transforms, tab injection, OSMD rendering, playback parsing, audio scheduling, cursor sync, and note-highway scoring.
- `skills/notebender-practice-trainer` for the Practice route, target selection, bends mode, and 12-bar blues trainer.
- `skills/notebender-circle-theory` for the Circle route, modes, positions, scales, triads, and coloring.

The `.codex` directory in this workspace is read-only, so the skills live in `skills/` instead of `.codex/skills`.

## Commands

- Install dependencies with `npm ci`.
- Start local development with `npm run dev`.
- Run the unit test suite with `npm test`.
- Run linting with `npm run lint`.
- Run a production check with `npm run build`.

Prefer targeted Vitest runs while iterating on MusicXML helpers, for example `npm test -- src/MusicXML/playbackParser.test.ts`, then run the full relevant check before finishing.

## Architecture

- `src/App.tsx` uses `HashRouter` because the app deploys to GitHub Pages. Keep `vite.config.ts` base set to `/NoteBender/` unless deployment changes.
- `src/Menu.tsx`, `src/NotationSwitch.tsx`, `src/i18n.js`, and `src/styles.css` form the app shell and notation display layer.
- `src/utils/utils.ts` is the shared harmonica domain core. `generateLayout`, `freqToNoteAndCents`, and `getHarmonicaHoleForNote` are consumed by multiple routes.
- `src/hooks/usePitchDetector.tsx` owns microphone access, Web Audio setup, Pitchy detection, RMS gating, stable-frame filtering, and cleanup.
- `src/MusicXML/` is the largest subsystem. Pure XML transforms and parsers are separated from the React route where possible and have Vitest coverage.
- `src/Practice/Practice.tsx` and `src/Circle/Circle.tsx` are route-level feature views built mostly from shared Tonal and harmonica helpers.

## Coding Rules

- Keep TypeScript strictness intact. The app has `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`, and related checks enabled.
- Use Tonal APIs for note, MIDI, chroma, interval, scale, and chord work. Avoid hard-coded note math unless the harmonica layout itself requires it.
- Use DOMParser and XMLSerializer for MusicXML work. Do not parse or rewrite XML with ad hoc string manipulation.
- Preserve the first-part and first-staff policy in MusicXML helpers unless a task explicitly changes the app model.
- Treat Web Audio and microphone flows as user-gesture-sensitive. Always clean up animation frames, media tracks, audio contexts, timers, and scheduled nodes.
- Keep UI in the existing Tailwind style: dark app surfaces, compact controls, rounded borders, responsive grids, and lucide icons where icons are already used.
- Add or update focused tests for pure MusicXML parsing, transformation, or timeline behavior. Browser-only audio and OSMD behavior usually need build checks and manual verification.

## Important Domain Conventions

- Harmonica tab notation uses positive numbers for blow notes and negative numbers for draw notes.
- Bends are represented with apostrophes, and overblow or overdraw notes are suffixed with `o`.
- Layout arrays represent holes 1 through 10 and use `null` when a hole cannot produce a row's note.
- Pitch hit checks compare MIDI numbers and cents. The Practice trainer currently uses a tighter hit threshold than the MusicXML note highway.
- MusicXML rendering is narrowed to the first part and first staff for display and playback alignment.
