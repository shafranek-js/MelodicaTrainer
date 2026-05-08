# NoteBender Existing-App Improvement Plan

This review is intentionally scoped to improving the current app. It avoids new product features and focuses on reliability, maintainability, responsiveness, performance, accessibility, dependency health, and test coverage.

## Review Snapshot

Reviewed on 2026-05-08.

Checks run:

- `npm test`: passed, 5 files and 28 tests.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npm audit --json`: reported 24 vulnerabilities: 3 low, 7 moderate, 14 high.

Build note:

- The production build warns that `dist/assets/MusicXML-*.js` is large: about 1,304.13 kB minified and 364.29 kB gzip.

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

### 3. Improve mobile layout stability

Locations: `src/App.tsx`, `src/Menu.tsx`, `src/Harmonica/Harmonica.tsx`, `src/MusicXML/MusicXML.tsx`, `src/MusicXML/NoteHighway.tsx`, and `src/Circle/Circle.tsx`.

Main risks:

- `src/App.tsx` uses `h-screen` while route pages also use `min-h-screen`; this can create nested viewport/scroll issues on mobile browser UI.
- `src/Menu.tsx` uses one non-wrapping horizontal flex row with links and right-side controls. Narrow screens can overflow.
- `src/MusicXML/MusicXML.tsx` uses a sticky sheet with `h-[calc(100vh-7rem)] min-h-[520px]`, which can be awkward on mobile and inside the app shell.
- `src/MusicXML/NoteHighway.tsx` uses a fixed `h-[520px]` highway.
- `src/Circle/Circle.tsx` uses fixed window-based circle sizes and dense flex rows for triads.

Recommended steps:

- Change the app shell to `min-h-dvh` and make route pages fill available space without adding another full viewport when nested.
- Make the menu responsive with wrapping or horizontal scrolling for nav links, and keep the notation/support controls from forcing page overflow.
- Make MusicXML sheet stickiness large-screen-only; on small screens use normal flow with bounded height based on `dvh`.
- Use responsive highway heights such as smaller mobile height and larger desktop height.
- In Circle, use container sizing where possible and make triad rows wrap or grid instead of relying on `justify-between`.

## Code Quality And Scalability Work

### Shared harmonica layout helpers

Locations: `src/Harmonica/Harmonica.tsx`, `src/Practice/Practice.tsx`, `src/utils/utils.ts`.

The repeated logic for deriving allowed MIDI sets from generated layouts has been moved into `getLayoutMidiNumbers(layout)` and is covered by `src/utils/utils.test.ts`. Shared rendering row metadata is still duplicated between the Harmonica and Practice routes.

Remaining steps:

- Consider exporting shared layout-row metadata only after confirming Harmonica and Practice should render the same rows.

### Make MusicXML parsing failures explicit

Locations: `src/MusicXML/musicXmlFile.ts`, `src/MusicXML/musicXmlTransform.ts`, `src/MusicXML/playbackParser.ts`.

Most XML helpers parse with `DOMParser` but do not check for parser errors. Invalid XML can flow into transforms and OSMD before the route shows a useful error.

Recommended steps:

- Create a shared `parseMusicXmlDocument(xml)` helper that checks for `parsererror`.
- Use it in file loading, transforms, playback parsing, and first-staff display generation.
- Return structured errors to the route instead of relying on `console.error` and `alert()`.
- Add tests for malformed XML and missing score parts.

### Harden uploaded file handling

Location: `src/MusicXML/musicXmlFile.ts`, lines 13-44.

The app accepts `.mxl` archives and XML text directly. Current behavior reads the whole file/archive into memory and does not enforce size limits.

Recommended steps:

- Add a reasonable file-size limit before reading.
- For `.mxl`, reject archives with no MusicXML candidate and show an in-app error.
- Consider guarding against unusually large uncompressed XML entries before rendering.
- Add tests for container lookup and missing-score cases.

## UI And Accessibility Work

### Improve MusicXML error and loading states

Location: `src/MusicXML/MusicXML.tsx`, lines 415-427, 447-462, and 546-567.

Default fetch, upload parsing, transform errors, and OSMD load errors currently log to the console or use alerts. Users need clear state in the route.

Recommended steps:

- Add one route-local status/error area in the sidebar or above the sheet.
- Disable downloads and playback when the current processed file is invalid or the sheet failed to render.
- Keep the previous score only when intentionally preserving it, not after a failed replacement.

### Make the empty Settings route deliberate

Location: `src/App.tsx`, line 35, and `src/Settings/Settings.tsx`.

There is a `/settings` route with placeholder text, but it is not linked in the menu. It looks like dead or unfinished surface.

Recommended steps:

- Remove the route until settings exist, or keep it out of production navigation and document why.
- If kept, style it consistently with the app shell and avoid placeholder copy.

### Align README commands with the project guide

Location: `README.md`.

The project guide says to install with `npm ci`, while the README says `npm install`.

Recommended steps:

- Update the README local setup to prefer `npm ci`.
- Add the same validation commands used here: `npm test`, `npm run lint`, and `npm run build`.

## Test Coverage Roadmap

Current tests cover MusicXML transforms, playback parsing, timeline helpers, and harmonica core utilities. The next tests should protect route-specific derived behavior before refactors.

Recommended order:

1. Extract and test Practice target generation so scale/position changes cannot break target selection.
2. Extract and test Circle theory derivations: mode tonic, selected scale, triads, and color classification.
3. Add tests for malformed XML handling once a shared parser helper exists.
4. Add route-level smoke tests later only if the project adopts a browser test runner.

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
2. Improve mobile shell/menu/Harmonica/MusicXML/NoteHighway responsiveness.
3. Add parser-error handling for MusicXML.
4. Address dependency upgrades in small batches.
5. Improve Circle accessibility and responsive details.
6. Split bundles and compare build output.
7. Clean up README and the placeholder Settings route.

## Definition Of Done For Each Improvement Batch

- No feature expansion beyond existing behavior.
- `npm test` passes.
- `npm run lint` passes.
- `npm run build` passes.
- If MusicXML rendering, playback, audio, or microphone behavior changes, manually smoke-test the affected route in a browser.
- If a pure helper changes, add or update a focused Vitest test.
