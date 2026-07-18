import { useCallback, useRef } from "react";
import type { MutableRefObject } from "react";
import { getAudioOutputLatencyMs } from "./audioPlayback";
import { getAdvancedGameClockOffsetMs } from "./playbackTiming";
import type { UseScorePlaybackOptions } from "./scorePlaybackTypes";
import type { PlaybackEvent } from "./types";

const ACCOMPANIMENT_POLL_INTERVAL_MS = 20;
const DUE_EVENT_TOLERANCE_MS = 8;

type UseAccompanimentSchedulerOptions = {
  latestOptionsRef: MutableRefObject<UseScorePlaybackOptions>;
  playNotes: (
    notes: PlaybackEvent["notes"],
    tempoBpm: number,
    tempoScale: number,
    channel?: number,
  ) => void;
};

export const useAccompanimentScheduler = ({
  latestOptionsRef,
  playNotes,
}: UseAccompanimentSchedulerOptions) => {
  const nextEventIndexRef = useRef(0);
  const lastScoreTimeMsRef = useRef(0);

  const clearAccompanimentTimer = useCallback(() => {
    const { accompanimentTimerRef } = latestOptionsRef.current.refs;
    if (accompanimentTimerRef.current !== null) {
      window.clearTimeout(accompanimentTimerRef.current);
      accompanimentTimerRef.current = null;
    }
  }, [latestOptionsRef]);

  const startAccompaniment = useCallback((runId: number, startScoreTimeMs: number) => {
    clearAccompanimentTimer();
    const findStartIndex = () => latestOptionsRef.current.state.accompanimentSchedule
      .findIndex((scheduled) => scheduled.startMs >= startScoreTimeMs - DUE_EVENT_TOLERANCE_MS);
    const initialIndex = findStartIndex();
    nextEventIndexRef.current = initialIndex < 0
      ? latestOptionsRef.current.state.accompanimentSchedule.length
      : initialIndex;
    lastScoreTimeMsRef.current = startScoreTimeMs;

    const tick = () => {
      const {
        refs: {
          accompanimentTimerRef,
          audioContextRef,
          gameClockOffsetMsRef,
          gameClockStartMsRef,
          isPlayingRef,
          playbackRunRef,
          studyModeFreezeRef,
          tempoScaleRef,
        },
        state: { accompanimentSchedule, accompanimentVolume },
      } = latestOptionsRef.current;

      if (!isPlayingRef.current || playbackRunRef.current !== runId) {
        accompanimentTimerRef.current = null;
        return;
      }

      const latencyMs = getAudioOutputLatencyMs(audioContextRef.current);
      const scoreTimeMs = studyModeFreezeRef?.current
        ? gameClockOffsetMsRef.current + latencyMs * tempoScaleRef.current
        : getAdvancedGameClockOffsetMs(
            gameClockOffsetMsRef.current,
            performance.now(),
            gameClockStartMsRef.current,
            tempoScaleRef.current,
          ) + latencyMs * tempoScaleRef.current;

      if (scoreTimeMs + DUE_EVENT_TOLERANCE_MS < lastScoreTimeMsRef.current) {
        const loopStartIndex = accompanimentSchedule.findIndex(
          (scheduled) => scheduled.startMs >= scoreTimeMs - DUE_EVENT_TOLERANCE_MS,
        );
        nextEventIndexRef.current = loopStartIndex < 0
          ? accompanimentSchedule.length
          : loopStartIndex;
      }

      if (!studyModeFreezeRef?.current) {
        while (nextEventIndexRef.current < accompanimentSchedule.length) {
          const scheduled = accompanimentSchedule[nextEventIndexRef.current];
          if (scheduled.startMs > scoreTimeMs + DUE_EVENT_TOLERANCE_MS) break;
          nextEventIndexRef.current += 1;
          if (accompanimentVolume <= 0) continue;
          playNotes(
            scheduled.event.notes,
            scheduled.event.tempoBpm,
            tempoScaleRef.current,
            scheduled.channel,
          );
        }
      }

      lastScoreTimeMsRef.current = scoreTimeMs;
      accompanimentTimerRef.current = window.setTimeout(
        tick,
        ACCOMPANIMENT_POLL_INTERVAL_MS,
      );
    };

    tick();
  }, [clearAccompanimentTimer, latestOptionsRef, playNotes]);

  return { clearAccompanimentTimer, startAccompaniment };
};
