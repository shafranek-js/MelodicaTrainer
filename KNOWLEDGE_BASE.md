# NoteBender / HarpTrainer Knowledge Base

This file is the consolidated working knowledge base for the application. It merges the important guidance from the root markdown documents, subsystem skills, and soundfont notes, while correcting points that have drifted from the current code.

## Product Identity

The repository path is `NoteBender`, while most product-facing and deployment documentation still uses `HarpTrainer`.

Current deployment assumptions:

- The app is a Vite React 19 + TypeScript harmonica trainer.
- Routing uses `HashRouter` for GitHub Pages compatibility.
- `vite.config.ts` currently uses `base: "/HarpTrainer/"`.
- The README live demo points to `https://shafranek-js.github.io/HarpTrainer/`.

Avoid renaming the product, repository, route base, or GitHub Pages target casually. Treat naming as a deployment/product decision.

## Core App Shape

The app combines:

- A real-time harmonica pitch visualizer.
- Diatonic harmonica layout mapping.
- MusicXML loading, transformation, harmonica tab injection, OSMD rendering, playback, and note-highway scoring.
- Guitar Pro loading through AlphaTab with harmonica-oriented parsing and playback-event generation.
- A note-highway practice game.
- A dedicated practice trainer.
- A circle-of-fifths theory view.

Primary route files:

- `src/App.tsx`: app shell, lazy route registration, global menu bridge.
- `src/Menu.tsx`: top navigation, notation toggle, MusicXML playback controls.
- `src/Harmonica/Harmonica.tsx`: harmonica visualizer.
- `src/MusicXML/MusicXML.tsx`: largest route; coordinates score loading, transformation, rendering, playback, scoring, and controls.
- `src/Practice/Practice.tsx`: practice and bend trainer.
- `src/Circle/Circle.tsx`: circle-of-fifths theory explorer.

## UI Layout and Controls

The application uses an immersive, full-screen layout where supporting panels are implemented as collapsible, sliding drawers to maximize the space available for the Note Highway:

- **Menu Panel (Top, cascading):** Hovering the absolute top edge of the screen reveals the global menu.
- **Score Panel (Top, underneath Menu):** Contains OSMD/AlphaTab sheet music. Slides down when hovering the area just below the menu.
- **Settings Panel (Left):** Hovering the left edge slides out score settings.
- **Transpose Controls (Right):** Hovering the right edge slides out transposition and view options.
- **Pinning:** Each panel has a "Pin" button to toggle persistent visibility (saved in local storage).
- **Global Toggle:** Right-clicking anywhere on the Note Highway immediately toggles the pinned state of all four panels at once.

**Playback Controls:**
- `Space` or `Left-Click` on Note Highway: Toggle Play/Pause.
- `Escape`: Stop playback and rewind to the start.
- `+` / `-` keys: Increase / Decrease tempo by 5 BPM.
- `Mouse Wheel` on Note Highway: Scroll up/down to adjust tempo by 5 BPM (triggers a temporary visual BPM overlay).

## Commands And Validation

Use these commands:

```bash
npm ci
npm run dev
npm test
npm run lint
npm run build
```

Preferred validation by change type:

- MusicXML pure helpers: targeted Vitest first, then broader tests if behavior is meaningful.
- MusicXML React/audio/OSMD changes: `npm run build` plus manual browser smoke test.
- App shell or route changes: `npm run build`, `npm run lint`, and manual navigation check if UI behavior changed.
- Harmonica core changes: `npm run build` and focused tests in `src/utils`.
- Circle/Practice derivation changes: existing focused tests in `src/Circle` or `src/Practice`.

Current lint policy is strict. `npm run lint` may pass with warnings from `react-hooks/exhaustive-deps`; treat new warnings as debt unless intentionally accepted.

## Working Rules

Follow `AGENTS.md` and the subsystem skill files before changing code:

- `skills/notebender-app-shell` for routing, Vite, menu, notation language, app shell UI.
- `skills/notebender-harmonica-core` for layout, pitch detection, hole mapping, tuning feedback.
- `skills/notebender-musicxml` for MusicXML, MXL, GP, OSMD, AlphaTab, playback, note highway, scoring.
- `skills/notebender-practice-trainer` for Practice route behavior.
- `skills/notebender-circle-theory` for Circle route behavior.

