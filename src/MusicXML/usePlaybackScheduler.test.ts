import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import type { MutableRefObject } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { UseScorePlaybackOptions } from "./scorePlaybackTypes";
import type { PlaybackEvent } from "./types";
import { usePlaybackScheduler } from "./usePlaybackScheduler";

const playbackEvent: PlaybackEvent = {
  durationBeats: 1,
  tempoBpm: 120,
  notes: [],
  tabs: [],
  sourceEventIndex: 0,
};

const createPlaybackOptions = (): MutableRefObject<UseScorePlaybackOptions> => ({
  current: {
    callbacks: {
      onPlaybackComplete: vi.fn(),
      resetScoring: vi.fn(),
      setCurrentEventIndex: vi.fn(),
      setCurrentGameTimeMs: vi.fn(),
      setIsPlaying: vi.fn(),
      setRouteStatus: vi.fn(),
      stopGpCursorAnimation: vi.fn(),
    },
    refs: {
      accompanimentTimerRef: { current: null },
      alphaTabRef: { current: null },
      audioContextRef: { current: null },
      cursorEventIndexRef: { current: null },
      gameClockFrameRef: { current: null },
      gameClockOffsetMsRef: { current: 0 },
      gameClockStartMsRef: { current: 0 },
      isPlayingRef: { current: true },
      moveCursorThroughEventRef: { current: vi.fn() },
      osmdInstanceRef: { current: null },
      playbackRunRef: { current: 7 },
      playbackTimerRef: { current: null },
      sheetScrollRef: { current: null },
      tempoScaleRef: { current: 1 },
    },
    state: {
      accompanimentSchedule: [],
      accompanimentVolume: 10,
      canPlayback: true,
      currentEventIndex: 0,
      currentGameTimeMs: 0,
      fileName: "loop.mid",
      isGpPlaybackReady: true,
      isGpFile: false,
      isLooping: true,
      isPlaying: true,
      isSheetReady: true,
      playbackEvents: [playbackEvent],
      playbackTimeline: [{ startMs: 0, durationMs: 500, endMs: 500 }],
      selectedPreset: "0:0",
      selectedSf: "melodica.sf2",
      shortestNoteDurationMs: 80,
    },
  },
});

afterEach(() => {
  vi.useRealTimers();
});

describe("usePlaybackScheduler loop completion", () => {
  it("restarts at the first event without reporting completion", async () => {
    vi.useFakeTimers();
    const latestOptionsRef = createPlaybackOptions();
    const playNotes = vi.fn();
    const restartPlaybackLoop = vi.fn(() => true);
    const stopPlayback = vi.fn();
    let schedulePlayback: ((startIndex: number, runId: number) => void) | null = null;
    const container = document.createElement("div");
    const root = createRoot(container);

    const Probe = () => {
      schedulePlayback = usePlaybackScheduler({
        latestOptionsRef,
        playNotes,
        restartPlaybackLoop,
        stopPlayback,
      }).schedulePlaybackRef.current;
      return null;
    };

    await act(async () => root.render(createElement(Probe)));
    act(() => schedulePlayback?.(1, 7));

    expect(restartPlaybackLoop).toHaveBeenCalledWith(7);
    expect(playNotes).toHaveBeenCalledTimes(1);
    expect(latestOptionsRef.current.callbacks.onPlaybackComplete).not.toHaveBeenCalled();
    expect(stopPlayback).not.toHaveBeenCalled();

    await act(async () => root.unmount());
  });

  it("finishes normally when loop restart is disabled", async () => {
    vi.useFakeTimers();
    const latestOptionsRef = createPlaybackOptions();
    const restartPlaybackLoop = vi.fn(() => false);
    const stopPlayback = vi.fn();
    let schedulePlayback: ((startIndex: number, runId: number) => void) | null = null;
    const container = document.createElement("div");
    const root = createRoot(container);

    const Probe = () => {
      schedulePlayback = usePlaybackScheduler({
        latestOptionsRef,
        playNotes: vi.fn(),
        restartPlaybackLoop,
        stopPlayback,
      }).schedulePlaybackRef.current;
      return null;
    };

    await act(async () => root.render(createElement(Probe)));
    act(() => schedulePlayback?.(1, 7));
    await act(async () => vi.advanceTimersByTimeAsync(520));

    expect(latestOptionsRef.current.callbacks.onPlaybackComplete).toHaveBeenCalledTimes(1);
    expect(stopPlayback).toHaveBeenCalledWith(true, false);

    await act(async () => root.unmount());
  });
});
