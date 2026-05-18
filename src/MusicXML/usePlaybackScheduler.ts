import { useCallback, useRef } from "react";
import type { MutableRefObject } from "react";
import { getAudioOutputLatencyMs } from "./audioPlayback";
import {
  getLatencyAdjustedClockOffsetMs,
  getPlaybackEventTiming,
  getPlaybackTrailDelayMs,
} from "./playbackTiming";
import type { UseScorePlaybackOptions } from "./scorePlaybackTypes";
import type { PlaybackEvent } from "./types";

type UsePlaybackSchedulerOptions = {
  latestOptionsRef: MutableRefObject<UseScorePlaybackOptions>;
  playNotes: (notes: PlaybackEvent["notes"], tempoBpm: number) => void;
  stopPlayback: (reset?: boolean, shouldResetScoring?: boolean) => void;
};

export const usePlaybackScheduler = ({
  latestOptionsRef,
  playNotes,
  stopPlayback,
}: UsePlaybackSchedulerOptions) => {
  const schedulePlaybackRef = useRef<
    (startIndex: number, runId: number) => void
  >(() => {});

  const schedulePlayback = useCallback(
    (startIndex: number, runId: number) => {
      const {
        callbacks: { onPlaybackComplete, setCurrentEventIndex },
        refs: {
          audioContextRef,
          gameClockOffsetMsRef,
          gameClockStartMsRef,
          moveCursorThroughEventRef,
          playbackRunRef,
          playbackTimerRef,
          studyModeFreezeRef,
          tempoScaleRef,
        },
        state: { playbackEvents, playbackTimeline, shortestNoteDurationMs },
      } = latestOptionsRef.current;

      const event = playbackEvents[startIndex];

      if (!event) {
        playbackTimerRef.current = window.setTimeout(() => {
          playbackTimerRef.current = null;
          if (playbackRunRef.current !== runId) return;
          onPlaybackComplete();
          stopPlayback(true, false);
        }, getPlaybackTrailDelayMs(shortestNoteDurationMs, tempoScaleRef.current));

        return;
      }

      const { durationMs, effectiveTempoBpm } = getPlaybackEventTiming(
        event,
        tempoScaleRef.current,
      );

      gameClockOffsetMsRef.current = getLatencyAdjustedClockOffsetMs(
        playbackTimeline[startIndex]?.startMs ?? 0,
        getAudioOutputLatencyMs(audioContextRef.current),
        tempoScaleRef.current,
      );
      gameClockStartMsRef.current = performance.now();

      setCurrentEventIndex(startIndex);
      moveCursorThroughEventRef.current(startIndex, durationMs);
      playNotes(event.notes, effectiveTempoBpm);

      const scheduleNext = () => {
        if (playbackRunRef.current !== runId) return;

        if (studyModeFreezeRef?.current) {
          playbackTimerRef.current = window.setTimeout(scheduleNext, 50);
          return;
        }

        schedulePlaybackRef.current(startIndex + 1, runId);
      };

      playbackTimerRef.current = window.setTimeout(scheduleNext, durationMs);
    },
    [latestOptionsRef, playNotes, stopPlayback],
  );

  schedulePlaybackRef.current = schedulePlayback;

  return { schedulePlaybackRef };
};
