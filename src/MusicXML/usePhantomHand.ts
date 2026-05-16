import { useEffect, useRef, useState } from "react";
import type { FingerAssignment } from "./fingerAssigner";
import type { PlaybackEvent, PlaybackTiming } from "./types";

export type FingerVisualState = "idle" | "prepare" | "pressing";

const FINGER_HINT_LEAD_TIME_MS = 650;

type FingerRuntime = {
  prepareCount: number;
  pressingCount: number;
};

const emptyRuntime = (): FingerRuntime => ({ prepareCount: 0, pressingCount: 0 });

/**
 * Derives the visual state of fingers 1–5 from playback position
 * and pre-computed FingerAssignment[].
 *
 * Uses ref-counting so overlapping notes (chords, legato) don't
 * prematurely release a finger that is still needed.
 */
export const usePhantomHand = (
  assignments: FingerAssignment[],
  events: PlaybackEvent[],
  timeline: PlaybackTiming[],
  currentGameTimeMs: number,
  enabled: boolean,
) => {
  const [fingerStates, setFingerStates] = useState<FingerVisualState[]>([
    "idle", "idle", "idle", "idle", "idle",
  ]);
  const prevStatesRef = useRef<FingerVisualState[]>(["idle", "idle", "idle", "idle", "idle"]);

  // Build lookup: "eventIndex:noteIndex" → finger
  const lookupRef = useRef<Map<string, number>>(new Map());
  lookupRef.current.clear();
  for (const a of assignments) {
    lookupRef.current.set(`${a.eventIndex}:${a.noteIndex}`, a.finger);
  }

  useEffect(() => {
    if (!enabled || events.length === 0 || timeline.length === 0) {
      // Reset all fingers when disabled
      setFingerStates(["idle", "idle", "idle", "idle", "idle"]);
      return;
    }

    const runtime: FingerRuntime[] = Array.from({ length: 5 }, emptyRuntime);

    for (let ei = 0; ei < events.length; ei++) {
      const event = events[ei];
      const timing = timeline[ei];
      if (!timing || event.notes.length === 0) continue;

      const timeToHit = timing.startMs - currentGameTimeMs;
      const noteOngoing =
        currentGameTimeMs >= timing.startMs &&
        currentGameTimeMs <= timing.endMs;

      for (let ni = 0; ni < event.notes.length; ni++) {
        if (!event.notes[ni].shouldPlay) continue;
        const finger = lookupRef.current.get(`${ei}:${ni}`);
        if (finger === undefined) continue;

        const idx = finger - 1; // 1..5 → 0..4

        if (noteOngoing) {
          runtime[idx].pressingCount++;
        } else if (timeToHit > 0 && timeToHit <= FINGER_HINT_LEAD_TIME_MS) {
          runtime[idx].prepareCount++;
        }
        // else: note is past or too far — contributes nothing
      }
    }

    // Resolve runtime → visual state
    const newStates: FingerVisualState[] = runtime.map((r) => {
      if (r.pressingCount > 0) return "pressing";
      if (r.prepareCount > 0) return "prepare";
      return "idle";
    });

    // Only update if changed (avoid unnecessary renders)
    const prev = prevStatesRef.current;
    let changed = false;
    for (let i = 0; i < 5; i++) {
      if (newStates[i] !== prev[i]) { changed = true; break; }
    }
    if (changed) {
      prevStatesRef.current = newStates;
      setFingerStates(newStates);
    }
  }, [assignments, events, timeline, currentGameTimeMs, enabled]);

  return fingerStates;
};
