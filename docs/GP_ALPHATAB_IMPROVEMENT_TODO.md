# GP / alphaTab Improvement Plan

This TODO tracks the Guitar Pro and alphaTab integration cleanup. The current app uses alphaTab for GP rendering and a custom SpessaSynth scheduler for shared MusicXML/GP playback and scoring.

## Decision For The Current Phase

Keep the custom SpessaSynth scheduler as the playback authority for now. It is already integrated with MusicXML, Note Highway scoring, harmonica soundfonts, and latency compensation.

Use alphaTab primarily for:

- Loading and rendering Guitar Pro scores.
- Track discovery and selected-track rendering.
- Visual cursor positioning through ticks.
- Public API events and readiness signals.

Do not switch the whole GP playback model until the sync surface is covered by fixture tests.

## Phase 1: Stabilize alphaTab Integration

- [x] Use the official `@coderline/alphatab-vite` plugin already configured in `vite.config.ts`.
- [x] Replace hardcoded CDN SoundFont URL with the local Vite-copied alphaTab soundfont path.
- [x] Stop reading alphaTab private audio internals such as `_out` and `_audioContext`.
- [x] Replace private `masterTransposition` writes with public `changeTrackTranspositionPitch`.
- [x] Remove score-model mutation hacks from `AlphaTabViewer` where possible.
- [x] Make `AlphaTabViewer` report explicit player readiness to `MusicXML.tsx`.
- [ ] Remove or intentionally implement unused `isGp` behavior in `NoteHighway`.

## Phase 2: Improve GP Timeline And Sync

- [ ] Add fixture tests for `.gp`, `.gp3/.gp4/.gp5`, and `.gpx` if small test files can be committed.
- [ ] Cover repeat expansion, alternate endings, rests, chords, ties, tempo changes, and low guitar register handling.
- [ ] Extract GP tick mapping into a helper:
  - `expandedEventIndex -> originalTick`
  - `originalTick -> expanded event indexes`
  - seek behavior for repeated sections
- [x] Smooth alphaTab cursor movement during custom GP playback with requestAnimationFrame tick interpolation.
- [ ] Replace the current first `originalTick >= tick` lookup with a deterministic seek strategy.
- [ ] Document invariants for `tick` and `originalTick` in `src/MusicXML/types.ts`.

## Phase 3: Architecture Cleanup

- [ ] Split `AlphaTabViewer.tsx` into:
  - `useAlphaTabApi`
  - `useAlphaTabTracks`
  - thin DOM viewer component
- [ ] Keep `alphaTabParser.ts` focused on score-to-playback-event conversion.
- [ ] Move GP-specific route state out of `MusicXML.tsx` into a route-local hook such as `useGpScore`.
- [ ] Decide whether alphaTab player should stay enabled for cursor support or move to external-media mode.

## Phase 4: Optional Bigger Decision

Choose one final GP audio model:

- **Custom SpessaSynth model:** best for unified harmonica playback/scoring, but requires custom tick/timeline sync.
- **alphaTab player model:** best for native GP fidelity, but requires bridging alphaTab events into Note Highway scoring and harmonica soundfont behavior.

Do not mix both as active audible playback engines.
