import { useEffect, useMemo, useRef, useState } from "react";
import { Note } from "tonal";
import type { FingerAssignment } from "./fingerAssigner";
import type { PlaybackEvent, PlaybackTiming } from "./types";
import {
  buildPhantomHandSearchIndex,
  createFingerLookup,
  findPhantomHandMatch,
  getAssignedFinger,
  isNotePressingAt,
} from "./phantomHandSearch";

export type FingerVisualState = "idle" | "prepare" | "pressing";

const IDLE_STATES: FingerVisualState[] = ["idle", "idle", "idle", "idle", "idle"];

type FingerRuntime = {
  prepareCount: number;
  pressingCount: number;
};

const emptyRuntime = (): FingerRuntime => ({ prepareCount: 0, pressingCount: 0 });

export const usePhantomHand = (
  assignments: FingerAssignment[],
  events: PlaybackEvent[],
  timeline: PlaybackTiming[],
  currentGameTimeMs: number,
  enabled: boolean,
) => {
  const [fingerStates, setFingerStates] = useState<FingerVisualState[]>(IDLE_STATES);
  const prevStatesRef = useRef<FingerVisualState[]>(IDLE_STATES);
  const [activeMidi, setActiveMidi] = useState<number | null>(null);
  const [activeFinger, setActiveFinger] = useState<number | null>(null);

  const phantomSearch = useMemo(() => {
    const lookup = createFingerLookup(assignments);
    return {
      index: buildPhantomHandSearchIndex(events, timeline, lookup),
      lookup,
    };
  }, [assignments, events, timeline]);

  useEffect(() => {
    if (!enabled || events.length === 0 || timeline.length === 0) {
      if (prevStatesRef.current.some((s, i) => s !== IDLE_STATES[i])) {
        prevStatesRef.current = IDLE_STATES;
        setFingerStates(IDLE_STATES);
      }
      return;
    }

    const now = currentGameTimeMs;
    const runtime: FingerRuntime[] = Array.from({ length: 5 }, emptyRuntime);

    let targetMidi: number | null = null;
    let targetFinger: number | null = null;

    const match = findPhantomHandMatch(phantomSearch.index, now);
    if (match) {
      const event = events[match.eventIndex];
      const timing = timeline[match.eventIndex];
      if (event && timing) {
        for (let noteIndex = 0; noteIndex < event.notes.length; noteIndex++) {
          const note = event.notes[noteIndex];
          if (!note.shouldPlay) continue;
          const finger = getAssignedFinger(phantomSearch.lookup, match.eventIndex, noteIndex);
          if (finger === undefined) continue;
          if (match.state === "pressing" && !isNotePressingAt(event, timing, noteIndex, now)) continue;

          if (match.state === "pressing") {
            runtime[finger - 1].pressingCount++;
          } else {
            runtime[finger - 1].prepareCount++;
          }

          if (targetMidi === null && note.name) {
            const midi = Note.midi(note.name);
            if (typeof midi === "number") { targetMidi = midi; targetFinger = finger; }
          }
        }
      }
    }

    // Update active MIDI/finger — keep last position during gaps (only set when found).
    if (targetMidi !== null) {
      setActiveMidi(targetMidi);
      setActiveFinger(targetFinger);
    }

    const newStates: FingerVisualState[] = runtime.map((r) => {
      if (r.pressingCount > 0) return "pressing";
      if (r.prepareCount > 0) return "prepare";
      return "idle";
    });

    const prev = prevStatesRef.current;
    let changed = false;
    for (let i = 0; i < 5; i++) {
      if (newStates[i] !== prev[i]) { changed = true; break; }
    }
    if (changed) {
      prevStatesRef.current = newStates;
      setFingerStates(newStates);
    }
  }, [currentGameTimeMs, enabled, events, phantomSearch, timeline]);

  return { fingerStates, activeMidi, activeFinger };
};
