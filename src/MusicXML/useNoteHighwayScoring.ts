import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Note } from "tonal";
import type { freqToNoteAndCents } from "../utils/utils";
import { NOTE_HIT_WINDOW_MS, NOTE_PITCH_TOLERANCE_CENTS } from "./constants";
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

  const currentTargetMidiNumbers = useMemo(
    () =>
      new Set(
        (currentGameEvent?.notes ?? [])
          .map((note) => Note.midi(note.name))
          .filter((midi): midi is number => midi !== null)
      ),
    [currentGameEvent]
  );
  const detectedMidi = detectedNote ? Note.midi(detectedNote.note) : null;
  const isCurrentHit =
    targetEventIndex !== null &&
    detectedMidi !== null &&
    currentTargetMidiNumbers.has(detectedMidi) &&
    Math.abs(detectedNote?.cents ?? 99) <= NOTE_PITCH_TOLERANCE_CENTS;
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
    const missedIndexes: number[] = [];

    playbackEvents.forEach((event, index) => {
      const timing = playbackTimeline[index];
      if (
        !event.notes.length ||
        !timing ||
        scoredEventIndexesRef.current.has(index) ||
        currentGameTimeMs <= timing.endMs + NOTE_HIT_WINDOW_MS
      ) {
        return;
      }

      scoredEventIndexesRef.current.add(index);
      missedIndexes.push(index);
    });

    if (missedIndexes.length > 0) {
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
