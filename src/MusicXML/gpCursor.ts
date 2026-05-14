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
