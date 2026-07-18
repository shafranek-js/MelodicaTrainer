import { useCallback, useState } from "react";
import type { ChangeEvent } from "react";
import { canRetryMsczWithHighFidelity } from "./msczFile";
import { getResetTempoState } from "./tempoModel";
import type {
  BeforeScoreFileCommit,
  LoadedScoreFile,
  ScoreFileLoadOptions,
} from "./useScoreFileLoader";
import type { PlaybackEvent } from "./types";

type UseScoreFileImportOptions = {
  loadScoreFile: (
    file: File,
    beforeCommit?: BeforeScoreFileCommit,
    options?: ScoreFileLoadOptions,
  ) => Promise<LoadedScoreFile>;
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
  const [highFidelityMsczFile, setHighFidelityMsczFile] = useState<File | null>(null);

  const importScoreFile = useCallback(
    async (file: File, options: ScoreFileLoadOptions = {}) => {
      try {
        const loadedFile = await loadScoreFile(file, (nextLoadedFile) => {
          resetImportedScoreState(nextLoadedFile, {
            resetGpScore,
            resetMidiScore,
            setDetectedTempoBpm,
            setIsSheetReady,
            setPlaybackEvents,
            setTranspose,
            setUserTempoBpm,
            stopPlayback,
          });
        }, options);
        setHighFidelityMsczFile(
          options.msczConverter !== "high-fidelity" &&
          loadedFile.sourceFormat === "musescore" &&
          loadedFile.warnings.length > 0
            ? file
            : null,
        );
        return loadedFile;
      } catch (error) {
        setHighFidelityMsczFile(
          canRetryMsczWithHighFidelity(error) ? file : null,
        );
        throw error;
      }
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

  const retryMsczWithHighFidelity = useCallback(async () => {
    if (!highFidelityMsczFile) {
      throw new Error("Choose the MSCZ file again before retrying conversion.");
    }
    return importScoreFile(highFidelityMsczFile, {
      msczConverter: "high-fidelity",
    });
  }, [highFidelityMsczFile, importScoreFile]);

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

  return {
    handleFileChange,
    highFidelityMsczFile,
    importScoreFile,
    retryMsczWithHighFidelity,
  };
};
