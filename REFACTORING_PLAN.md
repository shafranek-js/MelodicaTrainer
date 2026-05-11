# 🛠️ HarpTrainer Refactoring Plan

Based on the recent implementation of Advanced Notation and deep dives into the core components, several architectural bottlenecks have emerged. This plan outlines a strategy to improve maintainability, separation of concerns, and performance.

## 1. Deconstructing the "God Object" (`MusicXML.tsx`)
Currently, `MusicXML.tsx` (nearly 500 lines) handles too many responsibilities: UI layout, file I/O, OSMD initialization, real-time audio scheduling, and high-frequency animation loops.

**Action Plan:**
*   **Extract `useAudioEngine` Hook:** Move `audioContextRef`, `playNotes`, `schedulePlayback`, `stopPlayback`, and synthesizer initialization into a dedicated hook. This hook should expose a clean API: `play()`, `stop()`, `pause()`, and the current audio state.
*   **Extract `useOsmdRenderer` Hook:** Move the `osmdRef`, OpenSheetMusicDisplay initialization, cursor management (`moveCursorInstantlyToEvent`, `moveCursorThroughEvent`), and XML loading logic into its own hook.
*   **Extract `useGameClock` Hook:** Move the `requestAnimationFrame` loop, `visualPlayheadMs` calculation, and `tempoScale` logic out of the main component. The main component should just consume the current visual time.

## 2. Simplifying the Rendering Pipeline (`NoteHighway.tsx`)
The `NoteHighway` component now mixes complex mathematical geometry (SVG path generation, bezier curves) with JSX markup. The `renderData` mapping function is too long and complex.

**Action Plan:**
*   **Extract Geometry Math:** Create a new utility file (e.g., `highwayGeometry.ts`). Move the `getTargetWidthPct` and the massive SVG path `pathD` calculation into pure functions that take a note's context and return the path string.
*   **Componentize Overlays:** Break down the HTML overlays into smaller, memoized sub-components (e.g., `<NoteLabel>`, `<ArrowIndicators>`, `<ClarityBar>`) to prevent unnecessary re-renders of the entire highway when only one note changes state.

## 3. Centralizing Data Parsing (`playbackParser.ts`)
Currently, `NoteHighway.tsx` parses the tab string on every frame to determine `isOverblow` and `bendDepth` using regex. This is inefficient and violates the separation of concerns.

**Action Plan:**
*   **Update `types.ts`:** Extend `PlaybackNote` or create a `PlaybackTab` type that explicitly includes `isOverblow: boolean` and `bendDepth: number`.
*   **Parse Once:** Update `playbackParser.ts` to perform the regex matching during the initial XML loading phase.
*   **Consume Clean Data:** `NoteHighway` should simply read `note.isOverblow` instead of parsing strings 60 times a second.

## 4. State Management and Refs
The core loop relies heavily on `useRef` (e.g., `gameClockStartMsRef`, `gameClockOffsetMsRef`, `playbackRunRef`) to bypass React's render cycle for performance. While necessary for the animation loop, it makes the code hard to reason about.

**Action Plan:**
*   **Audit Refs:** Review all `useRef` usage. Ensure that refs are only used for values that *must* change synchronously without triggering a re-render.
*   **Zustand / Context for Global State:** The prop-drilling of `setGlobalState` to sync the menu with the `MusicXML` route is fragile. Consider introducing a lightweight state manager (like Zustand) to handle cross-route states (like `isPlaying`, `tempo`, `selectedSf`) cleanly.

## 5. CSS and Styling Cleanup
We have a mix of Tailwind utility classes and inline styles calculating percentages.

**Action Plan:**
*   **Extract Complex Classes:** Use Tailwind's `@apply` in a CSS file or extract complex string literals (like the `wasHit` glow shadow) into named constants to clean up the JSX.

---
**Priority:**
Implementing Section 3 (Centralizing Data Parsing) is the highest priority for performance, followed by Section 1 (Deconstructing MusicXML.tsx) for maintainability.