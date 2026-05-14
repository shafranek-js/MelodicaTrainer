import { useCallback, useEffect, useRef, useState } from "react";
import type { freqToNoteAndCents } from "../utils/utils";
import {
  getMissedEventIndexes,
  isDetectedPitchHit,
} from "./noteHighwayScoring";
import type { GameStats, PlaybackEvent, PlaybackTiming } from "./types";

type DetectedNote = NonNullable<ReturnType<typeof freqToNoteAndCents>>;

type UseNoteHighwayScoringOptions = {
  currentGameTimeMs: number;
  currentGameEvent: PlaybackEvent | undefined;
  detectedNote: DetectedNote | null;
  playbackEvents: PlaybackEvent[];
  playbackTimeline: PlaybackTiming[];
  targetEventIndex: number | null;
};

const emptyGameStats: GameStats = {
  hits: 0,
  misses: 0,
  streak: 0,
};

export const useNoteHighwayScoring = ({
  currentGameTimeMs,
  currentGameEvent,
  detectedNote,
  playbackEvents,
  playbackTimeline,
  targetEventIndex,
}: UseNoteHighwayScoringOptions) => {
  const [gameStats, setGameStats] = useState<GameStats>(emptyGameStats);
  const [lastHitIndex, setLastHitIndex] = useState<number | null>(null);
  const scoredEventIndexesRef = useRef(new Set<number>());

  const isCurrentHit = isDetectedPitchHit({
    currentGameEvent,
    detectedNote,
    targetEventIndex,
  });
  const accuracy =
    gameStats.hits + gameStats.misses > 0
      ? Math.round((gameStats.hits / (gameStats.hits + gameStats.misses)) * 100)
      : 0;

  const resetScoring = useCallback(() => {
    setGameStats(emptyGameStats);
    setLastHitIndex(null);
    scoredEventIndexesRef.current = new Set();
  }, []);

  useEffect(() => {
    if (
      targetEventIndex === null ||
      !isCurrentHit ||
      scoredEventIndexesRef.current.has(targetEventIndex)
    ) {
      return;
    }

    scoredEventIndexesRef.current.add(targetEventIndex);
    setLastHitIndex(targetEventIndex);
    setGameStats((stats) => ({
      ...stats,
      hits: stats.hits + 1,
      streak: stats.streak + 1,
    }));
  }, [isCurrentHit, targetEventIndex]);

  useEffect(() => {
    const missedIndexes = getMissedEventIndexes({
      currentGameTimeMs,
      playbackEvents,
      playbackTimeline,
      scoredEventIndexes: scoredEventIndexesRef.current,
    });

    if (missedIndexes.length > 0) {
      missedIndexes.forEach((index) => scoredEventIndexesRef.current.add(index));
      setGameStats((stats) => ({
        ...stats,
        misses: stats.misses + missedIndexes.length,
        streak: 0,
      }));
    }
  }, [currentGameTimeMs, playbackEvents, playbackTimeline]);

  return {
    accuracy,
    gameStats,
    lastHitIndex,
    resetScoring,
  };
};
