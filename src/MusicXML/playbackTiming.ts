import type { PlaybackEvent } from "./types";

export const MIN_MIDI_PLAYBACK_DURATION_MS = 10;
export const MIN_NOTATION_PLAYBACK_DURATION_MS = 80;

export const getEffectiveEventTempoBpm = (
  eventTempoBpm: number,
  tempoScale: number,
) => Math.max(20, eventTempoBpm * tempoScale);

export const getPlaybackEventDurationMs = (
  durationBeats: number,
  effectiveTempoBpm: number,
  durationSeconds?: number,
  tempoScale = 1,
) => durationSeconds === undefined
  ? Math.max(
      MIN_NOTATION_PLAYBACK_DURATION_MS,
      (60000 / effectiveTempoBpm) * durationBeats,
    )
  : Math.max(
      MIN_MIDI_PLAYBACK_DURATION_MS,
      (durationSeconds * 1000) / Math.max(0.01, tempoScale),
    );

export const getPlaybackEventTiming = (
  event: PlaybackEvent,
  tempoScale: number,
) => {
  const effectiveTempoBpm = getEffectiveEventTempoBpm(event.tempoBpm, tempoScale);
  return {
    durationMs: getPlaybackEventDurationMs(
      event.durationBeats,
      effectiveTempoBpm,
      event.durationSeconds,
      tempoScale,
    ),
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
