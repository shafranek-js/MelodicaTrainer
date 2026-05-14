import { useCallback, useMemo } from "react";
import { findAutoTransposeIntervals, findBestTransposeIntervals } from "./musicXmlTransform";
import { getPlayableMidiNumbers } from "./playbackTimeline";
import { musicXmlDebugLogger } from "./debugLogger";
import type { ScoreFileContent } from "./useScoreFileLoader";
import type { PlaybackEvent } from "./types";

type UseTransposeOptimizerOptions = {
  gpOriginalMidiNumbers: number[];
  harmonicaKey: string;
  isGpFile: boolean;
  noBend: boolean;
  noOverblowOrDraw: boolean;
  playbackEvents: PlaybackEvent[];
  rawFileContent: ScoreFileContent | null;
  setTranspose: (transpose: number) => void;
  transpose: number;
};

export const useTransposeOptimizer = ({
  gpOriginalMidiNumbers,
  harmonicaKey,
  isGpFile,
  noBend,
  noOverblowOrDraw,
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
      midiNumbers = Array.from(getPlayableMidiNumbers(playbackEvents)).map((midi) => midi - transpose);
    }

    if (midiNumbers.length === 0) return 0;

    return findBestTransposeIntervals(midiNumbers, {
      selectedKey: harmonicaKey,
      noOverblowOrDraw,
      noBend,
    }).length;
  }, [
    gpOriginalMidiNumbers,
    harmonicaKey,
    isGpFile,
    noBend,
    noOverblowOrDraw,
    playbackEvents,
    rawFileContent,
    transpose,
  ]);

  const autoTransposeWithFilters = useCallback(() => {
    if (!rawFileContent) return;

    if (isGpFile) {
      musicXmlDebugLogger.log("AutoTranspose: Analyzing GP track for optimization (Cycling)...");
      const originalMidiNumbers = gpOriginalMidiNumbers;
      if (originalMidiNumbers.length === 0) return;

      const bestAbsoluteIntervals = findBestTransposeIntervals(originalMidiNumbers, {
        selectedKey: harmonicaKey,
        noOverblowOrDraw,
        noBend,
      });

      musicXmlDebugLogger.log(
        `AutoTranspose: Found ${bestAbsoluteIntervals.length} optimal positions:`,
        bestAbsoluteIntervals
      );

      if (bestAbsoluteIntervals.length === 0) return;

      const currentIndex = bestAbsoluteIntervals.indexOf(transpose);
      const nextTranspose =
        currentIndex !== -1 && bestAbsoluteIntervals.length > 1
          ? bestAbsoluteIntervals[(currentIndex + 1) % bestAbsoluteIntervals.length]
          : bestAbsoluteIntervals[0];

      musicXmlDebugLogger.log(`AutoTranspose: Selecting absolute position: ${nextTranspose}`);
      setTranspose(nextTranspose);
      return;
    }

    const bestIntervals = findAutoTransposeIntervals(rawFileContent as string, {
      selectedKey: harmonicaKey,
      noOverblowOrDraw,
      noBend,
    });
    if (bestIntervals.length === 0) return;

    const currentIndex = bestIntervals.indexOf(transpose);
    const nextTranspose =
      currentIndex !== -1 && bestIntervals.length > 1
        ? bestIntervals[(currentIndex + 1) % bestIntervals.length]
        : bestIntervals[0];
    setTranspose(nextTranspose);
  }, [
    gpOriginalMidiNumbers,
    harmonicaKey,
    isGpFile,
    noBend,
    noOverblowOrDraw,
    rawFileContent,
    setTranspose,
    transpose,
  ]);

  return {
    autoTransposeWithFilters,
    optimalVariantsCount,
  };
};
