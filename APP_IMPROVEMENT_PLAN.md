# NoteBender Existing-App Improvement Plan

This review is intentionally scoped to improving the current app. It avoids new product features and focuses on reliability, maintainability, responsiveness, performance, accessibility, dependency health, and test coverage.

## Review Snapshot

Reviewed on 2026-05-08.

Checks run:

- `npm test`: passed, 8 files and 42 tests.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npm audit --json`: reported 24 vulnerabilities: 3 low, 7 moderate, 14 high.

Build note:

- The production build still warns because the OSMD vendor chunk is large: `dist/assets/osmd-*.js` is about 1,173.29 kB minified and 323.28 kB gzip.
- The MusicXML route code now builds as a small lazy chunk, about 33.29 kB minified and 11.33 kB gzip, with JSZip split into a separate 97.26 kB minified and 30.29 kB gzip chunk.
- The Circle and Practice routes build as separate lazy chunks: about 8.61 kB and 7.84 kB minified.

## Highest Priority Findings

### 1. Address direct dependency security findings

Locations: `package.json` and `package-lock.json`.

The audit has direct findings around packages used by the app/toolchain:

- `vite`: high severity findings in the current 6.x range.
- `react-router-dom`: affected through `react-router`.
- `opensheetmusicdisplay`: affected through transitive `gl`/native tooling dependencies.

Recommended steps:

- Upgrade direct dependencies in small batches, starting with Vite and React Router.
- For `opensheetmusicdisplay`, inspect the latest compatible version and changelog before changing because OSMD rendering is core to the app.
- Run `npm test`, `npm run lint`, and `npm run build` after each batch.
- Manually smoke-test `/musicxml` after OSMD-related changes with the bundled `IntroSong.musicxml` and one uploaded file.

### 2. Reduce the MusicXML route's component size and mixed responsibilities

Location: `src/MusicXML/MusicXML.tsx`, currently about 811 lines.

The route owns file loading, XML transformation, OSMD rendering, audio scheduling, cursor movement, game scoring, downloads, and layout. That makes playback bugs harder to fix safely.

Recommended steps:

- Rename `TestFileLoader` to a production name such as `MusicXmlRoute`.
- Extract route-local hooks with narrow responsibilities:
  - `useMusicXmlDocument`: default fetch, upload, processed XML, file errors.
  - `useOsmdRenderer`: OSMD instance, render runs, sheet readiness, cursor reset.
  - `usePlaybackController`: audio context, timers, game clock, start/pause/finish/reset.
  - `useNoteHighwayScoring`: hit/miss/streak state and hit-window decisions.
- Extract the sidebar controls into a small component once the state boundaries are clearer.
- Keep XML transforms and timeline helpers pure and covered by Vitest.

## Code Quality And Scalability Work

### Shared harmonica layout helpers

Locations: `src/Harmonica/Harmonica.tsx`, `src/Practice/Practice.tsx`, `src/utils/utils.ts`.

The repeated logic for deriving allowed MIDI sets from generated layouts has been moved into `getLayoutMidiNumbers(layout)` and is covered by `src/utils/utils.test.ts`. The shared visible row order, labels, and bend metadata now live in `harmonicaLayoutDisplayRows`, so the Harmonica and Practice routes render and derive targets from the same row model while keeping route-specific colors local.

### Make MusicXML parsing failures explicit

Locations: `src/MusicXML/musicXmlFile.ts`, `src/MusicXML/musicXmlTransform.ts`, `src/MusicXML/playbackParser.ts`.

Status: completed on 2026-05-08.

Implemented:

- Added `src/MusicXML/musicXmlParser.ts` with `parseMusicXmlDocument(xml)`, structured `MusicXmlParseError` reasons, and a route-safe message helper.
- File loading, `.mxl` container lookup, tab injection, first-staff display generation, HarpTabs export, auto-transpose search, and playback parsing now use the shared parser path.
- The MusicXML route now maps parser errors into its in-app error state for upload, processing, auto transpose, and HarpTabs export.
- Added `src/MusicXML/musicXmlParser.test.ts` coverage for valid score parsing, malformed XML, missing score parts, and supporting XML documents such as `.mxl` containers.

### Harden uploaded file handling

Locations: `src/MusicXML/musicXmlFile.ts`, `src/MusicXML/MusicXML.tsx`, and `src/MusicXML/musicXmlFile.test.ts`.

Status: completed on 2026-05-08.

Implemented:

- Added a 10 MB upload limit before reading raw MusicXML or `.mxl` files.
- Added typed MusicXML file errors so oversized files, oversized archived scores, and missing-score `.mxl` archives surface as in-app messages.
- Added a 10 MB guard for uncompressed MusicXML score entries inside `.mxl` files, using the declared archive size when available and decoded byte length as a backstop.
- Added `src/MusicXML/musicXmlFile.test.ts` coverage for plain XML reads, `.mxl` container lookup, fallback score candidates, missing-score archives, oversized uploads, and oversized archived scores.

## UI And Accessibility Work

### Mobile layout stability

Locations: `src/App.tsx`, `src/Menu.tsx`, `src/Harmonica/Harmonica.tsx`, `src/Practice/Practice.tsx`, `src/MusicXML/MusicXML.tsx`, `src/MusicXML/NoteHighway.tsx`, and `src/Circle/Circle.tsx`.

Status: completed on 2026-05-08.

Implemented:

- Changed the app shell from fixed `h-screen` sizing to a `min-h-dvh` grid shell.
- Changed route roots to fill the shell with `min-h-full` instead of adding nested full viewport heights.
- Made the top menu wrap on small screens and keep notation/support controls from forcing horizontal overflow.
- Made the MusicXML sheet sticky only on large screens, with bounded `dvh` height on small screens.
- Changed the note highway from a fixed 520 px height to responsive mobile, tablet, and desktop heights.
- Changed Circle triad rows to a grid layout so long note/chord labels can wrap cleanly.

### Improve MusicXML error and loading states

Location: `src/MusicXML/MusicXML.tsx`, lines 415-427, 447-462, and 546-567.

Default fetch, upload parsing, transform errors, and OSMD load errors currently log to the console or use alerts. Users need clear state in the route.

Recommended steps:

- Add one route-local status/error area in the sidebar or above the sheet.
- Disable downloads and playback when the current processed file is invalid or the sheet failed to render.
- Keep the previous score only when intentionally preserving it, not after a failed replacement.

## Test Coverage Roadmap

Current tests cover MusicXML transforms, playback parsing, timeline helpers, harmonica core utilities, and Circle theory derivations. The next tests should protect route-specific derived behavior before refactors.

Completed on 2026-05-08:

- Extracted Circle theory derivations into `src/Circle/circleTheory.ts`.
- Added `src/Circle/circleTheory.test.ts` coverage for circle generation, mode tonic selection, selected scales, triads, and note color classification.

Recommended order:

1. Extract and test Practice target generation so scale/position changes cannot break target selection.
2. Add route-level smoke tests later only if the project adopts a browser test runner.

## Performance Work

### Bundle size

The build passes, but the OSMD vendor chunk is large.

Completed on 2026-05-08:

- Lazy-loaded the Circle and Practice routes alongside the existing lazy MusicXML route.
- Kept the default Harmonica route eager so the `/harmonica` landing route still loads directly.
- Verified the route split with `npm run build`, which now emits separate `Circle-*.js` and `Practice-*.js` chunks.
- Added Rollup `manualChunks` for OSMD/VexFlow and JSZip/Pako so the large MusicXML renderer and archive code can be cached independently of the route component.
- Verified the vendor split with `npm run build`, which now emits separate `MusicXML-*.js`, `osmd-*.js`, and `jszip-*.js` chunks.

Remaining recommended steps:

- Use named Tonal imports where practical instead of `import * as tonal` in route components.
- Re-run `npm run build` and compare chunk sizes after each change.

### Render/update pressure

Locations: `src/MusicXML/MusicXML.tsx`, `src/MusicXML/NoteHighway.tsx`, `src/hooks/usePitchDetector.tsx`.

Playback and pitch detection update often. The current code is acceptable for the existing app, but refactors should preserve smooth playback.

Recommended steps:

- Keep high-frequency clock state isolated to the note-highway area.
- Avoid passing freshly created callback props deep into visual components if they cause unnecessary rerenders.
- Keep pitch detector output stable and consider returning numeric pitch/clarity in a future cleanup to avoid repeated string-to-number conversion.

## Suggested Implementation Order

1. Refactor MusicXML route into route-local hooks without changing behavior.
2. Address dependency upgrades in small batches.
3. Improve Circle accessibility and responsive details.
4. Continue smaller bundle tuning with named Tonal imports where practical.

## Definition Of Done For Each Improvement Batch

- No feature expansion beyond existing behavior.
- `npm test` passes.
- `npm run lint` passes.
- `npm run build` passes.
- If MusicXML rendering, playback, audio, or microphone behavior changes, manually smoke-test the affected route in a browser.
- If a pure helper changes, add or update a focused Vitest test.
