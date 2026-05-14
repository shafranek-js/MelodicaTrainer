import type { PlaybackEvent } from "./types";

export const hasInitialScoreRest = (events: PlaybackEvent[]) => {
  const firstEvent = events[0];
  return Boolean(firstEvent && firstEvent.durationBeats > 0 && firstEvent.notes.length === 0);
};

export const addLeadInIfNeeded = (
  events: PlaybackEvent[],
  leadInBeats: number
): PlaybackEvent[] => {
  if (events.length === 0 || leadInBeats <= 0 || hasInitialScoreRest(events)) {
    return events;
  }

  const firstEvent = events[0];
  return [
    {
      durationBeats: leadInBeats,
      tempoBpm: firstEvent.tempoBpm,
      notes: [],
      tabs: [],
      sourceEventIndex: firstEvent.sourceEventIndex,
    },
    ...events,
  ];
};
