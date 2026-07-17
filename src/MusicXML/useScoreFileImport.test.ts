import { describe, expect, it, vi } from "vitest";
import { DEFAULT_TEMPO_BPM } from "./tempoModel";
import { resetImportedScoreState } from "./useScoreFileImport";

describe("resetImportedScoreState", () => {
  it("uses the same reset path for every successfully loaded score", () => {
    const resetGpScore = vi.fn();
    const resetMidiScore = vi.fn();
    const setDetectedTempoBpm = vi.fn();
    const setIsSheetReady = vi.fn();
    const setPlaybackEvents = vi.fn();
    const setTranspose = vi.fn();
    const setUserTempoBpm = vi.fn();
    const stopPlayback = vi.fn();

    resetImportedScoreState(
      { content: "<score-partwise />", fileName: "score.mxl", format: "musicxml" },
      {
        resetGpScore,
        resetMidiScore,
        setDetectedTempoBpm,
        setIsSheetReady,
        setPlaybackEvents,
        setTranspose,
        setUserTempoBpm,
        stopPlayback,
      },
    );

    expect(stopPlayback).toHaveBeenCalledWith(true);
    expect(resetGpScore).toHaveBeenCalledWith(false);
    expect(resetMidiScore).toHaveBeenCalledOnce();
    expect(setPlaybackEvents).toHaveBeenCalledWith([]);
    expect(setIsSheetReady).toHaveBeenCalledWith(false);
    expect(setUserTempoBpm).toHaveBeenCalledWith(null);
    expect(setDetectedTempoBpm).toHaveBeenCalledWith(DEFAULT_TEMPO_BPM);
    expect(setTranspose).toHaveBeenCalledWith(0);
  });
});
