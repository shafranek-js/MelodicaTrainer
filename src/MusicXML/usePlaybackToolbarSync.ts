import { useEffect } from "react";
import { useSetPlaybackToolbarState } from "../PlaybackToolbarContext";
import type { GameStats } from "./types";

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
  progress: number;
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
  progress,
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
      progress,
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
    progress,
    setPlaybackToolbarState,
    tempo,
  ]);

  useEffect(() => () => setPlaybackToolbarState(null), [setPlaybackToolbarState]);
};
