import { useCallback, useMemo } from "react";
import { findBestMelodicaTransposeIntervals } from "./musicXmlTransform";
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

type GetBestScoreTransposeIntervalsOptions = Pick<
  UseTransposeOptimizerOptions,
  "keyCount" | "originalMidiNumbers" | "playbackEvents" | "scoreFormat" | "transpose"
>;

export const getBestScoreTransposeIntervals = ({
  keyCount,
  originalMidiNumbers,
  playbackEvents,
  scoreFormat,
  transpose,
}: GetBestScoreTransposeIntervalsOptions) => {
  const midiNumbers = scoreFormat === "guitar-pro" || scoreFormat === "midi"
    ? originalMidiNumbers
    : Array.from(getPlayableMidiNumbers(playbackEvents)).map(
        (midi) => midi - transpose,
      );

  if (midiNumbers.length === 0) return [];
  return findBestMelodicaTransposeIntervals(midiNumbers, { keyCount });
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
    return getBestScoreTransposeIntervals({
      keyCount,
      originalMidiNumbers,
      playbackEvents,
      scoreFormat,
      transpose,
    }).length;
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
    }

    const bestIntervals = getBestScoreTransposeIntervals({
      keyCount,
      originalMidiNumbers,
      playbackEvents,
      scoreFormat,
      transpose,
    });
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
    playbackEvents,
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
