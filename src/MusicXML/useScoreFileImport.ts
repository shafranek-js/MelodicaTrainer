import { useCallback } from "react";
import type { ChangeEvent } from "react";
import { getResetTempoState } from "./tempoModel";
import type { LoadedScoreFile } from "./useScoreFileLoader";
import type { PlaybackEvent } from "./types";

type UseScoreFileImportOptions = {
  loadScoreFile: (file: File) => Promise<LoadedScoreFile>;
  resetGpScore: (isGpFile: boolean) => void;
  setDetectedTempoBpm: (tempoBpm: number) => void;
  setIsSheetReady: (isReady: boolean) => void;
  setPlaybackEvents: (events: PlaybackEvent[]) => void;
  setTranspose: (transpose: number) => void;
  setUserTempoBpm: (tempoBpm: number | null) => void;
  stopPlayback: (reset?: boolean) => void;
};

export const useScoreFileImport = ({
  loadScoreFile,
  resetGpScore,
  setDetectedTempoBpm,
  setIsSheetReady,
  setPlaybackEvents,
  setTranspose,
  setUserTempoBpm,
  stopPlayback,
}: UseScoreFileImportOptions) =>
  useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      try {
        stopPlayback(true);
        const loadedFile = await loadScoreFile(file);
        resetGpScore(loadedFile.isGpFile);
        setPlaybackEvents([]);
        setIsSheetReady(false);

        const resetTempoState = getResetTempoState();
        setUserTempoBpm(resetTempoState.userTempoBpm);
        setDetectedTempoBpm(resetTempoState.detectedTempoBpm);
        setTranspose(0);
      } catch (err) {
        console.error(err);
      } finally {
        event.target.value = "";
      }
    },
    [
      loadScoreFile,
      resetGpScore,
      setDetectedTempoBpm,
      setIsSheetReady,
      setPlaybackEvents,
      setTranspose,
      setUserTempoBpm,
      stopPlayback,
    ]
  );
