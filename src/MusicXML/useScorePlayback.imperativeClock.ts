import { useCallback, useMemo, useRef } from "react";
import type { MutableRefObject } from "react";
import type { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import {
  changeInstrument,
  ensureAudioContext,
  getAudioOutputLatencyMs,
  initSynthesizer,
  playPlaybackNotes,
  stopAudioNodes,
} from "./audioPlayback";
import type { AlphaTabViewerRef } from "./AlphaTabViewer";
import { musicXmlDebugLogger } from "./debugLogger";
import { getPlaybackStartIndex } from "./playbackStart";
import { parsePresetSelection } from "./useSoundFontPresets";
import type { PlaybackEvent, PlaybackTiming } from "./types";

type RouteStatus = {
  tone: "info" | "success" | "error";
  message: string;
};

type UseScorePlaybackOptions = {
  alphaTabRef: MutableRefObject<AlphaTabViewerRef | null>;
  audioContextRef: MutableRefObject<AudioContext | null>;
  canPlayback: boolean;
  currentEventIndex: number;
  currentGameTimeMs: number;
  cursorEventIndexRef: MutableRefObject<number | null>;
  fileName: string | null;
  gameClockFrameRef: MutableRefObject<number | null>;
  gameClockOffsetMsRef: MutableRefObject<number>;
  gameClockStartMsRef: MutableRefObject<number>;
  isGpPlaybackReady: boolean;
  isGpFile: boolean;
  isPlaying: boolean;
  isPlayingRef: MutableRefObject<boolean>;
  isSheetReady: boolean;
  moveCursorThroughEventRef: MutableRefObject<
    (eventIndex: number, durationMs: number) => void
  >;
  osmdInstanceRef: MutableRefObject<OpenSheetMusicDisplay | null>;
  playbackEvents: PlaybackEvent[];
  playbackRunRef: MutableRefObject<number>;
  playbackTimerRef: MutableRefObject<number | null>;
  playbackTimeline: PlaybackTiming[];
  resetScoring: () => void;
  selectedPreset: string;
  selectedSf: string;
  setCurrentEventIndex: (index: number) => void;
  setCurrentGameTimeMs: (timeMs: number) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setRouteStatus: (status: RouteStatus) => void;
  sheetScrollRef: MutableRefObject<HTMLDivElement | null>;
  shortestNoteDurationMs: number;
  stopGpCursorAnimation: () => void;
  studyModeFreezeRef?: MutableRefObject<boolean>;
  tempoScaleRef: MutableRefObject<number>;
};

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

  const clearPlaybackResources = useCallback(() => {
    const { gameClockFrameRef, playbackTimerRef, stopGpCursorAnimation } =
      latestOptionsRef.current;

    if (playbackTimerRef.current !== null) {
      window.clearTimeout(playbackTimerRef.current);
      playbackTimerRef.current = null;
    }

    if (gameClockFrameRef.current !== null) {
      window.cancelAnimationFrame(gameClockFrameRef.current);
      gameClockFrameRef.current = null;
    }

    stopGpCursorAnimation();
    stopAudioNodes();
  }, [latestOptionsRef]);

  const stopPlayback = useCallback(
    (reset = false, shouldResetScoring = true) => {
      const {
        alphaTabRef,
        currentEventIndex,
        currentGameTimeMs,
        cursorEventIndexRef,
        isGpFile,
        isPlayingRef,
        osmdInstanceRef,
        playbackRunRef,
        resetScoring,
        setCurrentEventIndex,
        setCurrentGameTimeMs,
        setIsPlaying,
        sheetScrollRef,
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

      if (currentEventIndex !== 0) {
        setCurrentEventIndex(0);
      }

      if (currentGameTimeMs !== 0) {
        setCurrentGameTimeMs(0);
      }

      if (shouldResetScoring) {
        resetScoring();
      }

      cursorEventIndexRef.current = null;
      osmdInstanceRef.current?.cursor?.reset();
      osmdInstanceRef.current?.cursor?.hide();
      alphaTabRef.current?.setTickPosition(0);

      if (sheetScrollRef.current) {
        sheetScrollRef.current.scrollLeft = 0;
      }
    },
    [clearPlaybackResources, latestOptionsRef],
  );

  const playNotes = useCallback(
    (notes: PlaybackEvent["notes"], tempoBpm: number) => {
      const { audioContextRef } = latestOptionsRef.current;
      const audioContext = ensureAudioContext(audioContextRef.current);
      audioContextRef.current = audioContext;
      playPlaybackNotes(notes, tempoBpm);
    },
    [latestOptionsRef],
  );

  const schedulePlaybackRef = useRef<
    (startIndex: number, runId: number) => void
  >(() => {});

  const schedulePlayback = useCallback(
    (startIndex: number, runId: number) => {
      const {
        audioContextRef,
        gameClockOffsetMsRef,
        gameClockStartMsRef,
        moveCursorThroughEventRef,
        playbackEvents,
        playbackRunRef,
        playbackTimerRef,
        playbackTimeline,
        setCurrentEventIndex,
        shortestNoteDurationMs,
        studyModeFreezeRef,
        tempoScaleRef,
      } = latestOptionsRef.current;

      const event = playbackEvents[startIndex];

      if (!event) {
        const msPerPx = shortestNoteDurationMs / 40;
        const trailMs = 520 * msPerPx * 0.5;

        playbackTimerRef.current = window.setTimeout(() => {
          playbackTimerRef.current = null;
          if (playbackRunRef.current !== runId) return;
          stopPlayback(true, false);
        }, trailMs / tempoScaleRef.current);

        return;
      }

      const effTempo = Math.max(20, event.tempoBpm * tempoScaleRef.current);
      const durMs = Math.max(80, (60000 / effTempo) * event.durationBeats);

      gameClockOffsetMsRef.current =
        (playbackTimeline[startIndex]?.startMs ?? 0) -
        getAudioOutputLatencyMs(audioContextRef.current) *
          tempoScaleRef.current;
      gameClockStartMsRef.current = performance.now();

      setCurrentEventIndex(startIndex);
      moveCursorThroughEventRef.current(startIndex, durMs);
      playNotes(event.notes, effTempo);

      const scheduleNext = () => {
        if (playbackRunRef.current !== runId) return;

        if (studyModeFreezeRef?.current) {
          playbackTimerRef.current = window.setTimeout(scheduleNext, 50);
          return;
        }

        schedulePlaybackRef.current(startIndex + 1, runId);
      };

      playbackTimerRef.current = window.setTimeout(scheduleNext, durMs);
    },
    [latestOptionsRef, playNotes, stopPlayback],
  );

  schedulePlaybackRef.current = schedulePlayback;

  const startGameClock = useCallback(() => {
    const { gameClockFrameRef } = latestOptionsRef.current;

    if (gameClockFrameRef.current !== null) {
      window.cancelAnimationFrame(gameClockFrameRef.current);
      gameClockFrameRef.current = null;
    }

    let wasFrozen = false;
    let lastPublishedTimeMs = -1;

    const updateClock = () => {
      const {
        gameClockFrameRef,
        gameClockOffsetMsRef,
        gameClockStartMsRef,
        isPlayingRef,
        setCurrentGameTimeMs,
        studyModeFreezeRef,
        tempoScaleRef,
      } = latestOptionsRef.current;

      if (!isPlayingRef.current) {
        gameClockFrameRef.current = null;
        return;
      }

      const isFrozen = studyModeFreezeRef?.current;

      if (isFrozen) {
        if (!wasFrozen) {
          gameClockOffsetMsRef.current +=
            (performance.now() - gameClockStartMsRef.current) *
            tempoScaleRef.current;
          wasFrozen = true;
        }

        gameClockStartMsRef.current = performance.now();
      } else {
        wasFrozen = false;

        const nextTimeMs = Math.round(
          gameClockOffsetMsRef.current +
            (performance.now() - gameClockStartMsRef.current) *
              tempoScaleRef.current,
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

  const togglePlayback = useCallback(async () => {
    const {
      alphaTabRef,
      audioContextRef,
      canPlayback,
      currentEventIndex,
      currentGameTimeMs,
      fileName,
      gameClockOffsetMsRef,
      gameClockStartMsRef,
      isGpFile,
      isGpPlaybackReady,
      isPlayingRef,
      isSheetReady,
      playbackEvents,
      playbackRunRef,
      resetScoring,
      selectedPreset,
      selectedSf,
      setIsPlaying,
      setRouteStatus,
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

    if (!playbackReady) {
      musicXmlDebugLogger.warn("Playback not ready", {
        isSheetReady,
        hasEvents: playbackEvents.length > 0,
        hasAlphaTab: !!alphaTabRef.current,
        isGpPlaybackReady,
      });
      return;
    }

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
    } catch (err) {
      console.error("Playback error:", err);
      setRouteStatus({
        tone: "error",
        message: "Failed to initialize high-quality sound.",
      });
    }
  }, [latestOptionsRef, startGameClock, stopPlayback]);

  return useMemo(
    () => ({
      clearPlaybackResources,
      stopPlayback,
      togglePlayback,
    }),
    [clearPlaybackResources, stopPlayback, togglePlayback],
  );
};
