import { useEffect } from "react";
import { useSetPlaybackToolbarState } from "../PlaybackToolbarContext";
import type { GameStats } from "./types";
import type { RecordingState } from "./useMidiRecording";

type UsePlaybackToolbarSyncOptions = {
  accuracy: number;
  canPlayback: boolean;
  gameStats: GameStats;
  isLooping: boolean;
  isPaused: boolean;
  isPlaying: boolean;
  onRestartPlayback: () => void;
  onSetTempo: (tempo: number) => void;
  onToggleLoop: () => void;
  onTogglePlayback: () => void;
  onToggleRecording: () => void;
  progress: number;
  recordingDurationMs: number;
  recordingError: string | null;
  recordingState: RecordingState;
  tempo: number;
};

export const usePlaybackToolbarSync = ({
  accuracy,
  canPlayback,
  gameStats,
  isLooping,
  isPaused,
  isPlaying,
  onRestartPlayback,
  onSetTempo,
  onToggleLoop,
  onTogglePlayback,
  onToggleRecording,
  progress,
  recordingDurationMs,
  recordingError,
  recordingState,
  tempo,
}: UsePlaybackToolbarSyncOptions) => {
  const setPlaybackToolbarState = useSetPlaybackToolbarState();

  useEffect(() => {
    setPlaybackToolbarState({
      accuracy,
      canPlayback,
      gameStats,
      isLooping,
      isPaused,
      isPlaying,
      onRestartPlayback,
      onToggleLoop,
      onTogglePlayback,
      onToggleRecording,
      progress,
      recordingDurationMs,
      recordingError,
      recordingState,
      setTempo: onSetTempo,
      tempo,
    });
  }, [
    accuracy,
    canPlayback,
    gameStats,
    isLooping,
    isPaused,
    isPlaying,
    onRestartPlayback,
    onSetTempo,
    onToggleLoop,
    onTogglePlayback,
    onToggleRecording,
    progress,
    recordingDurationMs,
    recordingError,
    recordingState,
    setPlaybackToolbarState,
    tempo,
  ]);

  useEffect(() => () => setPlaybackToolbarState(null), [setPlaybackToolbarState]);
};