Coding rules:

- Keep TypeScript strictness intact.
- Use Tonal APIs for note, MIDI, chroma, interval, scale, and chord work.
- Use DOMParser and XMLSerializer for MusicXML. Do not parse or rewrite XML with regex/string slicing.
- Preserve the first-part and first-staff policy unless explicitly changing the app model.
- Treat Web Audio and microphone flows as user-gesture-sensitive.
- Always clean up animation frames, media tracks, audio contexts, timers, and scheduled nodes.
- Keep UI in the existing compact dark Tailwind style with rounded borders and lucide icons where icons are already used.

## Harmonica Domain

Important conventions:

- Positive tab numbers are blow notes.
- Negative tab numbers are draw notes.
- Apostrophes represent bends.
- `o` suffix represents overblow or overdraw.
- Layout arrays represent holes 1 through 10 and use `null` where a row cannot produce a note.
- MIDI comparisons are preferred for enharmonic-safe equality.

Key files:

- `src/utils/utils.ts`: harmonica keys, layout generation, frequency conversion, note-to-hole mapping.
- `src/hooks/usePitchDetector.tsx`: microphone capture, Pitchy, RMS gate, clarity gate, stable-frame filtering, cleanup.
- `src/Harmonica/Harmonica.tsx`: live layout visualization.
- `src/MusicXML/musicXmlTransform.ts`: uses harmonica mapping for tab injection.

## Pitch Detection

Pipeline:

1. Request microphone access with `navigator.mediaDevices.getUserMedia`.
2. Use Web Audio `AnalyserNode` with a time-domain buffer.
3. Use Pitchy to estimate fundamental frequency and clarity.
4. Reject unusable input through RMS, clarity, optional allowed-MIDI, and stable-frame gates.
5. Convert stable frequency to note/cents through shared utilities.

MusicXML route currently enables detection only during playback with events and uses:

- `minClarity`: `0.82`
- `minRms`: `0.012`
- `stableFrames`: `2`
- `allowedMidiNumbers`: playable MIDI set from current playback events

Practice mode intentionally uses a tighter hit threshold than MusicXML note-highway scoring.

## MusicXML Loading And Transformation

Supported inputs:

- Default `public/IntroSong.musicxml`.
- User-uploaded `.xml`, `.musicxml`, `.mxl`.
- User-uploaded Guitar Pro formats `.gp`, `.gp3`, `.gp4`, `.gp5`, `.gpx`.

MusicXML pipeline:

1. `readMusicXmlFile` reads raw XML or extracts primary score XML from MXL with JSZip.
2. `parseMusicXmlDocument` centralizes parse errors and route-safe messages.
3. `injectHarmonicaTabs` transposes targeted notes and injects harmonica fingerings.
4. `createFirstStaffDisplayXml` narrows display to the first part and first staff.
5. OSMD renders the transformed display XML.
6. `parsePlaybackEvents` creates playback events for timing, audio, cursor sync, and note-highway rendering.

MusicXML rules:

- Transpose only targeted first-staff notes.
- Update key signatures when transposing.
- Rewrite pitch through XML helpers.
- Remove `default-y` and `relative-y` from changed notes.
- Replace old fingering entries before writing new harmonica tab fingerings.
- Insert new `notations` before `lyrics`, `play`, or `listen` when needed.
- HarpTabs export groups chord fingerings with `/` and emits one non-empty line per measure.

## Playback, Timeline, And Scoring

Core files:

- `src/MusicXML/playbackParser.ts`
- `src/MusicXML/playbackTimeline.ts`
- `src/MusicXML/audioPlayback.ts`
- `src/MusicXML/useNoteHighwayScoring.ts`
- `src/MusicXML/NoteHighway.tsx`
- `src/MusicXML/constants.ts`

Current constants:

- `NOTE_HIT_WINDOW_MS = 200`
- `NOTE_PITCH_TOLERANCE_CENTS = 45`
- `NOTE_TARGET_LINE_PERCENT = 78`

Hit detection currently requires:

