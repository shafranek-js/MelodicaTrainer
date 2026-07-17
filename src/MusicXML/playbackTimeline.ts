import { Note } from "tonal";
import { NOTE_HIT_WINDOW_MS } from "./constants";
import { getMelodicaKeyForNote } from "../utils/utils";
import type { MelodicaKeyCount } from "../utils/utils";
import type { PlaybackEvent, PlaybackTiming, VisibleGameEvent } from "./types";
import { getPlaybackEventTiming } from "./playbackTiming";

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
  let cursor = 0;

  return events.map((event): PlaybackTiming => {
    const duration = getPlaybackEventTiming(event, tempoScale).durationMs;

    const timing = {
      startMs: cursor,
      durationMs: duration,
      endMs: cursor + duration,
    };

    cursor = timing.endMs;
    return timing;
  });
};

export const getLaneKeys = (events: PlaybackEvent[], keyCount: MelodicaKeyCount = 32) => {
  const keys = new Set<number>();

  events.forEach((event) => {
    event.notes.forEach((note) => {
      const key = getMelodicaKeyForNote(keyCount, note.name);
      if (key) keys.add(key.index);
    });
  });

  return Array.from(keys).sort((a, b) => a - b);
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
    .filter(({ event, timing }) => {
      if (!timing) return false;
      const soundingEndMs = event.notes.reduce((latestEndMs, note) => {
        const durationMs = note.durationSeconds === undefined
          ? timing.durationMs * (
              event.durationBeats > 0
                ? note.durationBeats / event.durationBeats
                : 1
            )
          : note.durationSeconds * 1000;
        return Math.max(latestEndMs, timing.startMs + durationMs);
      }, timing.endMs);
      return (
        soundingEndMs >= visualPlayheadMs - dynamicTrailMs &&
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
