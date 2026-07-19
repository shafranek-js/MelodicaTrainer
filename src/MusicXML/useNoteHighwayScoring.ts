import { useCallback, useEffect, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import { Note } from "tonal";
import {
  getDetectedPitchHitMidi,
  getMissedEventIndexes,
} from "./noteHighwayScoring";
import type { ScoringDetectedNote } from "./noteHighwayScoring";
import type { GameStats, PlaybackEvent, PlaybackTiming } from "./types";

type UseNoteHighwayScoringOptions = {
  currentGameTimeMs: number;
  currentGameEvent: PlaybackEvent | undefined;
  detectedNotes: readonly ScoringDetectedNote[];
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
  detectedNotes,
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
  const consumedMidiNumbersRef = useRef(new Set<number>());

  // A held note can score once. Releasing it makes the same pitch eligible again.
  useEffect(() => {
    const activeMidiNumbers = new Set(
      detectedNotes
        .map((detectedNote) => Note.midi(detectedNote.note))
        .filter((midi): midi is number => midi !== null),
    );
    consumedMidiNumbersRef.current.forEach((midi) => {
      if (!activeMidiNumbers.has(midi)) {
        consumedMidiNumbersRef.current.delete(midi);
      }
    });
  }, [detectedNotes]);

  const unconsumedDetectedNotes = detectedNotes.filter((detectedNote) => {
    const midi = Note.midi(detectedNote.note);
    return midi !== null && !consumedMidiNumbersRef.current.has(midi);
  });

  const currentHitMidi = getDetectedPitchHitMidi({
    currentGameEvent,
    detectedNotes: unconsumedDetectedNotes,
    targetEventIndex,
  });

  // In study mode, override the target to the next unplayed event.
  // time-based targetEventIndex can get stuck on an already-scored event
  // when consecutive events share the same startMs.
  const effectiveTarget = isStudyMode && studyModeNextIndexRef
    ? studyModeNextIndexRef.current
    : targetEventIndex;

  // Similarly, check the hit against the effective target event.
  const effectiveHitMidi = isStudyMode && studyModeNextIndexRef
    ? effectiveTarget === null
      ? null
      : getDetectedPitchHitMidi({
          currentGameEvent: playbackEvents[effectiveTarget],
          detectedNotes: unconsumedDetectedNotes,
          targetEventIndex: effectiveTarget,
        })
    : currentHitMidi;

  const isFreshHit = effectiveHitMidi !== null;

  const accuracy =
    gameStats.hits + gameStats.misses > 0
      ? Math.round((gameStats.hits / (gameStats.hits + gameStats.misses)) * 100)
      : 0;

  const resetScoring = useCallback(() => {
    setGameStats(emptyGameStats);
    setLastHitIndex(null);
    scoredEventIndexesRef.current = new Set();
    consumedMidiNumbersRef.current = new Set();
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
    if (effectiveHitMidi !== null) {
      consumedMidiNumbersRef.current.add(effectiveHitMidi);
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
  }, [effectiveHitMidi, isFreshHit, effectiveTarget, isStudyMode, studyModeOnHit]);

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
