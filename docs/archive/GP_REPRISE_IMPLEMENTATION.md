# Guitar Pro Reprise and Playback Synchronization

This document details the technical implementation of repeat (reprise) expansion and audio-visual synchronization for Guitar Pro files within NoteBender / HarpTrainer.

## 1. Architectural Overview

The app uses a unified playback event model for both MusicXML and Guitar Pro files. To ensure a consistent "Note Highway" experience, all scores are "linearized" (expanded) during parsing.

### Core Principles:
- **Linear Timeline:** Every repeated section is explicitly cloned in the internal `playbackEvents` list. The user sees a continuous stream of notes, even if the sheet music loops.
- **Custom Scheduler:** We use a high-precision SoundFont-based scheduler driven by `performance.now()`, bypassing AlphaTab's internal player for consistent cross-format behavior.
- **Dual-Tick Synchronization:** We maintain two sets of MIDI ticks:
    1.  `tick` (Playback Tick): Absolute position in the expanded, linear timeline. Used for the Note Highway and audio scheduling.
    2.  `originalTick` (Visual/Notation Tick): Position in the original, unexpanded sheet music. Used to drive the AlphaTab cursor.

## 2. Repeat Expansion (The "Playback Path" Strategy)

Implemented in `src/MusicXML/alphaTabParser.ts`, the expansion follows these steps:

1.  **Build Playback Path:** We iterate through `score.masterBars` to simulate the actual order of performance.
    - If a bar has `mb.repeatCount > 1`, we calculate the length of the section from the last `isRepeatStart` and append the indices of those bars to the path multiple times.
    - We calculate `absoluteTickCursor` for each step in the path to create a continuous timeline.
2.  **Collect Beats:** We iterate through the path and collect beats from the corresponding bars.
    - **Relative Offsets:** Crucially, AlphaTab's `beat.playbackStart` is relative to the start of the bar. We add this to our `step.offset` to get the global playback tick.
3.  **Handle Gaps:** If there's a gap between the end of one beat and the start of the next (a rest), we insert a "Silent Event" with its own `originalTick` to keep the cursor moving smoothly.

## 3. Synchronization Logic

### Milliseconds vs Ticks
- The **Audio Scheduler** and **Note Highway** work in **Milliseconds**.
- **AlphaTab** works in **Ticks**.
- `createPlaybackTimeline` converts the linear `durationBeats` (normalized to quarter-notes) into `startMs` and `durationMs` using the BPM.

### Visual Cursor (AlphaTab)
In `MusicXML.tsx`, the `moveCursorThroughEvent` function synchronizes the sheet music:
```typescript
if (isGpFile && alphaTabRef.current && event.originalTick !== undefined) {
    alphaTabRef.current.setTickPosition(event.originalTick);
}
```
We use `originalTick` because AlphaTab's rendering engine does not know about our expanded timeline; it only understands the ticks as they appear in the original file.

### Manual Navigation (Seek)
When a user clicks on the sheet music, AlphaTab reports a tick. We map this back to our timeline:
1.  Find the first event in `playbackEvents` where `originalTick >= clickedTick`.
2.  Look up the corresponding `startMs` in `playbackTimeline`.
3.  Reposition the `currentGameTimeMs` and `currentEventIndex`.

## 4. Key Lessons Learned
- **`mb.calculateLength()` vs Manual:** Always use `mb.nextMasterBar.start - mb.start` for bar lengths to match AlphaTab's internal grid exactly.
- **Relative Beats:** `beat.playbackStart` is bar-relative. Subtracting the bar start (if it were absolute) would cause the timeline to collapse.
- **Rest Logic:** Rests must be explicitly parsed as events with `originalTick` values, otherwise the cursor "freezes" during silent passages.
