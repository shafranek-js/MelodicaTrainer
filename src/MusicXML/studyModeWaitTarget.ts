import type { PlaybackEvent, PlaybackTiming } from "./types";

export const hasPlayableNotes = (event: PlaybackEvent) =>
  event.notes.some((note) => note.shouldPlay);

export const findStudyModeWaitTarget = (
  playbackEvents: readonly PlaybackEvent[],
  playbackTimeline: readonly PlaybackTiming[],
  startIndex: number,
  currentGameTimeMs: number,
) => {
  for (let index = startIndex; index < playbackEvents.length; index += 1) {
    const timing = playbackTimeline[index];
    const event = playbackEvents[index];
    if (!timing || !event || !hasPlayableNotes(event)) continue;
    if (currentGameTimeMs >= timing.startMs) return index;
  }

  return null;
};
