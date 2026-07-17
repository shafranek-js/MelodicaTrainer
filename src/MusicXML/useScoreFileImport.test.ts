import { describe, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { DEFAULT_TEMPO_BPM } from "./tempoModel";
import {
  resetImportedScoreState,
  useScoreFileImport,
} from "./useScoreFileImport";
import type { LoadedScoreFile } from "./useScoreFileLoader";

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

  it("resets playback after validation and before committing the loaded file", async () => {
    const order: string[] = [];
    const loadedFile: LoadedScoreFile = {
      content: "<score-partwise />",
      fileName: "library-score.mxl",
      format: "musicxml",
    };
    const loadScoreFile = vi.fn(async (
      _file: File,
      beforeCommit?: (file: LoadedScoreFile) => void,
    ) => {
      order.push("validated");
      beforeCommit?.(loadedFile);
      order.push("committed");
      return loadedFile;
    });
    const stopPlayback = vi.fn(() => order.push("reset"));
    const container = document.createElement("div");
    const root = createRoot(container);
    let importScoreFile: ((file: File) => Promise<LoadedScoreFile>) | null = null;

    const Harness = () => {
      ({ importScoreFile } = useScoreFileImport({
        loadScoreFile,
        onImportError: vi.fn(),
        resetGpScore: vi.fn(),
        resetMidiScore: vi.fn(),
        setDetectedTempoBpm: vi.fn(),
        setIsSheetReady: vi.fn(),
        setPlaybackEvents: vi.fn(),
        setTranspose: vi.fn(),
        setUserTempoBpm: vi.fn(),
        stopPlayback,
      }));
      return null;
    };

    await act(async () => root.render(createElement(Harness)));
    await act(async () => {
      await importScoreFile?.(new File([loadedFile.content], loadedFile.fileName));
    });

    expect(order).toEqual(["validated", "reset", "committed"]);
    act(() => root.unmount());
  });
});
