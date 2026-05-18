import { describe, expect, it } from "vitest";
import {
  getAdvancedGameClockOffsetMs,
  getEffectiveEventTempoBpm,
  getLatencyAdjustedClockOffsetMs,
  getPlaybackEventDurationMs,
  getPlaybackEventTiming,
  getPlaybackTrailDelayMs,
} from "./playbackTiming";
import type { PlaybackEvent } from "./types";

const event: PlaybackEvent = {
  durationBeats: 2,
  notes: [],
  sourceEventIndex: 0,
  tabs: [],
  tempoBpm: 120,
};

describe("playback timing helpers", () => {
  it("scales event tempo and clamps the lower tempo bound", () => {
    expect(getEffectiveEventTempoBpm(120, 1.5)).toBe(180);
    expect(getEffectiveEventTempoBpm(30, 0.25)).toBe(20);
  });

  it("converts beats to milliseconds with the existing minimum duration", () => {
    expect(getPlaybackEventDurationMs(2, 120)).toBe(1000);
    expect(getPlaybackEventDurationMs(0.01, 240)).toBe(80);
  });

  it("returns both effective tempo and duration for an event", () => {
    expect(getPlaybackEventTiming(event, 0.5)).toEqual({
      durationMs: 2000,
      effectiveTempoBpm: 60,
    });
  });

  it("keeps the existing note-highway trail delay formula", () => {
    expect(getPlaybackTrailDelayMs(200, 1)).toBe(1300);
    expect(getPlaybackTrailDelayMs(200, 2)).toBe(650);
  });

  it("adjusts clock offset and advancement by tempo scale", () => {
    expect(getLatencyAdjustedClockOffsetMs(500, 20, 1.5)).toBe(470);
    expect(getAdvancedGameClockOffsetMs(100, 250, 50, 2)).toBe(500);
  });
});
