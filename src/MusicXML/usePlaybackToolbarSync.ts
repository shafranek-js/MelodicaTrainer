import { useEffect } from "react";
import { useSetPlaybackToolbarState } from "../PlaybackToolbarContext";
import type { GameStats } from "./types";

type UsePlaybackToolbarSyncOptions = {
  accuracy: number;
  canPlayback: boolean;
  currentGameTimeMs: number;
  gameStats: GameStats;
  isLooping: boolean;
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
  currentGameTimeMs,
  gameStats,
  isLooping,
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
      isPaused: !isPlaying && currentGameTimeMs > 0,
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
    currentGameTimeMs,
    gameStats,
    isLooping,
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
