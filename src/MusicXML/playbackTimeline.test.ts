import { describe, expect, it } from "vitest";
import {
  createPlaybackTimeline,
  getLaneKeys,
  getTargetEventIndex,
  getVisibleGameEvents,
} from "./playbackTimeline";
import type { PlaybackEvent } from "./types";

const makeEvent = (
  durationBeats: number,
  tempoBpm: number,
  tabs: string[] = [],
  noteName = "C4"
): PlaybackEvent => ({
  durationBeats,
  tempoBpm,
  tabs,
  sourceEventIndex: 0,
  notes: [
    {
      name: noteName,
      durationBeats,
      velocity: 0.68,
      articulation: "normal",
      tieStart: false,
      tieStop: false,
      shouldPlay: true,
    },
  ],
});

describe("playback timeline helpers", () => {
  it("creates cumulative playback timings using each event tempo", () => {
    const timeline = createPlaybackTimeline(
      [makeEvent(1, 120), makeEvent(2, 60)],
      1
    );

    expect(timeline).toEqual([
      { startMs: 0, durationMs: 500, endMs: 500 },
      { startMs: 500, durationMs: 2000, endMs: 2500 },
    ]);
  });

  it("deduplicates and sorts lane holes from tabs", () => {
    expect(
      getLaneKeys([
        makeEvent(1, 120, ["-4", "6o"]),
        makeEvent(1, 120, ["3'", "-4"]),
      ])
    ).toEqual([3, 4, 6]);
  });

  it("selects only the closest playable event inside the hit window", () => {
    const events = [makeEvent(1, 120), makeEvent(1, 120), makeEvent(1, 120)];
    const timeline = createPlaybackTimeline(events, 1);
    const visibleEvents = getVisibleGameEvents(events, timeline, 495);

    expect(getTargetEventIndex(visibleEvents, 495)).toBe(1);
    expect(getTargetEventIndex(visibleEvents, 300)).toBeNull();
  });
});
