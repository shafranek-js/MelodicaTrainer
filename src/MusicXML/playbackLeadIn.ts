import type { PlaybackEvent } from "./types";

const getInitialRestBeats = (events: PlaybackEvent[]) => {
  let restBeats = 0;

  for (const event of events) {
    if (event.notes.length > 0 || event.durationBeats <= 0) break;
    restBeats += event.durationBeats;
  }

  return restBeats;
};

export const addLeadInIfNeeded = (
  events: PlaybackEvent[],
  leadInBeats: number
): PlaybackEvent[] => {
  if (events.length === 0 || leadInBeats <= 0) {
    return events;
  }

  const missingLeadInBeats = leadInBeats - getInitialRestBeats(events);
  if (missingLeadInBeats <= 0) {
    return events;
  }

  const firstEvent = events[0];
  return [
    {
      durationBeats: missingLeadInBeats,
      tempoBpm: firstEvent.tempoBpm,
      notes: [],
      tabs: [],
      sourceEventIndex: firstEvent.sourceEventIndex,
    },
    ...events,
  ];
};
