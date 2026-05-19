import { describe, expect, it } from "vitest";
import { findStudyModeWaitTarget } from "./studyModeWaitTarget";
import type { PlaybackEvent, PlaybackTiming } from "./types";

const event = (shouldPlay: boolean): PlaybackEvent => ({
  durationBeats: 1,
  notes: [
    {
      articulation: "normal",
      durationBeats: 1,
      name: shouldPlay ? "C4" : "",
      shouldPlay,
      tieStart: false,
      tieStop: false,
      velocity: 0.7,
    },
  ],
  sourceEventIndex: 0,
  tabs: [],
  tempoBpm: 120,
});

const timing = (startMs: number): PlaybackTiming => ({
  durationMs: 500,
  endMs: startMs + 500,
  startMs,
});

describe("findStudyModeWaitTarget", () => {
  it("skips rests and waits on the first playable event reached by the playhead", () => {
    expect(
      findStudyModeWaitTarget(
        [event(false), event(true)],
        [timing(0), timing(500)],
        0,
        500,
      ),
    ).toBe(1);
  });

  it("does not wait before the next playable event starts", () => {
    expect(
      findStudyModeWaitTarget([event(true)], [timing(500)], 0, 499),
    ).toBeNull();
  });

  it("starts searching from the provided next index", () => {
    expect(
      findStudyModeWaitTarget(
        [event(true), event(true), event(true)],
        [timing(0), timing(500), timing(1_000)],
        2,
        1_000,
      ),
    ).toBe(2);
  });

  it("clears waiting when no playable target remains", () => {
    expect(
      findStudyModeWaitTarget(
        [event(false), event(false)],
        [timing(0), timing(500)],
        0,
        1_000,
      ),
    ).toBeNull();
  });
});
