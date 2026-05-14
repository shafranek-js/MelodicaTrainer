import { createContext, useContext } from "react";

type GameStats = {
  hits: number;
  misses: number;
  streak: number;
};

export type PlaybackToolbarState = {
  isPlaying?: boolean;
  isPaused?: boolean;
  onTogglePlayback?: () => void;
  onRestartPlayback?: () => void;
  tempo?: number;
  setTempo?: (tempo: number) => void;
  progress?: number;
  gameStats?: GameStats;
  accuracy?: number;
  canPlayback?: boolean;
};

export type PlaybackToolbarContextValue = {
  state: PlaybackToolbarState | null;
  setState: (state: PlaybackToolbarState | null) => void;
};

export const PlaybackToolbarContext = createContext<PlaybackToolbarContextValue | null>(null);

const usePlaybackToolbarContext = () => {
  const context = useContext(PlaybackToolbarContext);
  if (!context) {
    throw new Error("Playback toolbar context is missing.");
  }
  return context;
};

export const usePlaybackToolbarState = () => usePlaybackToolbarContext().state;

export const useSetPlaybackToolbarState = () => usePlaybackToolbarContext().setState;
