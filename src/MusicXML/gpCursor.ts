import type { PlaybackEvent } from "./types";

type GpCursorTickParams = {
  event: PlaybackEvent | undefined;
  nextEvent: PlaybackEvent | undefined;
  elapsedMs: number;
  durationMs: number;
};

export const getInterpolatedGpCursorTick = ({
  event,
  nextEvent,
  elapsedMs,
  durationMs,
}: GpCursorTickParams) => {
  if (!event) return null;

  const startTick = event.originalTick;
  if (startTick === undefined) return null;

  const nextTick = nextEvent?.originalTick;
  if (nextTick === undefined || nextTick <= startTick || durationMs <= 0) {
    return startTick;
  }

  const progress = Math.min(1, Math.max(0, elapsedMs / durationMs));
  return startTick + (nextTick - startTick) * progress;
};

export const getGpEventIndexAtOriginalTick = (
  events: PlaybackEvent[],
  tick: number
) => {
  let selectedIndex = 0;

  for (let index = 0; index < events.length; index++) {
    const eventTick = events[index]?.originalTick;
    if (eventTick === undefined) continue;
    if (eventTick > tick) break;
    selectedIndex = index;
  }

  return selectedIndex;
};
