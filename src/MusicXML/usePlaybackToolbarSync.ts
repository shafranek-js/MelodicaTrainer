import { useEffect } from "react";
import { useSetPlaybackToolbarState } from "../PlaybackToolbarContext";
import type { GameStats } from "./types";

type UsePlaybackToolbarSyncOptions = {
  accuracy: number;
  canPlayback: boolean;
  currentGameTimeMs: number;
  gameStats: GameStats;
  isPlaying: boolean;
  onRestartPlayback: () => void;
  onSetTempo: (tempo: number) => void;
  onTogglePlayback: () => void;
  progress: number;
  tempo: number;
};

export const usePlaybackToolbarSync = ({
  accuracy,
  canPlayback,
  currentGameTimeMs,
  gameStats,
  isPlaying,
  onRestartPlayback,
  onSetTempo,
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
      isPaused: !isPlaying && currentGameTimeMs > 0,
      isPlaying,
      onRestartPlayback,
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
    isPlaying,
    onRestartPlayback,
    onSetTempo,
    onTogglePlayback,
    progress,
    setPlaybackToolbarState,
    tempo,
  ]);

  useEffect(() => () => setPlaybackToolbarState(null), [setPlaybackToolbarState]);
};
