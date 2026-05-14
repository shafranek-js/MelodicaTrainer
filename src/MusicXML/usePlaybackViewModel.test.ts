import { describe, expect, it } from "vitest";
import { getShortestPlayableNoteDurationMs } from "./usePlaybackViewModel";
import type { PlaybackEvent, PlaybackTiming } from "./types";

const event = (notesCount: number): PlaybackEvent => ({
  durationBeats: 1,
  notes: Array.from({ length: notesCount }, (_, index) => ({
    articulation: "normal",
    durationBeats: 1,
    name: index === 0 ? "C4" : "D4",
    shouldPlay: true,
    tieStart: false,
    tieStop: false,
    velocity: 80,
  })),
  sourceEventIndex: 0,
  tabs: notesCount > 0 ? ["4"] : [],
  tempoBpm: 120,
});

const timing = (durationMs: number): PlaybackTiming => ({
  durationMs,
  endMs: durationMs,
  startMs: 0,
});

describe("getShortestPlayableNoteDurationMs", () => {
  it("returns fallback when there are no playable note durations", () => {
    expect(getShortestPlayableNoteDurationMs([], [])).toBe(250);
    expect(getShortestPlayableNoteDurationMs([event(0)], [timing(500)])).toBe(
      250
    );
  });

  it("ignores rests and near-zero durations", () => {
    expect(
      getShortestPlayableNoteDurationMs(
        [event(0), event(1), event(1)],
        [timing(80), timing(5), timing(125)]
      )
    ).toBe(125);
  });

  it("returns the shortest playable note duration", () => {
    expect(
      getShortestPlayableNoteDurationMs(
        [event(1), event(1), event(1)],
        [timing(500), timing(240), timing(320)]
      )
    ).toBe(240);
  });
});
