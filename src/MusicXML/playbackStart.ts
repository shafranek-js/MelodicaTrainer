import type { PlaybackEvent } from "./types";

export const getPlaybackStartIndex = ({
  currentEventIndex,
  currentGameTimeMs,
  playbackEvents,
}: {
  currentEventIndex: number;
  currentGameTimeMs: number;
  playbackEvents: PlaybackEvent[];
}) => {
  if (playbackEvents.length === 0) return 0;
  if (currentGameTimeMs <= 0) return 0;
  if (currentEventIndex >= playbackEvents.length) return 0;
  return currentEventIndex;
};
