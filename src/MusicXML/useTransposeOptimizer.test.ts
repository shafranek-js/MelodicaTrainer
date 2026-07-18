import { describe, expect, it } from "vitest";
import { getBestScoreTransposeIntervals } from "./useTransposeOptimizer";
import type { PlaybackEvent } from "./types";

const event = (...names: string[]): PlaybackEvent => ({
  durationBeats: 1,
  notes: names.map((name) => ({
    articulation: "normal",
    durationBeats: 1,
    name,
    shouldPlay: true,
    tieStart: false,
    tieStop: false,
    velocity: 90,
  })),
  sourceEventIndex: 0,
  tabs: [],
  tempoBpm: 120,
});

describe("getBestScoreTransposeIntervals", () => {
  it("uses the selected MusicXML staff events rather than the whole score", () => {
    const intervals = getBestScoreTransposeIntervals({
      keyCount: 32,
      originalMidiNumbers: [],
      playbackEvents: [event("E2", "E3", "G3", "E4")],
      scoreFormat: "musicxml",
      transpose: 0,
    });

    expect(intervals[0]).toBe(13);
    expect(intervals).not.toContain(0);
  });

  it("removes the current transpose before finding the next MusicXML variant", () => {
    const intervals = getBestScoreTransposeIntervals({
      keyCount: 32,
      originalMidiNumbers: [],
      playbackEvents: [event("F3", "F4", "A4", "F5")],
      scoreFormat: "musicxml",
      transpose: 13,
    });

    expect(intervals[0]).toBe(13);
  });
});
