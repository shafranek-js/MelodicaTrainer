import { useCallback, useEffect } from "react";
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
  moveCursorThroughEventRef: MutableRefObject<(eventIndex: number, durationMs: number) => void>;
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

export const useScorePlayback = ({
  alphaTabRef,
  audioContextRef,
  canPlayback,
  currentEventIndex,
  currentGameTimeMs,
  cursorEventIndexRef,
  fileName,
  gameClockFrameRef,
  gameClockOffsetMsRef,
  gameClockStartMsRef,
  isGpPlaybackReady,
  isGpFile,
  isPlaying,
  isPlayingRef,
  isSheetReady,
  moveCursorThroughEventRef,
  osmdInstanceRef,
  playbackEvents,
  playbackRunRef,
  playbackTimerRef,
  playbackTimeline,
  resetScoring,
  selectedPreset,
  selectedSf,
  setCurrentEventIndex,
  setCurrentGameTimeMs,
  setIsPlaying,
  setRouteStatus,
  sheetScrollRef,
  shortestNoteDurationMs,
  stopGpCursorAnimation,
  studyModeFreezeRef,
  tempoScaleRef,
}: UseScorePlaybackOptions) => {
  const clearPlaybackResources = useCallback(() => {
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
  }, [gameClockFrameRef, playbackTimerRef, stopGpCursorAnimation]);

  const stopPlayback = useCallback((reset = false, shouldResetScoring = true) => {
    playbackRunRef.current += 1;
    clearPlaybackResources();
    if (isGpFile) {
      alphaTabRef.current?.stop();
    }
    setIsPlaying(false);

    if (!reset) return;

    setCurrentEventIndex(0);
    setCurrentGameTimeMs(0);
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
  }, [
    alphaTabRef,
    clearPlaybackResources,
    cursorEventIndexRef,
    isGpFile,
    osmdInstanceRef,
    playbackRunRef,
    resetScoring,
    setCurrentEventIndex,
    setCurrentGameTimeMs,
    setIsPlaying,
    sheetScrollRef,
  ]);

  const playNotes = useCallback((notes: PlaybackEvent["notes"], tempoBpm: number) => {
    const audioContext = ensureAudioContext(audioContextRef.current);
    audioContextRef.current = audioContext;
    playPlaybackNotes(notes, tempoBpm);
  }, [audioContextRef]);

  const schedulePlayback = useCallback((startIndex: number, runId: number) => {
    const event = playbackEvents[startIndex];
    if (!event) {
      const msPerPx = shortestNoteDurationMs / 40;
      const trailMs = (520 * msPerPx) * 0.5;
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
      getAudioOutputLatencyMs(audioContextRef.current) * tempoScaleRef.current;
    gameClockStartMsRef.current = performance.now();
    setCurrentEventIndex(startIndex);
    moveCursorThroughEventRef.current(startIndex, durMs);
    playNotes(event.notes, effTempo);

    const scheduleNext = () => {
      if (playbackRunRef.current !== runId) return;
      if (studyModeFreezeRef?.current) {
        // Poll until unfrozen
        playbackTimerRef.current = window.setTimeout(scheduleNext, 50);
      } else {
        schedulePlayback(startIndex + 1, runId);
      }
    };

    playbackTimerRef.current = window.setTimeout(scheduleNext, durMs);
  }, [
    audioContextRef,
    gameClockOffsetMsRef,
    gameClockStartMsRef,
    moveCursorThroughEventRef,
    playNotes,
    playbackEvents,
    playbackRunRef,
    playbackTimerRef,
    playbackTimeline,
    setCurrentEventIndex,
    shortestNoteDurationMs,
    stopPlayback,
    studyModeFreezeRef,
    tempoScaleRef,
  ]);

  const togglePlayback = useCallback(async () => {
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

      setRouteStatus({ tone: "success", message: fileName ? `Ready: ${fileName}.` : "Score ready." });

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
      setIsPlaying(true);
      schedulePlayback(startIndex, runId);
    } catch (err) {
      console.error("Playback error:", err);
      setRouteStatus({ tone: "error", message: "Failed to initialize high-quality sound." });
    }
  }, [
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
    schedulePlayback,
    selectedPreset,
    selectedSf,
    setIsPlaying,
    setRouteStatus,
    stopPlayback,
  ]);

  useEffect(() => {
    if (!isPlaying) return;

    let wasFrozen = false;

    const updateClock = () => {
      const isFrozen = studyModeFreezeRef?.current;
      
      if (isFrozen) {
        if (!wasFrozen) {
          // Just froze. Bake the accumulated time into the offset.
          gameClockOffsetMsRef.current += (performance.now() - gameClockStartMsRef.current) * tempoScaleRef.current;
          wasFrozen = true;
        }
        // Keep sliding the start time forward so elapsed time stays 0 while frozen.
        gameClockStartMsRef.current = performance.now();
      } else {
        wasFrozen = false;
        setCurrentGameTimeMs(
          gameClockOffsetMsRef.current +
          (performance.now() - gameClockStartMsRef.current) * tempoScaleRef.current
        );
      }
      gameClockFrameRef.current = window.requestAnimationFrame(updateClock);
    };

    gameClockFrameRef.current = window.requestAnimationFrame(updateClock);
    return () => {
      if (gameClockFrameRef.current !== null) {
        window.cancelAnimationFrame(gameClockFrameRef.current);
        gameClockFrameRef.current = null;
      }
    };
  }, [
    gameClockFrameRef,
    gameClockOffsetMsRef,
    gameClockStartMsRef,
    isPlaying,
    setCurrentGameTimeMs,
    tempoScaleRef,
    studyModeFreezeRef,
  ]);

  return {
    clearPlaybackResources,
    stopPlayback,
    togglePlayback,
  };
};
