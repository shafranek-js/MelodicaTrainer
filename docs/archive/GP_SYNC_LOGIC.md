# Guitar Pro Synchronization Logic (Note Highway)

This document describes the technical implementation of the synchronization between **AlphaTab** (sheet music engine) and the **Note Highway** (falling blocks visualizer) for Guitar Pro files.

## 1. The Core Problem: Time vs. Geometry
Standard MusicXML files use a **Time-based (ms)** approach. The application calculates when each note should appear based on the BPM (Beats Per Minute). However, Guitar Pro files in AlphaTab pose several challenges for this approach:
- **Tempo Scaling:** Changes in tempo through the UI or within the file itself cause rounding errors in millisecond calculations.
- **Bar-Relative Timing:** AlphaTab's internal data structures often report note positions relative to the current bar, not the start of the song.
- **Autoplay Policies:** Browser audio contexts can introduce small delays during initialization, causing a drift between audio and visuals.

## 2. Current Solution: Linear Playback Events With Original Ticks
The current code uses a hybrid model rather than a fully tick-based Note Highway.

### A. Absolute Tick Positioning
In `alphaTabParser.ts`, repeat sections are expanded into a linear playback path. Each generated event can carry:

- `tick`: position in the expanded internal playback path.
- `originalTick`: position in the original AlphaTab score, used for visual cursor synchronization.

### B. Gap & Rest Handling
The parser maintains a playback cursor. If a note starts after the cursor, it explicitly inserts a **Rest Event**. This ensures that empty space is represented in the shared playback event list.

### C. Shared Millisecond Timeline
`MusicXML.tsx` still builds a millisecond `playbackTimeline` with `createPlaybackTimeline`. Note Highway rendering and scoring use that timeline for both MusicXML and GP events.

### D. AlphaTab Cursor Sync
For GP visual synchronization, `MusicXML.tsx` sends `event.originalTick` to `AlphaTabViewer.setTickPosition()`. This lets AlphaTab move within the original, unexpanded score while the app plays through the expanded event list.

## 3. Visual Scaling & UX
Because GP events are adapted into the shared playback event model, the highway currently uses the same millisecond-based visual scaling as MusicXML.

Important current limitation:

- `NoteHighway` still accepts an `isGp` prop, but it does not currently switch its internal math from milliseconds to ticks.
- A true tick-based highway remains a future synchronization improvement, not the current implementation.

## 4. Playback Initialization
Playback remains user-gesture-sensitive:

- AlphaTab must load and render the GP score before playback is enabled.
- The app initializes/resumes the Web Audio context from the play flow.
- Playback stop must clear timers, animation frames, active audio nodes, and AlphaTab playback state.

---
*Created on: May 12, 2026*
