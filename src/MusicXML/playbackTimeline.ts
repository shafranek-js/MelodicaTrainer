import { Note } from "tonal";
import {
  NOTE_HIGHWAY_LOOKAHEAD_MS,
  NOTE_HIGHWAY_TRAIL_MS,
  NOTE_HIT_WINDOW_MS,
} from "./constants";
import { getTabHole } from "./playbackParser";
import type { PlaybackEvent, PlaybackTiming, VisibleGameEvent } from "./types";

export const getPlayableMidiNumbers = (events: PlaybackEvent[]) => {
  const midiNumbers = events
    .flatMap((event) => event.notes)
    .map((note) => Note.midi(note.name))
    .filter((midi): midi is number => midi !== null);

  return new Set(midiNumbers);
};

export const createPlaybackTimeline = (
  events: PlaybackEvent[],
  tempoScale: number
) => {
  let cursorMs = 0;

  return events.map((event): PlaybackTiming => {
    const effectiveTempo = Math.max(20, event.tempoBpm * tempoScale);
    const durationMs = Math.max(
      80,
      (60000 / effectiveTempo) * event.durationBeats
    );
    const timing = {
      startMs: cursorMs,
      durationMs,
      endMs: cursorMs + durationMs,
    };

    cursorMs = timing.endMs;
    return timing;
  });
};

export const getLaneKeys = (events: PlaybackEvent[]) => {
  const holes = new Set<number>();

  events.forEach((event) => {
    event.tabs.forEach((tab) => {
      const hole = getTabHole(tab);
      if (hole !== null) holes.add(hole);
    });
  });

  return Array.from(holes).sort((a, b) => a - b);
};

export const getVisibleGameEvents = (
  events: PlaybackEvent[],
  timeline: PlaybackTiming[],
  visualPlayheadMs: number,
  shortestNoteDurationMs: number = 250
): VisibleGameEvent[] => {
  const containerHeightPx = 520;
  const msPerPx = shortestNoteDurationMs / 40;
  const dynamicLookaheadMs = containerHeightPx * msPerPx;
  
  // The trail needs to cover the distance from the target line (78%) to the bottom (100%).
  // We use a generous 50% of the lookahead window to ensure long notes aren't unmounted prematurely.
  const dynamicTrailMs = dynamicLookaheadMs * 0.5;

  return events
    .map((event, index) => ({
      event,
      index,
      timing: timeline[index],
    }))
    .filter(({ timing }) => {
      if (!timing) return false;
      return (
        timing.endMs >= visualPlayheadMs - dynamicTrailMs &&
        timing.startMs <= visualPlayheadMs + dynamicLookaheadMs
      );
    });
};

export const getTargetEventIndex = (
  visibleGameEvents: VisibleGameEvent[],
  visualPlayheadMs: number
) => {
  let closestIndex: number | null = null;
  let closestDistanceMs = Number.POSITIVE_INFINITY;

  visibleGameEvents.forEach(({ event, index, timing }) => {
    if (!event.notes.length || !timing) return;

    const distanceMs = Math.abs(timing.startMs - visualPlayheadMs);
    if (distanceMs > NOTE_HIT_WINDOW_MS || distanceMs >= closestDistanceMs) {
      return;
    }

    closestIndex = index;
    closestDistanceMs = distanceMs;
  });

  return closestIndex;
};
