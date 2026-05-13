# Scoring System Logic

This document describes the mechanics behind the "Hit" and "Miss" detection system in HarpTrainer, and how it balances challenge with playability.

## 1. Core Mechanics

The scoring system monitors the player's performance in real-time by comparing detected microphone input against the notes expected by the active score.

### Hit Detection
A **Hit** is registered when the following conditions are met simultaneously:
1.  **Temporal Alignment:** The current playback time must be within the **Hit Window** of a note's start time.
2.  **Pitch Accuracy:** The detected pitch must match the target MIDI note within a specified **Cents Tolerance**.
3.  **Signal Clarity:** The pitch detector must report a high confidence level (Clarity) to avoid triggering hits from background noise.

### Miss Detection
A **Miss** is registered when:
- The playback head passes the start time of a note (plus the hit window) and no Hit was recorded for that specific event.
- This ensures that players cannot "back-score" a note they already missed.

## 2. Configurable Parameters

The difficulty and responsiveness of the system are controlled by constants defined in `src/MusicXML/constants.ts`:

| Parameter | Value | Description |
| :--- | :--- | :--- |
| `NOTE_HIT_WINDOW_MS` | **200 ms** | The grace period before and after a note's start. Larger values compensate for input latency (mic lag) and rhythmic inaccuracy. |
| `NOTE_PITCH_TOLERANCE_CENTS` | **45 cents** | How close the detected pitch must be to the target. 45 cents allows for the natural "vibrato" and pitch fluctuation of a live harmonica without mistaking it for a different note (semi-tone is 100 cents). |

## 3. Latency Compensation

In web environments, audio input latency can range from 50ms to 150ms.
- The `NOTE_HIT_WINDOW_MS` is intentionally set to **200ms** to absorb this lag.
- **Recommendation for Players:** If you feel the blocks are consistently passing the line before registering, try playing slightly "ahead" of the visual beat.

## 4. Scoring Calculations

- **Accuracy (%):** `(Hits / (Hits + Misses)) * 100`.
- **Streak:** The number of consecutive hits. Resets to 0 upon a single miss.
- **Visual Feedback:**
    - **Hit:** The note block highlights and disappears (or triggers a "hit" animation).
    - **Current Target:** The Note Highway target line glows when a valid pitch is detected in the correct lane.
