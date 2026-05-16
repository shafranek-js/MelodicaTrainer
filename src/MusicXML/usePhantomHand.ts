import { useEffect, useRef, useState } from "react";
import { Note } from "tonal";
import type { FingerAssignment } from "./fingerAssigner";
import type { PlaybackEvent, PlaybackTiming } from "./types";

export type FingerVisualState = "idle" | "prepare" | "pressing";

const FINGER_HINT_LEAD_TIME_MS = 650;

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

  const timeRef = useRef(currentGameTimeMs);
  timeRef.current = currentGameTimeMs;

  const lookupRef = useRef<Map<string, number>>(new Map());
  lookupRef.current.clear();
  for (const a of assignments) {
    lookupRef.current.set(`${a.eventIndex}:${a.noteIndex}`, a.finger);
  }

  useEffect(() => {
    if (!enabled || events.length === 0 || timeline.length === 0) {
      if (prevStatesRef.current.some((s, i) => s !== IDLE_STATES[i])) {
        prevStatesRef.current = IDLE_STATES;
        setFingerStates(IDLE_STATES);
      }
      return;
    }

    const now = timeRef.current;
    const runtime: FingerRuntime[] = Array.from({ length: 5 }, emptyRuntime);

    let targetMidi: number | null = null;
    let targetFinger: number | null = null;

    for (let ei = 0; ei < events.length; ei++) {
      const event = events[ei];
      const timing = timeline[ei];
      if (!timing || event.notes.length === 0) continue;

      const noteOngoing = now >= timing.startMs && now <= timing.endMs;
      const timeToHit = timing.startMs - now;

      if (noteOngoing) {
        let found = false;
        for (let ni = 0; ni < event.notes.length; ni++) {
          const note = event.notes[ni];
          if (!note.shouldPlay) continue;
          const finger = lookupRef.current.get(`${ei}:${ni}`);
          if (finger !== undefined) {
            runtime[finger - 1].pressingCount++;
            found = true;
            if (targetMidi === null && note.name) {
              const midi = Note.midi(note.name);
              if (typeof midi === "number") { targetMidi = midi; targetFinger = finger; }
            }
          }
        }
        if (found) break;
        // Ongoing event with no playable notes (tied continuation) — keep scanning.
      } else {
        // Note may have ended per-event but the SOUND may still be ongoing
        // (tied notes have durationBeats > event.durationBeats).
        let sustained = false;
        for (let ni = 0; ni < event.notes.length; ni++) {
          const note = event.notes[ni];
          if (!note.shouldPlay) continue;
          const noteDurationRatio = event.durationBeats > 0 ? note.durationBeats / event.durationBeats : 1;
          const noteEndMs = timing.startMs + timing.durationMs * noteDurationRatio;
          if (now >= timing.startMs && now <= noteEndMs) {
            const finger = lookupRef.current.get(`${ei}:${ni}`);
            if (finger !== undefined) {
              runtime[finger - 1].pressingCount++;
              sustained = true;
              if (targetMidi === null && note.name) {
                const midi = Note.midi(note.name);
                if (typeof midi === "number") { targetMidi = midi; targetFinger = finger; }
              }
            }
          }
        }
        if (sustained) break;
      }

      if (timeToHit > 0 && timeToHit <= FINGER_HINT_LEAD_TIME_MS) {
        let found = false;
        for (let ni = 0; ni < event.notes.length; ni++) {
          if (!event.notes[ni].shouldPlay) continue;
          const finger = lookupRef.current.get(`${ei}:${ni}`);
          if (finger !== undefined) {
            runtime[finger - 1].prepareCount++;
            found = true;
            if (targetMidi === null && event.notes[ni].name) {
              const midi = Note.midi(event.notes[ni].name);
              if (typeof midi === "number") { targetMidi = midi; targetFinger = finger; }
            }
          }
        }
        if (found) break;
      }

      if (timeToHit > FINGER_HINT_LEAD_TIME_MS) break;
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
  }, [assignments, events, timeline, currentGameTimeMs, enabled]);

  return { fingerStates, activeMidi, activeFinger };
};
