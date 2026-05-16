import { useCallback, useEffect, useRef, useState } from "react";
import type { MutableRefObject } from "react";
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
  isStudyMode?: boolean;
  studyModeNextIndexRef?: MutableRefObject<number>;
  studyModeOnHit?: (eventIndex: number) => void;
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
  isStudyMode,
  studyModeNextIndexRef,
  studyModeOnHit,
}: UseNoteHighwayScoringOptions) => {
  const [gameStats, setGameStats] = useState<GameStats>(emptyGameStats);
  const [lastHitIndex, setLastHitIndex] = useState<number | null>(null);
  const scoredEventIndexesRef = useRef(new Set<number>());
  const consumedPitchNameRef = useRef<string | null>(null);

  // Clear consumed pitch lock when the user stops playing or changes notes.
  useEffect(() => {
    if (!detectedNote) {
      consumedPitchNameRef.current = null;
    } else if (consumedPitchNameRef.current && detectedNote.note !== consumedPitchNameRef.current) {
      consumedPitchNameRef.current = null;
    }
  }, [detectedNote]);

  const isCurrentHit = isDetectedPitchHit({
    currentGameEvent,
    detectedNote,
    targetEventIndex,
  });

  // In study mode, override the target to the next unplayed event.
  // time-based targetEventIndex can get stuck on an already-scored event
  // when consecutive events share the same startMs.
  const effectiveTarget = isStudyMode && studyModeNextIndexRef
    ? studyModeNextIndexRef.current
    : targetEventIndex;

  // Similarly, check the hit against the effective target event.
  const effectiveHit = isStudyMode && studyModeNextIndexRef
    ? (effectiveTarget !== null &&
       detectedNote &&
       isDetectedPitchHit({
         currentGameEvent: playbackEvents[effectiveTarget],
         detectedNote,
         targetEventIndex: effectiveTarget,
       }))
    : isCurrentHit;
    
  const isFreshHit = Boolean(effectiveHit && detectedNote && detectedNote.note !== consumedPitchNameRef.current);

  const accuracy =
    gameStats.hits + gameStats.misses > 0
      ? Math.round((gameStats.hits / (gameStats.hits + gameStats.misses)) * 100)
      : 0;

  const resetScoring = useCallback(() => {
    setGameStats(emptyGameStats);
    setLastHitIndex(null);
    scoredEventIndexesRef.current = new Set();
    consumedPitchNameRef.current = null;
  }, []);

  useEffect(() => {
    if (
      effectiveTarget === null ||
      !isFreshHit ||
      scoredEventIndexesRef.current.has(effectiveTarget)
    ) {
      return;
    }

    scoredEventIndexesRef.current.add(effectiveTarget);
    setLastHitIndex(effectiveTarget);
    if (detectedNote) {
      consumedPitchNameRef.current = detectedNote.note;
    }
    
    setGameStats((stats) => ({
      ...stats,
      hits: stats.hits + 1,
      streak: stats.streak + 1,
    }));
    // Study mode: always notify on hit. The handler checks freeze state.
    if (isStudyMode && effectiveTarget !== null) {
      studyModeOnHit?.(effectiveTarget);
    }
  }, [isFreshHit, effectiveTarget, isStudyMode, studyModeOnHit, detectedNote]);

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
