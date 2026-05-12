# Guitar Pro Synchronization Logic (Note Highway)

This document describes the technical implementation of the synchronization between **AlphaTab** (sheet music engine) and the **Note Highway** (falling blocks visualizer) for Guitar Pro files.

## 1. The Core Problem: Time vs. Geometry
Standard MusicXML files use a **Time-based (ms)** approach. The application calculates when each note should appear based on the BPM (Beats Per Minute). However, Guitar Pro files in AlphaTab pose several challenges for this approach:
- **Tempo Scaling:** Changes in tempo through the UI or within the file itself cause rounding errors in millisecond calculations.
- **Bar-Relative Timing:** AlphaTab's internal data structures often report note positions relative to the current bar, not the start of the song.
- **Autoplay Policies:** Browser audio contexts can introduce small delays during initialization, causing a drift between audio and visuals.

## 2. The Solution: Tick-Based Coordinate System
To ensure perfect synchronization, we transitioned from "Visual Milliseconds" to **AlphaTab Ticks** as the primary coordinate system for GP files.

### A. Absolute Tick Positioning
In `alphaTabParser.ts`, we no longer rely on relative starts. Every note's position is calculated as:
`Absolute Position = Bar.MasterBar.Start (Ticks) + Beat.PlaybackStart (Ticks)`

This provides a fixed, immutable coordinate for every note that never changes, regardless of tempo.

### B. Gap & Rest Handling
The parser maintains a `currentTick` cursor. If a note starts at a tick higher than the cursor, the parser explicitly inserts a **Rest Event**. This ensures that the empty space (e.g., a lead-in measure of silence) is physically represented on the Note Highway timeline.

### C. Unified Playhead
In `AlphaTabViewer.tsx`, the `playerPositionChanged` event is hooked to report `currentTick` instead of `currentTime`.
- **Visual Playhead:** The Highway's "now" line is directly driven by the MIDI tick reported by the engine.
- **Result:** If the sheet music cursor is on Tick 1920, the Note Highway renders the state at exactly Tick 1920. There is zero mathematical conversion between them, eliminating drift.

## 3. Visual Scaling & UX
Because Ticks are much larger units than Milliseconds (e.g., 960 ticks per beat vs 500ms at 120bpm), the Highway's scaling logic was adjusted:

1. **isGp Flag:** The `NoteHighway` component receives an `isGp` prop to switch its internal math from `ms` to `ticks`.
2. **Shortest Note Floor:** To prevent extreme zooming on technical notes (like grace notes or 64th notes), we enforce a floor of **480 ticks** (a quarter note) for the visual "base unit". This keeps the falling blocks at a readable, playable size.
3. **Auto-Octave Shift:** GP files often use low guitar tunings. The parser automatically detects if the MIDI range is below the standard Harmonica C4 (MIDI 60) and shifts the entire track up by 1 or 2 octaves so the notes actually appear in the 1-10 hole lanes.

## 4. Playback Initialization
To resolve `InvalidStateError` (trying to stop nodes before they start), a state machine was added:
- **isReady State:** Playback is blocked until both `scoreLoaded` and `soundFontLoaded` events have fired.
- **Synchronous Unlock:** The `AudioContext` is resumed directly in the `onClick` handler of the Play button to satisfy browser security, while the engine start is slightly guarded to ensure the worker threads are active.

---
*Created on: May 12, 2026*
