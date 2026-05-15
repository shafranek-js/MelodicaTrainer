import { useCallback, useMemo } from "react";
import {
  findAutoMelodicaTransposeIntervals,
  findBestMelodicaTransposeIntervals,
} from "./musicXmlTransform";
import { getPlayableMidiNumbers } from "./playbackTimeline";
import { musicXmlDebugLogger } from "./debugLogger";
import type { MelodicaKeyCount } from "../utils/utils";
import type { ScoreFileContent } from "./useScoreFileLoader";
import type { PlaybackEvent } from "./types";

type UseTransposeOptimizerOptions = {
  gpOriginalMidiNumbers: number[];
  keyCount: MelodicaKeyCount;
  isGpFile: boolean;
  playbackEvents: PlaybackEvent[];
  rawFileContent: ScoreFileContent | null;
  setTranspose: (transpose: number) => void;
  transpose: number;
};

export const useTransposeOptimizer = ({
  gpOriginalMidiNumbers,
  keyCount,
  isGpFile,
  playbackEvents,
  rawFileContent,
  setTranspose,
  transpose,
}: UseTransposeOptimizerOptions) => {
  const optimalVariantsCount = useMemo(() => {
    if (!rawFileContent) return 0;

    let midiNumbers: number[] = [];
    if (isGpFile) {
      midiNumbers = gpOriginalMidiNumbers;
    } else {
      if (playbackEvents.length === 0) return 0;
      midiNumbers = Array.from(getPlayableMidiNumbers(playbackEvents)).map(
        (midi) => midi - transpose
      );
    }

    if (midiNumbers.length === 0) return 0;

    return findBestMelodicaTransposeIntervals(midiNumbers, { keyCount }).length;
  }, [
    gpOriginalMidiNumbers,
    isGpFile,
    keyCount,
    playbackEvents,
    rawFileContent,
    transpose,
  ]);

  const autoTransposeWithFilters = useCallback(() => {
    if (!rawFileContent) return;

    if (isGpFile) {
      musicXmlDebugLogger.log("AutoTranspose: Analyzing GP track for melodica range.");
      const originalMidiNumbers = gpOriginalMidiNumbers;
      if (originalMidiNumbers.length === 0) return;

      const bestAbsoluteIntervals = findBestMelodicaTransposeIntervals(
        originalMidiNumbers,
        { keyCount }
      );

      if (bestAbsoluteIntervals.length === 0) return;

      const currentIndex = bestAbsoluteIntervals.indexOf(transpose);
      const nextTranspose =
        currentIndex !== -1 && bestAbsoluteIntervals.length > 1
          ? bestAbsoluteIntervals[(currentIndex + 1) % bestAbsoluteIntervals.length]
          : bestAbsoluteIntervals[0];

      setTranspose(nextTranspose);
      return;
    }

    const bestIntervals = findAutoMelodicaTransposeIntervals(
      rawFileContent as string,
      { keyCount }
    );
    if (bestIntervals.length === 0) return;

    const currentIndex = bestIntervals.indexOf(transpose);
    const nextTranspose =
      currentIndex !== -1 && bestIntervals.length > 1
        ? bestIntervals[(currentIndex + 1) % bestIntervals.length]
        : bestIntervals[0];
    setTranspose(nextTranspose);
  }, [
    gpOriginalMidiNumbers,
    isGpFile,
    keyCount,
    rawFileContent,
    setTranspose,
    transpose,
  ]);

  return {
    autoTransposeWithFilters,
    optimalVariantsCount,
  };
};
