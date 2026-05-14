import { useMemo } from "react";
import {
  createPlaybackTimeline,
  getPlayableMidiNumbers,
  getTargetEventIndex,
  getVisibleGameEvents,
} from "./playbackTimeline";
import type { PlaybackEvent, PlaybackTiming } from "./types";

type UsePlaybackViewModelOptions = {
  currentEventIndex: number;
  currentGameTimeMs: number;
  playbackEvents: PlaybackEvent[];
};

export const getShortestPlayableNoteDurationMs = (
  playbackEvents: PlaybackEvent[],
  playbackTimeline: PlaybackTiming[],
  fallbackDurationMs = 250
) => {
  let minDuration = Number.POSITIVE_INFINITY;

  playbackTimeline.forEach((timing, index) => {
    const event = playbackEvents[index];
    if (event && event.notes.length > 0 && timing.durationMs > 10) {
      minDuration = Math.min(minDuration, timing.durationMs);
    }
  });

  return minDuration === Number.POSITIVE_INFINITY
    ? fallbackDurationMs
    : minDuration;
};

export const usePlaybackViewModel = ({
  currentEventIndex,
  currentGameTimeMs,
  playbackEvents,
}: UsePlaybackViewModelOptions) => {
  const playableMidiNumbers = useMemo(
    () => getPlayableMidiNumbers(playbackEvents),
    [playbackEvents]
  );

  const playbackTimeline = useMemo(
    () => createPlaybackTimeline(playbackEvents, 1),
    [playbackEvents]
  );

  const shortestNoteDurationMs = useMemo(
    () => getShortestPlayableNoteDurationMs(playbackEvents, playbackTimeline),
    [playbackEvents, playbackTimeline]
  );

  const visualPlayheadMs = currentGameTimeMs;
  const progress =
    playbackEvents.length > 0
      ? Math.min(100, Math.round((currentEventIndex / playbackEvents.length) * 100))
      : 0;

  const visibleGameEvents = useMemo(
    () =>
      getVisibleGameEvents(
        playbackEvents,
        playbackTimeline,
        visualPlayheadMs,
        shortestNoteDurationMs
      ),
    [playbackEvents, playbackTimeline, visualPlayheadMs, shortestNoteDurationMs]
  );

  const targetEventIndex = useMemo(
    () => getTargetEventIndex(visibleGameEvents, visualPlayheadMs),
    [visibleGameEvents, visualPlayheadMs]
  );

  const currentGameEvent = playbackEvents[targetEventIndex ?? currentEventIndex];

  return {
    currentGameEvent,
    playableMidiNumbers,
    playbackTimeline,
    progress,
    shortestNoteDurationMs,
    targetEventIndex,
    visibleGameEvents,
    visualPlayheadMs,
  };
};
