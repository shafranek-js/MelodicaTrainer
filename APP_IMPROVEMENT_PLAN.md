# NoteBender Existing-App Improvement Plan

This review is intentionally scoped to improving the current app. It avoids new product features and focuses on reliability, maintainability, responsiveness, performance, accessibility, dependency health, and test coverage.

## Review Snapshot

Reviewed on 2026-05-08.

Checks run:

- `npm test`: passed, 7 files and 39 tests.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npm audit --json`: reported 24 vulnerabilities: 3 low, 7 moderate, 14 high.

Build note:

- The production build warns that `dist/assets/MusicXML-*.js` is large: about 1,306.01 kB minified and 365.02 kB gzip.

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

Current tests cover MusicXML transforms, playback parsing, timeline helpers, and harmonica core utilities. The next tests should protect route-specific derived behavior before refactors.

Recommended order:

1. Extract and test Practice target generation so scale/position changes cannot break target selection.
2. Extract and test Circle theory derivations: mode tonic, selected scale, triads, and color classification.
3. Add route-level smoke tests later only if the project adopts a browser test runner.

## Performance Work

### Bundle size

The build passes, but the MusicXML chunk is large.

Recommended steps:

- Keep MusicXML lazy-loaded.
- Consider lazy-loading other non-default routes so `/harmonica` starts with less code.
- Add Rollup `manualChunks` for large stable libraries such as OSMD and possibly JSZip so browser caching is more effective.
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
4. Split bundles and compare build output.

## Definition Of Done For Each Improvement Batch

- No feature expansion beyond existing behavior.
- `npm test` passes.
- `npm run lint` passes.
- `npm run build` passes.
- If MusicXML rendering, playback, audio, or microphone behavior changes, manually smoke-test the affected route in a browser.
- If a pure helper changes, add or update a focused Vitest test.
