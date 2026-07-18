import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  changeInstrument,
  ensureAudioContext,
  initSynthesizer,
  playPlaybackNotes,
  setAccompanimentVolume as setSynthAccompanimentVolume,
  stopAudioNodes,
} from "./audioPlayback";
import { musicXmlDebugLogger } from "./debugLogger";
import { getPlaybackStartIndex } from "./playbackStart";
import type { UseScorePlaybackOptions } from "./scorePlaybackTypes";
import { useGameClock } from "./useGameClock";
import { usePlaybackScheduler } from "./usePlaybackScheduler";
import { parsePresetSelection } from "./useSoundFontPresets";
import type { PlaybackEvent } from "./types";
import { createPlaybackStartGate } from "./playbackStartGate";
import { useAccompanimentScheduler } from "./useAccompanimentScheduler";

/**
 * Keeps the latest value available to stable callbacks without forcing those
 * callbacks to be recreated on every render.
 */
const useLatestRef = <T>(value: T) => {
  const ref = useRef(value);
  ref.current = value;
  return ref;
};

export const useScorePlayback = (options: UseScorePlaybackOptions) => {
  const latestOptionsRef = useLatestRef(options);
  const playbackStartGateRef = useRef(createPlaybackStartGate());

  const clearPlaybackResources = useCallback(() => {
    const {
      callbacks: { stopGpCursorAnimation },
      refs: { accompanimentTimerRef, gameClockFrameRef, playbackTimerRef },
    } = latestOptionsRef.current;

    if (playbackTimerRef.current !== null) {
      window.clearTimeout(playbackTimerRef.current);
      playbackTimerRef.current = null;
    }

    if (accompanimentTimerRef.current !== null) {
      window.clearTimeout(accompanimentTimerRef.current);
      accompanimentTimerRef.current = null;
    }

    if (gameClockFrameRef.current !== null) {
      window.cancelAnimationFrame(gameClockFrameRef.current);
      gameClockFrameRef.current = null;
    }

    stopGpCursorAnimation();
    stopAudioNodes();
  }, [latestOptionsRef]);

  const resetPlaybackPosition = useCallback(
    (shouldResetScoring = true) => {
      const {
        callbacks: {
          resetScoring,
          setCurrentEventIndex,
          setCurrentGameTimeMs,
        },
        refs: {
          alphaTabRef,
          cursorEventIndexRef,
          osmdInstanceRef,
          sheetScrollRef,
          studyModeFreezeRef,
          studyModeNextIndexRef,
        },
        state: { currentEventIndex, currentGameTimeMs },
      } = latestOptionsRef.current;

      if (currentEventIndex !== 0) {
        setCurrentEventIndex(0);
      }

      if (currentGameTimeMs !== 0) {
        setCurrentGameTimeMs(0);
      }

      if (shouldResetScoring) {
        resetScoring();
      }

      if (studyModeFreezeRef) {
        studyModeFreezeRef.current = false;
      }
      if (studyModeNextIndexRef) {
        studyModeNextIndexRef.current = 0;
      }

      cursorEventIndexRef.current = null;
      osmdInstanceRef.current?.cursor?.reset();
      osmdInstanceRef.current?.cursor?.hide();
      alphaTabRef.current?.setTickPosition(0);

      if (sheetScrollRef.current) {
        sheetScrollRef.current.scrollLeft = 0;
      }
    },
    [latestOptionsRef],
  );

  const stopPlayback = useCallback(
    (reset = false, shouldResetScoring = true) => {
      const {
        callbacks: { setIsPlaying },
        refs: {
          alphaTabRef,
          isPlayingRef,
          playbackRunRef,
        },
        state: { isGpFile },
      } = latestOptionsRef.current;

      const wasPlaying = isPlayingRef.current;
      isPlayingRef.current = false;
      playbackRunRef.current += 1;
      clearPlaybackResources();

      if (isGpFile) {
        alphaTabRef.current?.stop();
      }

      // Avoid no-op parent state updates when playback is already stopped.
      if (wasPlaying) {
        setIsPlaying(false);
      }

      if (!reset) return;

      resetPlaybackPosition(shouldResetScoring);
    },
    [clearPlaybackResources, latestOptionsRef, resetPlaybackPosition],
  );

  const playNotes = useCallback(
    (
      notes: PlaybackEvent["notes"],
      tempoBpm: number,
      tempoScale: number,
      channel = 0,
    ) => {
      const {
        refs: { audioContextRef },
      } = latestOptionsRef.current;
      const audioContext = ensureAudioContext(audioContextRef.current);
      audioContextRef.current = audioContext;
      playPlaybackNotes(notes, tempoBpm, tempoScale, channel);
    },
    [latestOptionsRef],
  );

  const { startAccompaniment } = useAccompanimentScheduler({
    latestOptionsRef,
    playNotes,
  });

  useEffect(() => {
    setSynthAccompanimentVolume(options.state.accompanimentVolume);
  }, [options.state.accompanimentVolume]);

  const { startGameClock } = useGameClock({ latestOptionsRef });
  const restartPlaybackLoop = useCallback(
    (runId: number) => {
      const {
        refs: {
          gameClockOffsetMsRef,
          gameClockStartMsRef,
          isPlayingRef,
          playbackRunRef,
        },
        state: { isLooping, playbackEvents },
      } = latestOptionsRef.current;

      if (
        !isLooping ||
        playbackEvents.length === 0 ||
        !isPlayingRef.current ||
        playbackRunRef.current !== runId
      ) {
        return false;
      }

      stopAudioNodes();
      resetPlaybackPosition();
      gameClockOffsetMsRef.current = 0;
      gameClockStartMsRef.current = performance.now();
      return true;
    },
    [latestOptionsRef, resetPlaybackPosition],
  );
  const { schedulePlaybackRef } = usePlaybackScheduler({
    latestOptionsRef,
    playNotes,
    restartPlaybackLoop,
    stopPlayback,
  });

  const togglePlayback = useCallback(async () => {
    const {
      callbacks: { resetScoring, setIsPlaying, setRouteStatus },
      refs: {
        alphaTabRef,
        audioContextRef,
        gameClockOffsetMsRef,
        gameClockStartMsRef,
        isPlayingRef,
        playbackRunRef,
      },
      state: {
        canPlayback,
        currentEventIndex,
        currentGameTimeMs,
        fileName,
        isGpFile,
        isGpPlaybackReady,
        isSheetReady,
        playbackEvents,
        playbackTimeline,
        accompanimentSchedule,
        accompanimentVolume,
        selectedPreset,
        selectedSf,
      },
    } = latestOptionsRef.current;

    const playbackReady = canPlayback && (isGpFile ? isGpPlaybackReady : true);

    musicXmlDebugLogger.log("Toggle playback triggered", {
      isPlaying: isPlayingRef.current,
      canPlayback: playbackReady,
      isGpFile,
      isSheetReady,
      eventsCount: playbackEvents.length,
      alphaTabRef: !!alphaTabRef.current,
      isGpPlaybackReady,
    });

    if (isPlayingRef.current) {
      stopPlayback();
      return;
    }

    if (playbackStartGateRef.current.isPending()) {
      return;
    }

    if (!playbackReady) {
      musicXmlDebugLogger.warn("Playback not ready", {
        isSheetReady,
        hasEvents: playbackEvents.length > 0,
        hasAlphaTab: !!alphaTabRef.current,
        isGpPlaybackReady,
      });
      return;
    }

    await playbackStartGateRef.current.run(async () => {
      try {
        setRouteStatus({ tone: "info", message: "Initializing audio engine..." });

        const audioContext = ensureAudioContext(audioContextRef.current);
        audioContextRef.current = audioContext;
        await audioContext.resume();

        await initSynthesizer(audioContext, selectedSf);

        const preset = parsePresetSelection(selectedPreset);
        if (preset) {
          changeInstrument(preset.program, preset.bank);
        }
        setSynthAccompanimentVolume(accompanimentVolume);

        setRouteStatus({
          tone: "success",
          message: fileName ? `Ready: ${fileName}.` : "Score ready.",
        });

        const startIndex = getPlaybackStartIndex({
          currentEventIndex,
          currentGameTimeMs,
          playbackEvents,
        });

        if (startIndex === 0) {
          resetScoring();
        }

        gameClockOffsetMsRef.current = currentGameTimeMs;
        gameClockStartMsRef.current = performance.now();

        const runId = playbackRunRef.current + 1;
        playbackRunRef.current = runId;

        isPlayingRef.current = true;
        setIsPlaying(true);
        startGameClock();

        schedulePlaybackRef.current(startIndex, runId);
        if (accompanimentSchedule.length > 0) {
          startAccompaniment(
            runId,
            playbackTimeline[startIndex]?.startMs ?? currentGameTimeMs,
          );
        }
      } catch (err) {
        console.error("Playback error:", err);
        setRouteStatus({
          tone: "error",
          message: "Failed to initialize high-quality sound.",
        });
      }
    });
  }, [
    latestOptionsRef,
    schedulePlaybackRef,
    startAccompaniment,
    startGameClock,
    stopPlayback,
  ]);

  return useMemo(
    () => ({
      clearPlaybackResources,
      stopPlayback,
      togglePlayback,
    }),
    [clearPlaybackResources, stopPlayback, togglePlayback],
  );
};
