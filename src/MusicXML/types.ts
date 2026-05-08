export type PlaybackNote = {
  name: string;
  durationBeats: number;
  velocity: number;
  articulation: "normal" | "staccato" | "tenuto" | "accent";
  tieStart: boolean;
  tieStop: boolean;
  shouldPlay: boolean;
};

export type PlaybackEvent = {
  durationBeats: number;
  tempoBpm: number;
  notes: PlaybackNote[];
  tabs: string[];
};

export type GameStats = {
  hits: number;
  misses: number;
  streak: number;
};

export type PlaybackTiming = {
  startMs: number;
  durationMs: number;
  endMs: number;
};

export type VisibleGameEvent = {
  event: PlaybackEvent;
  index: number;
  timing: PlaybackTiming;
};
