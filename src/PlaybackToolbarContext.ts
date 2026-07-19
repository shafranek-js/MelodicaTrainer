import { createContext, useContext } from "react";
import type { RecordingState } from "./MusicXML/useMidiRecording";

type GameStats = {
  hits: number;
  misses: number;
  streak: number;
};

export type PlaybackToolbarState = {
  isLooping?: boolean;
  isPlaying?: boolean;
  isPaused?: boolean;
  onToggleLoop?: () => void;
  onTogglePlayback?: () => void;
  onRestartPlayback?: () => void;
  tempo?: number;
  setTempo?: (tempo: number) => void;
  progress?: number;
  gameStats?: GameStats;
  accuracy?: number;
  canPlayback?: boolean;
  onToggleRecording?: () => void;
  recordingDurationMs?: number;
  recordingError?: string | null;
  recordingState?: RecordingState;
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
