import { useCallback, useEffect, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import type { PlaybackEvent, PlaybackTiming } from "./types";

type UseStudyModePlaybackOptions = {
  currentEventIndex: number;
  currentGameTimeMs: number;
  gameClockStartMsRef: MutableRefObject<number>;
  isPlaying: boolean;
  isStudyMode: boolean;
  playbackEvents: PlaybackEvent[];
  playbackTimeline: PlaybackTiming[];
  setCurrentEventIndex: (index: number) => void;
};

export const useStudyModePlayback = ({
  currentEventIndex,
  currentGameTimeMs,
  gameClockStartMsRef,
  isPlaying,
  isStudyMode,
  playbackEvents,
  playbackTimeline,
  setCurrentEventIndex,
}: UseStudyModePlaybackOptions) => {
  const studyModeFreezeRef = useRef(false);
  const studyModeNextIndexRef = useRef(0);
  const studyModeTimeRef = useRef(currentGameTimeMs);
  const [isWaiting, setIsWaiting] = useState(false);

  studyModeTimeRef.current = currentGameTimeMs;

  useEffect(() => {
    if (!isStudyMode || !isPlaying || playbackEvents.length === 0) {
      if (studyModeFreezeRef.current) {
        studyModeFreezeRef.current = false;
        setIsWaiting(false);
      }
      return;
    }

    const check = () => {
      const now = studyModeTimeRef.current;
      for (let i = studyModeNextIndexRef.current; i < playbackEvents.length; i += 1) {
        const timing = playbackTimeline[i];
        if (!timing) continue;
        const ev = playbackEvents[i];
        const hasNotes = ev.notes.some((note) => note.shouldPlay);
        if (!hasNotes) continue;
        if (now >= timing.startMs) {
          studyModeNextIndexRef.current = i;
          if (!studyModeFreezeRef.current) {
            studyModeFreezeRef.current = true;
            setIsWaiting(true);
          }
          return;
        }
      }

      if (studyModeFreezeRef.current) {
        studyModeFreezeRef.current = false;
        setIsWaiting(false);
      }
    };

    check();
    const interval = setInterval(check, 100);
    return () => clearInterval(interval);
  }, [isStudyMode, isPlaying, playbackEvents, playbackTimeline, currentEventIndex]);

  useEffect(() => {
    if (currentEventIndex === 0) {
      studyModeNextIndexRef.current = 0;
    }
  }, [currentEventIndex]);

  const handleStudyModeHit = useCallback((eventIndex: number) => {
    if (eventIndex !== studyModeNextIndexRef.current) return;

    studyModeNextIndexRef.current = eventIndex + 1;
    setCurrentEventIndex(eventIndex + 1);

    if (studyModeFreezeRef.current) {
      studyModeFreezeRef.current = false;
      setIsWaiting(false);
      gameClockStartMsRef.current = performance.now();
    }
  }, [gameClockStartMsRef, setCurrentEventIndex]);

  return {
    handleStudyModeHit,
    isWaiting,
    studyModeFreezeRef,
    studyModeNextIndexRef,
  };
};
