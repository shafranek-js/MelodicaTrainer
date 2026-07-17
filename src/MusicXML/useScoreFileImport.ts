import { useCallback } from "react";
import type { ChangeEvent } from "react";
import { getResetTempoState } from "./tempoModel";
import type { LoadedScoreFile } from "./useScoreFileLoader";
import type { PlaybackEvent } from "./types";

type UseScoreFileImportOptions = {
  loadScoreFile: (file: File) => Promise<LoadedScoreFile>;
  onImportError: (error: unknown) => void;
  resetGpScore: (isGpFile: boolean) => void;
  resetMidiScore: () => void;
  setDetectedTempoBpm: (tempoBpm: number) => void;
  setIsSheetReady: (isReady: boolean) => void;
  setPlaybackEvents: (events: PlaybackEvent[]) => void;
  setTranspose: (transpose: number) => void;
  setUserTempoBpm: (tempoBpm: number | null) => void;
  stopPlayback: (reset?: boolean) => void;
};

type ResetImportedScoreOptions = Omit<
  UseScoreFileImportOptions,
  "loadScoreFile" | "onImportError"
>;

export const resetImportedScoreState = (
  loadedFile: LoadedScoreFile,
  {
    resetGpScore,
    resetMidiScore,
    setDetectedTempoBpm,
    setIsSheetReady,
    setPlaybackEvents,
    setTranspose,
    setUserTempoBpm,
    stopPlayback,
  }: ResetImportedScoreOptions,
) => {
  stopPlayback(true);
  resetGpScore(loadedFile.format === "guitar-pro");
  resetMidiScore();
  setPlaybackEvents([]);
  setIsSheetReady(false);

  const resetTempoState = getResetTempoState();
  setUserTempoBpm(resetTempoState.userTempoBpm);
  setDetectedTempoBpm(resetTempoState.detectedTempoBpm);
  setTranspose(0);
};

export const useScoreFileImport = ({
  loadScoreFile,
  onImportError,
  resetGpScore,
  resetMidiScore,
  setDetectedTempoBpm,
  setIsSheetReady,
  setPlaybackEvents,
  setTranspose,
  setUserTempoBpm,
  stopPlayback,
}: UseScoreFileImportOptions) => {
  const importScoreFile = useCallback(
    async (file: File) => {
      const loadedFile = await loadScoreFile(file);
      resetImportedScoreState(loadedFile, {
        resetGpScore,
        resetMidiScore,
        setDetectedTempoBpm,
        setIsSheetReady,
        setPlaybackEvents,
        setTranspose,
        setUserTempoBpm,
        stopPlayback,
      });
      return loadedFile;
    },
    [
      loadScoreFile,
      resetGpScore,
      resetMidiScore,
      setDetectedTempoBpm,
      setIsSheetReady,
      setPlaybackEvents,
      setTranspose,
      setUserTempoBpm,
      stopPlayback,
    ],
  );

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      try {
        await importScoreFile(file);
      } catch (err) {
        console.error(err);
        onImportError(err);
      } finally {
        event.target.value = "";
      }
    },
    [importScoreFile, onImportError],
  );

  return { handleFileChange, importScoreFile };
};
