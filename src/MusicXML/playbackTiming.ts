import type { PlaybackEvent } from "./types";

export const getEffectiveEventTempoBpm = (
  eventTempoBpm: number,
  tempoScale: number,
) => Math.max(20, eventTempoBpm * tempoScale);

export const getPlaybackEventDurationMs = (
  durationBeats: number,
  effectiveTempoBpm: number,
) => Math.max(80, (60000 / effectiveTempoBpm) * durationBeats);

export const getPlaybackEventTiming = (
  event: PlaybackEvent,
  tempoScale: number,
) => {
  const effectiveTempoBpm = getEffectiveEventTempoBpm(event.tempoBpm, tempoScale);
  return {
    durationMs: getPlaybackEventDurationMs(event.durationBeats, effectiveTempoBpm),
    effectiveTempoBpm,
  };
};

export const getPlaybackTrailDelayMs = (
  shortestNoteDurationMs: number,
  tempoScale: number,
) => {
  const msPerPx = shortestNoteDurationMs / 40;
  const trailMs = 520 * msPerPx * 0.5;
  return trailMs / tempoScale;
};

export const getLatencyAdjustedClockOffsetMs = (
  timelineStartMs: number,
  audioOutputLatencyMs: number,
  tempoScale: number,
) => timelineStartMs - audioOutputLatencyMs * tempoScale;

export const getAdvancedGameClockOffsetMs = (
  clockOffsetMs: number,
  nowMs: number,
  clockStartMs: number,
  tempoScale: number,
) => clockOffsetMs + (nowMs - clockStartMs) * tempoScale;
