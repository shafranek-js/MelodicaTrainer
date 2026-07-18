import { describe, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { DEFAULT_TEMPO_BPM } from "./tempoModel";
import {
  resetImportedScoreState,
  useScoreFileImport,
} from "./useScoreFileImport";
import { MsczFileError } from "./msczFile";
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
      {
        content: "<score-partwise />",
        fileName: "score.mxl",
        format: "musicxml",
        sourceFormat: "musicxml",
        warnings: [],
      },
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
      sourceFormat: "musicxml",
      warnings: [],
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

  it("offers an explicit high-fidelity retry after a blocked MSCZ conversion", async () => {
    const file = new File(["score"], "blocked.mscz");
    const converted: LoadedScoreFile = {
      content: "<score-partwise />",
      fileName: file.name,
      format: "musicxml",
      sourceFormat: "musescore",
      warnings: ["Converted with the compatibility engine."],
    };
    const loadScoreFile = vi.fn(async (
      _file: File,
      beforeCommit?: (loadedFile: LoadedScoreFile) => void,
      options?: { msczConverter?: "standard" | "high-fidelity" },
    ) => {
      if (options?.msczConverter !== "high-fidelity") {
        throw new MsczFileError("conversion-loss");
      }
      beforeCommit?.(converted);
      return converted;
    });
    const container = document.createElement("div");
    const root = createRoot(container);
    let hook: ReturnType<typeof useScoreFileImport> | null = null;

    const Harness = () => {
      hook = useScoreFileImport({
        loadScoreFile,
        onImportError: vi.fn(),
        resetGpScore: vi.fn(),
        resetMidiScore: vi.fn(),
        setDetectedTempoBpm: vi.fn(),
        setIsSheetReady: vi.fn(),
        setPlaybackEvents: vi.fn(),
        setTranspose: vi.fn(),
        setUserTempoBpm: vi.fn(),
        stopPlayback: vi.fn(),
      });
      return null;
    };

    await act(async () => root.render(createElement(Harness)));
    await act(async () => {
      await expect(hook?.importScoreFile(file)).rejects.toMatchObject({
        reason: "conversion-loss",
      });
    });
    expect((hook as unknown as ReturnType<typeof useScoreFileImport>).highFidelityMsczFile).toBe(file);

    await act(async () => {
      await (hook as unknown as ReturnType<typeof useScoreFileImport>).retryMsczWithHighFidelity();
    });
    expect(loadScoreFile).toHaveBeenLastCalledWith(
      file,
      expect.any(Function),
      { msczConverter: "high-fidelity" },
    );
    expect((hook as unknown as ReturnType<typeof useScoreFileImport>).highFidelityMsczFile).toBeNull();
    act(() => root.unmount());
  });

  it("offers the fallback for a successful standard conversion with warnings", async () => {
    const file = new File(["score"], "warning.mscz");
    const loadedFile: LoadedScoreFile = {
      content: "<score-partwise />",
      fileName: file.name,
      format: "musicxml",
      sourceFormat: "musescore",
      warnings: ["Some notation was simplified."],
    };
    const container = document.createElement("div");
    const root = createRoot(container);
    let hook: ReturnType<typeof useScoreFileImport> | null = null;

    const Harness = () => {
      hook = useScoreFileImport({
        loadScoreFile: vi.fn(async (_file, beforeCommit) => {
          beforeCommit?.(loadedFile);
          return loadedFile;
        }),
        onImportError: vi.fn(),
        resetGpScore: vi.fn(),
        resetMidiScore: vi.fn(),
        setDetectedTempoBpm: vi.fn(),
        setIsSheetReady: vi.fn(),
        setPlaybackEvents: vi.fn(),
        setTranspose: vi.fn(),
        setUserTempoBpm: vi.fn(),
        stopPlayback: vi.fn(),
      });
      return null;
    };

    await act(async () => root.render(createElement(Harness)));
    await act(async () => { await hook?.importScoreFile(file); });
    expect((hook as unknown as ReturnType<typeof useScoreFileImport>).highFidelityMsczFile).toBe(file);
    act(() => root.unmount());
  });
});
