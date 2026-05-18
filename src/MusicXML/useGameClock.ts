import { useCallback } from "react";
import type { MutableRefObject } from "react";
import { getAdvancedGameClockOffsetMs } from "./playbackTiming";
import type { UseScorePlaybackOptions } from "./scorePlaybackTypes";

type UseGameClockOptions = {
  latestOptionsRef: MutableRefObject<UseScorePlaybackOptions>;
};

export const useGameClock = ({ latestOptionsRef }: UseGameClockOptions) => {
  const startGameClock = useCallback(() => {
    const {
      refs: { gameClockFrameRef },
    } = latestOptionsRef.current;

    if (gameClockFrameRef.current !== null) {
      window.cancelAnimationFrame(gameClockFrameRef.current);
      gameClockFrameRef.current = null;
    }

    let wasFrozen = false;
    let lastPublishedTimeMs = -1;

    const updateClock = () => {
      const {
        callbacks: { setCurrentGameTimeMs },
        refs: {
          gameClockFrameRef,
          gameClockOffsetMsRef,
          gameClockStartMsRef,
          isPlayingRef,
          studyModeFreezeRef,
          tempoScaleRef,
        },
      } = latestOptionsRef.current;

      if (!isPlayingRef.current) {
        gameClockFrameRef.current = null;
        return;
      }

      const isFrozen = studyModeFreezeRef?.current;

      if (isFrozen) {
        if (!wasFrozen) {
          gameClockOffsetMsRef.current = getAdvancedGameClockOffsetMs(
            gameClockOffsetMsRef.current,
            performance.now(),
            gameClockStartMsRef.current,
            tempoScaleRef.current,
          );
          wasFrozen = true;
        }

        gameClockStartMsRef.current = performance.now();
      } else {
        wasFrozen = false;

        const nextTimeMs = Math.round(
          getAdvancedGameClockOffsetMs(
            gameClockOffsetMsRef.current,
            performance.now(),
            gameClockStartMsRef.current,
            tempoScaleRef.current,
          ),
        );

        if (nextTimeMs !== lastPublishedTimeMs) {
          lastPublishedTimeMs = nextTimeMs;
          setCurrentGameTimeMs(nextTimeMs);
        }
      }

      gameClockFrameRef.current = window.requestAnimationFrame(updateClock);
    };

    gameClockFrameRef.current = window.requestAnimationFrame(updateClock);
  }, [latestOptionsRef]);

  return { startGameClock };
};
