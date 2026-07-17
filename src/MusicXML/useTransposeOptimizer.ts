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
import type { ScoreFormat } from "./scoreFormat";

type UseTransposeOptimizerOptions = {
  originalMidiNumbers: number[];
  keyCount: MelodicaKeyCount;
  playbackEvents: PlaybackEvent[];
  rawFileContent: ScoreFileContent | null;
  scoreFormat: ScoreFormat | null;
  setTranspose: (transpose: number) => void;
  transpose: number;
};

export const useTransposeOptimizer = ({
  originalMidiNumbers,
  keyCount,
  playbackEvents,
  rawFileContent,
  scoreFormat,
  setTranspose,
  transpose,
}: UseTransposeOptimizerOptions) => {
  const optimalVariantsCount = useMemo(() => {
    if (!rawFileContent) return 0;

    let midiNumbers: number[] = [];
    if (scoreFormat === "guitar-pro" || scoreFormat === "midi") {
      midiNumbers = originalMidiNumbers;
    } else {
      if (playbackEvents.length === 0) return 0;
      midiNumbers = Array.from(getPlayableMidiNumbers(playbackEvents)).map(
        (midi) => midi - transpose
      );
    }

    if (midiNumbers.length === 0) return 0;

    return findBestMelodicaTransposeIntervals(midiNumbers, { keyCount }).length;
  }, [
    keyCount,
    originalMidiNumbers,
    playbackEvents,
    rawFileContent,
    scoreFormat,
    transpose,
  ]);

  const autoTransposeWithFilters = useCallback(() => {
    if (!rawFileContent) return;

    if (scoreFormat === "guitar-pro" || scoreFormat === "midi") {
      musicXmlDebugLogger.log(`AutoTranspose: Analyzing ${scoreFormat} notes for melodica range.`);
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

    if (typeof rawFileContent !== "string") return;
    const bestIntervals = findAutoMelodicaTransposeIntervals(rawFileContent, { keyCount });
    if (bestIntervals.length === 0) return;

    const currentIndex = bestIntervals.indexOf(transpose);
    const nextTranspose =
      currentIndex !== -1 && bestIntervals.length > 1
        ? bestIntervals[(currentIndex + 1) % bestIntervals.length]
        : bestIntervals[0];
    setTranspose(nextTranspose);
  }, [
    keyCount,
    originalMidiNumbers,
    rawFileContent,
    scoreFormat,
    setTranspose,
    transpose,
  ]);

  return {
    autoTransposeWithFilters,
    optimalVariantsCount,
  };
};