- A target event within the hit window.
- Detected MIDI membership in the target event's MIDI set.
- Absolute cents deviation less than or equal to `NOTE_PITCH_TOLERANCE_CENTS`.
- Pitch detector output has already passed clarity/RMS/stability filtering.
- Re-articulation for consecutive identical notes (a previously "consumed" pitch must stop or change before it can be scored again).

Miss detection:

- A note event becomes a miss only after the playhead passes `timing.startMs + NOTE_HIT_WINDOW_MS`.
- Already scored events are tracked to avoid duplicate hit/miss accounting.

Accuracy:

- `hits / (hits + misses) * 100`, rounded.

## Guitar Pro And AlphaTab

Current implementation is hybrid:

- AlphaTab loads and renders GP files.
- `alphaTabParser.ts` extracts track events into the shared `PlaybackEvent[]` shape.
- Repeat sections are expanded into a linear internal event list.
- Events carry `tick` for expanded playback position and `originalTick` for visual AlphaTab cursor positioning.
- `MusicXML.tsx` still builds a millisecond `playbackTimeline` with `createPlaybackTimeline`.
- On GP visual sync, `originalTick` is sent back to AlphaTab through `setTickPosition`.
- AlphaTab `playerPositionChanged` reports `currentTick`; when not playing, this is mapped back to the app timeline for navigation.

Important correction:

- `docs/archive/GP_SYNC_LOGIC.md` describes a tick-based `NoteHighway` mode driven by `isGp`. The current `NoteHighway` prop still exists, but the component does not currently switch its geometry or timeline math based on `isGp`.

This means GP timing/sync should be treated as fragile. Before changing it, inspect `AlphaTabViewer.tsx`, `alphaTabParser.ts`, `MusicXML.tsx`, and `NoteHighway.tsx` together.

## Auto-Transpose

Current implementation is not just "first valid interval wins".

Current behavior:

- `findBestTransposeIntervals(midiNumbers, options)` searches `-36..+36` semitones.
- It scores each interval by invalid notes and filtered techniques.
- Missing notes are heavily penalized.
- Overblow/overdraw and bend filters add smaller penalties when enabled.
- It returns all intervals tied for the best score, sorted by distance from zero.
- `findAutoTransposeIntervals(xml, options)` extracts first-staff MusicXML MIDI numbers and delegates to the same scoring.
- `MusicXML.tsx` uses the list to cycle among equally optimal variants.
- GP auto-transpose removes the current transpose from playback MIDI numbers, finds best absolute intervals, and cycles them.

Filters:

- `noOverblowOrDraw`: rejects or penalizes tabs containing `o`.
- `noBend`: rejects or penalizes tabs containing `'`.

## Advanced Notation And Note Highway

Current visual direction:

- Natural notes use normal width.
- Bends are visually narrower based on bend depth.
- Overblows/overdraws are wider.
- Same-hole transitions can become tapered/scoop-like SVG shapes.
- Note blocks are rendered as SVG paths with HTML overlays for labels, bend/overblow indicators, and clarity bars.

Known refactoring target:

- Move target-width and path geometry into a pure `highwayGeometry.ts`.
- Parse bend depth and overblow metadata once during playback parsing instead of regex parsing during rendering.
- Componentize overlays such as note labels, arrows, and clarity bars.

## Practice Trainer

Practice route behavior:

- Explore mode shows scale membership without requiring targets.
- Practice mode uses playable targets in the selected scale.
- Bends mode filters targets to bend rows.
- 12-bar blues mode highlights I/IV/V chord tones based on selected position tonic.

Current hit logic is intentionally stricter than MusicXML scoring:

- Exact MIDI match.
- About `25` cents tolerance.

Key helpers:

- `src/Practice/practiceTargets.ts`
- `src/Practice/practiceTargets.test.ts`

## Circle Theory

Circle route behavior:

- Generates circle of fifths by transposing C through perfect fifths.
- Uses Tonal chroma comparisons for enharmonic-safe highlighting.
- Maps harmonica positions, modes, scales, scale degrees, and triads.
- Builds triads only when the active scale has 7 notes.
- Uses chord quality colors as the shared visual semantic source.

Key helpers:

- `src/Circle/circleTheory.ts`
- `src/Circle/circleTheory.test.ts`

## Chromatic Harmonica Support

Chromatic support is planned, not fully implemented.

Plan summary:

