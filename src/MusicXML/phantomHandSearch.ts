import type { FingerAssignment } from "./fingerAssigner";
import type { PlaybackEvent, PlaybackTiming } from "./types";

export const FINGER_HINT_LEAD_TIME_MS = 650;

export type PhantomHandMatch = {
  eventIndex: number;
  state: "pressing" | "prepare";
};

export type FingerLookup = ReadonlyMap<string, number>;

type PhantomHandSearchEntry = {
  eventIndex: number;
  maxEndMs: number;
  prefixMaxEndMs: number;
  startMs: number;
};

export type PhantomHandSearchIndex = {
  entries: PhantomHandSearchEntry[];
};

export const createFingerLookup = (assignments: readonly FingerAssignment[]): FingerLookup => {
  const lookup = new Map<string, number>();
  for (const assignment of assignments) {
    lookup.set(`${assignment.eventIndex}:${assignment.noteIndex}`, assignment.finger);
  }
  return lookup;
};

export const getAssignedFinger = (
  lookup: FingerLookup,
  eventIndex: number,
  noteIndex: number,
) => lookup.get(`${eventIndex}:${noteIndex}`);

export const getNoteEndMs = (
  event: PlaybackEvent,
  timing: PlaybackTiming,
  noteIndex: number,
) => {
  const note = event.notes[noteIndex];
  if (!note) return timing.endMs;
  const noteDurationRatio = event.durationBeats > 0 ? note.durationBeats / event.durationBeats : 1;
  return timing.startMs + timing.durationMs * noteDurationRatio;
};

export const isNotePressingAt = (
  event: PlaybackEvent,
  timing: PlaybackTiming,
  noteIndex: number,
  currentGameTimeMs: number,
) => {
  if (currentGameTimeMs < timing.startMs) return false;
  if (currentGameTimeMs <= timing.endMs) return true;
  return currentGameTimeMs <= getNoteEndMs(event, timing, noteIndex);
};

export const buildPhantomHandSearchIndex = (
  events: readonly PlaybackEvent[],
  timeline: readonly PlaybackTiming[],
  lookup: FingerLookup,
): PhantomHandSearchIndex => {
  const entries: PhantomHandSearchEntry[] = [];
  let prefixMaxEndMs = Number.NEGATIVE_INFINITY;

  for (let eventIndex = 0; eventIndex < events.length; eventIndex += 1) {
    const event = events[eventIndex];
    const timing = timeline[eventIndex];
    if (!event || !timing || event.notes.length === 0) continue;

    let maxEndMs = Number.NEGATIVE_INFINITY;
    for (let noteIndex = 0; noteIndex < event.notes.length; noteIndex += 1) {
      const note = event.notes[noteIndex];
      if (!note?.shouldPlay) continue;
      if (getAssignedFinger(lookup, eventIndex, noteIndex) === undefined) continue;
      maxEndMs = Math.max(maxEndMs, timing.endMs, getNoteEndMs(event, timing, noteIndex));
    }

    if (maxEndMs === Number.NEGATIVE_INFINITY) continue;
    prefixMaxEndMs = Math.max(prefixMaxEndMs, maxEndMs);
    entries.push({
      eventIndex,
      maxEndMs,
      prefixMaxEndMs,
      startMs: timing.startMs,
    });
  }

  return { entries };
};

const findFirstEntryAfter = (
  entries: readonly PhantomHandSearchEntry[],
  currentGameTimeMs: number,
) => {
  let low = 0;
  let high = entries.length;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (entries[mid]?.startMs !== undefined && entries[mid].startMs <= currentGameTimeMs) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }
  return low;
};

const findFirstPrefixEndingAfter = (
  entries: readonly PhantomHandSearchEntry[],
  currentGameTimeMs: number,
) => {
  let low = 0;
  let high = entries.length;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (entries[mid]?.prefixMaxEndMs !== undefined && entries[mid].prefixMaxEndMs < currentGameTimeMs) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }
  return low;
};

export const findPhantomHandMatch = (
  index: PhantomHandSearchIndex,
  currentGameTimeMs: number,
  leadTimeMs = FINGER_HINT_LEAD_TIME_MS,
): PhantomHandMatch | null => {
  const { entries } = index;
  if (entries.length === 0) return null;

  const firstFutureEntry = findFirstEntryAfter(entries, currentGameTimeMs);
  const activeEntry = findFirstPrefixEndingAfter(entries, currentGameTimeMs);
  if (activeEntry < firstFutureEntry) {
    return { eventIndex: entries[activeEntry].eventIndex, state: "pressing" };
  }

  const nextEntry = entries[firstFutureEntry];
  if (nextEntry && nextEntry.startMs - currentGameTimeMs <= leadTimeMs) {
    return { eventIndex: nextEntry.eventIndex, state: "prepare" };
  }

  return null;
};
