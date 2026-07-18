import type { MutableRefObject } from "react";
import type { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import type { AlphaTabViewerRef } from "./AlphaTabViewer";
import type { PlaybackEvent, PlaybackTiming } from "./types";
import type { ScheduledAccompanimentEvent } from "./accompaniment";

export type RouteStatus = {
  tone: "info" | "success" | "error";
  message: string;
};

export type UseScorePlaybackRefs = {
  accompanimentTimerRef: MutableRefObject<number | null>;
  alphaTabRef: MutableRefObject<AlphaTabViewerRef | null>;
  audioContextRef: MutableRefObject<AudioContext | null>;
  cursorEventIndexRef: MutableRefObject<number | null>;
  gameClockFrameRef: MutableRefObject<number | null>;
  gameClockOffsetMsRef: MutableRefObject<number>;
  gameClockStartMsRef: MutableRefObject<number>;
  isPlayingRef: MutableRefObject<boolean>;
  moveCursorThroughEventRef: MutableRefObject<
    (eventIndex: number, durationMs: number) => void
  >;
  osmdInstanceRef: MutableRefObject<OpenSheetMusicDisplay | null>;
  playbackRunRef: MutableRefObject<number>;
  playbackTimerRef: MutableRefObject<number | null>;
  sheetScrollRef: MutableRefObject<HTMLDivElement | null>;
  studyModeFreezeRef?: MutableRefObject<boolean>;
  studyModeNextIndexRef?: MutableRefObject<number>;
  tempoScaleRef: MutableRefObject<number>;
};

export type UseScorePlaybackState = {
  accompanimentSchedule: ScheduledAccompanimentEvent[];
  accompanimentVolume: number;
  canPlayback: boolean;
  currentEventIndex: number;
  currentGameTimeMs: number;
  fileName: string | null;
  isGpPlaybackReady: boolean;
  isGpFile: boolean;
  isLooping: boolean;
  isPlaying: boolean;
  isSheetReady: boolean;
  playbackEvents: PlaybackEvent[];
  playbackTimeline: PlaybackTiming[];
  selectedPreset: string;
  selectedSf: string;
  shortestNoteDurationMs: number;
};

export type UseScorePlaybackCallbacks = {
  onPlaybackComplete: () => void;
  resetScoring: () => void;
  setCurrentEventIndex: (index: number) => void;
  setCurrentGameTimeMs: (timeMs: number) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setRouteStatus: (status: RouteStatus) => void;
  stopGpCursorAnimation: () => void;
};

export type UseScorePlaybackOptions = {
  callbacks: UseScorePlaybackCallbacks;
  refs: UseScorePlaybackRefs;
  state: UseScorePlaybackState;
};