- Add a `HarmonicaType` such as `diatonic | chromatic`.
- Extend `generateLayout` for 10-hole solo-tuned chromatic harmonica.
- Add chromatic tab notation such as `4`, `-4`, `4<`, `-4<`.
- Add UI selection and persistence.
- Update MusicXML tab injection and auto-transpose to use chromatic mappings.
- Add focused tests for chromatic layout and hole mapping.

Potential risks:

- Enharmonic duplicates and multiple physical ways to play the same note.
- More rows in the layout UI.
- Backward compatibility for diatonic users.

## Audio And SoundFonts

Audio stack:

- Web Audio API.
- SpessaSynth `WorkletSynthesizer` for SoundFont-backed playback.
- AlphaTab for GP rendering and related soundfont readiness.

Soundfont files live under `public/` and `public/soundfont/`.

The `public/soundfont/README.md` describes the Sonivox source and licensing context. Keep license files with redistributed soundfonts.

Audio lifecycle rules:

- Initialize or resume audio in user-triggered flows.
- Stop scheduled source nodes on playback stop.
- Stop all SpessaSynth notes when stopping playback.
- Clear timers and animation frames.
- Do not leave media tracks or audio contexts running after unmount.

## Performance And Bundle Shape

Current performance choices:

- MusicXML route is lazy-loaded.
- Circle and Practice routes are lazy-loaded.
- Harmonica route is eager as the default route.
- Vite manual chunks split OSMD/VexFlow and JSZip/Pako.

Known build warning:

- OSMD and MusicXML chunks are large after minification. This is expected for now.

Performance priorities:

- Keep high-frequency game clock state isolated.
- Avoid unnecessary deep rerenders in `NoteHighway`.
- Keep parser/transform logic pure and tested.
- Prefer extracting MusicXML route hooks over broad in-place edits.

## Refactoring Roadmap

Highest-value refactors:

1. Break up `MusicXML.tsx`.
2. Extract `useAudioEngine` for synth/audio context/playback scheduling.
3. Extract `useOsmdRenderer` for OSMD lifecycle and cursor behavior.
4. Extract `useGameClock` for requestAnimationFrame and visual playhead state.
5. Move note-highway geometry into pure utilities.
6. Parse tab technique metadata once in parser/transform helpers.
7. Replace fragile global menu bridge with a clearer local store or context only if the current bridge becomes a blocker.

Do not combine large refactors with behavior changes unless the task explicitly calls for it.

## Known Documentation Drift

The original markdown documents are useful, but some were written at different implementation stages.

Current corrections:

- Hit window is `200ms`, not `140ms`.
- Pitch tolerance for MusicXML note highway is `45 cents`.
- Auto-transpose returns and cycles best intervals; it is no longer simply first-match-wins.
- GP NoteHighway is not currently a fully tick-based renderer despite the archived `GP_SYNC_LOGIC.md`.
- Product naming is mixed between `NoteBender` and `HarpTrainer`; deployment currently remains `/HarpTrainer/`.

## Source Document Index

Active root docs consolidated here:

- `AGENTS.md`
- `README.md`

Archived root docs consolidated here:

- `docs/archive/APP_IMPROVEMENT_PLAN.md`
- `docs/archive/REFACTORING_PLAN.md`
- `docs/archive/ADVANCED_NOTATION_PLAN.md`
- `docs/archive/AUTOTRANSPOSE_LOGIC.md`
- `docs/archive/CHROMATIC_SUPPORT_PLAN.md`
- `docs/archive/CLARITY_INDICATOR.md`
- `docs/archive/GP_REPRISE_IMPLEMENTATION.md`
- `docs/archive/GP_SYNC_LOGIC.md`
- `docs/archive/NOTATION_LOADING.md`
- `docs/archive/PITCH_DETECTION_LOGIC.md`
- `docs/archive/SCORING_SYSTEM.md`

Subsystem skill docs consolidated here:

- `skills/notebender-app-shell/SKILL.md`
- `skills/notebender-harmonica-core/SKILL.md`
- `skills/notebender-musicxml/SKILL.md`
- `skills/notebender-practice-trainer/SKILL.md`
- `skills/notebender-circle-theory/SKILL.md`

Soundfont context:

- `public/soundfont/README.md`
