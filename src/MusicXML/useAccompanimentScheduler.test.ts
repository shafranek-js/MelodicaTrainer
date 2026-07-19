import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import type { MutableRefObject } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { UseScorePlaybackOptions } from "./scorePlaybackTypes";
import type { PlaybackEvent } from "./types";
import { useAccompanimentScheduler } from "./useAccompanimentScheduler";

const noteEvent: PlaybackEvent = {
  durationBeats: 1,
  notes: [{
    articulation: "normal",
    durationBeats: 1,
    name: "C3",
    shouldPlay: true,
    tieStart: false,
    tieStop: false,
    velocity: 0.7,
  }],
  sourceEventIndex: 0,
  tabs: [],
  tempoBpm: 120,
};

const createOptions = (): MutableRefObject<UseScorePlaybackOptions> => ({
  current: {
    callbacks: {
      onPlaybackAttack: vi.fn(),
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
      gameClockStartMsRef: { current: performance.now() },
      isPlayingRef: { current: true },
      moveCursorThroughEventRef: { current: vi.fn() },
      osmdInstanceRef: { current: null },
      playbackRunRef: { current: 7 },
      playbackTimerRef: { current: null },
      sheetScrollRef: { current: null },
      studyModeFreezeRef: { current: false },
      tempoScaleRef: { current: 1 },
    },
    state: {
      accompanimentSchedule: [
        { channel: 1, event: noteEvent, startMs: 0, trackId: "left" },
        { channel: 1, event: noteEvent, startMs: 100, trackId: "left" },
      ],
      accompanimentVolume: 10,
      canPlayback: true,
      currentEventIndex: 0,
      currentGameTimeMs: 0,
      fileName: "score.mxl",
      isGpFile: false,
      isGpPlaybackReady: true,
      isLooping: false,
      isPlaying: true,
      isSheetReady: true,
      playbackEvents: [noteEvent],
      playbackTimeline: [{ durationMs: 500, endMs: 500, startMs: 0 }],
      selectedPreset: "0:0",
      selectedSf: "melodica.sf2",
      shortestNoteDurationMs: 80,
    },
  },
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useAccompanimentScheduler", () => {
  it("plays due background events without touching the practice event index", async () => {
    vi.useFakeTimers();
    const options = createOptions();
    const playNotes = vi.fn();
    let start: ((runId: number, startScoreTimeMs: number) => void) | null = null;
    const root = createRoot(document.createElement("div"));

    const Probe = () => {
      start = useAccompanimentScheduler({
        latestOptionsRef: options,
        playNotes,
      }).startAccompaniment;
      return null;
    };

    await act(async () => root.render(createElement(Probe)));
    act(() => start?.(7, 0));
    expect(playNotes).toHaveBeenCalledTimes(1);
    expect(playNotes).toHaveBeenLastCalledWith(noteEvent.notes, 120, 1, 1);

    await act(async () => vi.advanceTimersByTimeAsync(120));
    expect(playNotes).toHaveBeenCalledTimes(2);
    expect(options.current.callbacks.setCurrentEventIndex).not.toHaveBeenCalled();

    options.current.refs.playbackRunRef.current = 8;
    await act(async () => vi.advanceTimersByTimeAsync(20));
    expect(options.current.refs.accompanimentTimerRef.current).toBeNull();
    await act(async () => root.unmount());
  });

  it("does not advance while Study Mode is frozen and honors mute", async () => {
    vi.useFakeTimers();
    const options = createOptions();
    options.current.state.accompanimentVolume = 0;
    options.current.refs.studyModeFreezeRef!.current = true;
    const playNotes = vi.fn();
    let start: ((runId: number, startScoreTimeMs: number) => void) | null = null;
    const root = createRoot(document.createElement("div"));

    const Probe = () => {
      start = useAccompanimentScheduler({
        latestOptionsRef: options,
        playNotes,
      }).startAccompaniment;
      return null;
    };

    await act(async () => root.render(createElement(Probe)));
    act(() => start?.(7, 0));
    await act(async () => vi.advanceTimersByTimeAsync(140));
    expect(playNotes).not.toHaveBeenCalled();

    options.current.refs.studyModeFreezeRef!.current = false;
    options.current.refs.gameClockStartMsRef.current = performance.now();
    options.current.state.accompanimentVolume = 10;
    await act(async () => vi.advanceTimersByTimeAsync(120));
    expect(playNotes).toHaveBeenCalledTimes(2);

    options.current.refs.playbackRunRef.current = 8;
    await act(async () => vi.advanceTimersByTimeAsync(20));
    await act(async () => root.unmount());
  });
});
