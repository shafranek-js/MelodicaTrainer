import { useCallback, useRef } from "react";
import type { MutableRefObject } from "react";
import { Note } from "tonal";
import { getAudioOutputLatencyMs } from "./audioPlayback";
import {
  getLatencyAdjustedClockOffsetMs,
  getPlaybackEventTiming,
  getPlaybackTrailDelayMs,
} from "./playbackTiming";
import type { UseScorePlaybackOptions } from "./scorePlaybackTypes";
import type { PlaybackEvent } from "./types";

type UsePlaybackSchedulerOptions = {
  latestOptionsRef: MutableRefObject<UseScorePlaybackOptions>;
  playNotes: (
    notes: PlaybackEvent["notes"],
    tempoBpm: number,
    tempoScale: number,
  ) => void;
  restartPlaybackLoop: (runId: number) => boolean;
  stopPlayback: (reset?: boolean, shouldResetScoring?: boolean) => void;
};

export const usePlaybackScheduler = ({
  latestOptionsRef,
  playNotes,
  restartPlaybackLoop,
  stopPlayback,
}: UsePlaybackSchedulerOptions) => {
  const schedulePlaybackRef = useRef<
    (startIndex: number, runId: number) => void
  >(() => {});

  const schedulePlayback = useCallback(
    (startIndex: number, runId: number) => {
      const {
        callbacks: { onPlaybackComplete, setCurrentEventIndex },
        refs: {
          audioContextRef,
          gameClockOffsetMsRef,
          gameClockStartMsRef,
          moveCursorThroughEventRef,
          playbackRunRef,
          playbackTimerRef,
          studyModeFreezeRef,
          tempoScaleRef,
        },
        state: { playbackEvents, playbackTimeline, shortestNoteDurationMs },
      } = latestOptionsRef.current;

      const event = playbackEvents[startIndex];

      if (!event) {
        if (restartPlaybackLoop(runId)) {
          schedulePlaybackRef.current(0, runId);
          return;
        }

        playbackTimerRef.current = window.setTimeout(() => {
          playbackTimerRef.current = null;
          if (playbackRunRef.current !== runId) return;
          if (restartPlaybackLoop(runId)) {
            schedulePlaybackRef.current(0, runId);
            return;
          }
          onPlaybackComplete();
          stopPlayback(true, false);
        }, getPlaybackTrailDelayMs(shortestNoteDurationMs, tempoScaleRef.current));

        return;
      }

      const { durationMs, effectiveTempoBpm } = getPlaybackEventTiming(
        event,
        tempoScaleRef.current,
      );

      gameClockOffsetMsRef.current = getLatencyAdjustedClockOffsetMs(
        playbackTimeline[startIndex]?.startMs ?? 0,
        getAudioOutputLatencyMs(audioContextRef.current),
        tempoScaleRef.current,
      );
      gameClockStartMsRef.current = performance.now();

      setCurrentEventIndex(startIndex);
      moveCursorThroughEventRef.current(startIndex, durationMs);
      const attackMidiNumbers = event.notes.flatMap((note) => {
        if (!note.shouldPlay) return [];
        const midi = Note.midi(note.name);
        return midi === null ? [] : [midi];
      });
      if (attackMidiNumbers.length > 0) {
        latestOptionsRef.current.callbacks.onPlaybackAttack(attackMidiNumbers);
      }
      playNotes(event.notes, effectiveTempoBpm, tempoScaleRef.current);

      const scheduleNext = () => {
        if (playbackRunRef.current !== runId) return;

        if (studyModeFreezeRef?.current) {
          playbackTimerRef.current = window.setTimeout(scheduleNext, 50);
          return;
        }

        schedulePlaybackRef.current(startIndex + 1, runId);
      };

      playbackTimerRef.current = window.setTimeout(scheduleNext, durationMs);
    },
    [latestOptionsRef, playNotes, restartPlaybackLoop, stopPlayback],
  );

  schedulePlaybackRef.current = schedulePlayback;

  return { schedulePlaybackRef };
};
