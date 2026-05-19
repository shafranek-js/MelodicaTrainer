import { useCallback, useEffect, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import type { PlaybackEvent, PlaybackTiming } from "./types";
import { findStudyModeWaitTarget } from "./studyModeWaitTarget";

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
  const [isWaiting, setIsWaiting] = useState(false);

  useEffect(() => {
    if (currentEventIndex === 0) {
      studyModeNextIndexRef.current = 0;
    }
  }, [currentEventIndex]);

  useEffect(() => {
    if (!isStudyMode || !isPlaying || playbackEvents.length === 0) {
      if (studyModeFreezeRef.current) {
        studyModeFreezeRef.current = false;
        setIsWaiting(false);
      }
      return;
    }

    const targetIndex = findStudyModeWaitTarget(
      playbackEvents,
      playbackTimeline,
      studyModeNextIndexRef.current,
      currentGameTimeMs,
    );
    if (targetIndex !== null) {
      studyModeNextIndexRef.current = targetIndex;
      if (!studyModeFreezeRef.current) {
        studyModeFreezeRef.current = true;
        setIsWaiting(true);
      }
      return;
    }

    if (studyModeFreezeRef.current) {
      studyModeFreezeRef.current = false;
      setIsWaiting(false);
    }
  }, [currentEventIndex, currentGameTimeMs, isStudyMode, isPlaying, playbackEvents, playbackTimeline]);

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
