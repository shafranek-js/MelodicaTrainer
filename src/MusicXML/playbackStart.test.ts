import { describe, expect, it } from "vitest";
import { getPlaybackStartIndex } from "./playbackStart";
import type { PlaybackEvent } from "./types";

const event = (notes: PlaybackEvent["notes"] = []): PlaybackEvent => ({
  durationBeats: 1,
  tempoBpm: 120,
  notes,
  tabs: [],
  sourceEventIndex: 0,
});

describe("getPlaybackStartIndex", () => {
  it("starts from lead-in at time zero even if current index points to the first note", () => {
    expect(getPlaybackStartIndex({
      currentEventIndex: 1,
      currentGameTimeMs: 0,
      playbackEvents: [event(), event([{ 
        name: "C4",
        durationBeats: 1,
        velocity: 0.7,
        articulation: "normal",
        tieStart: false,
        tieStop: false,
        shouldPlay: true,
      }])],
    })).toBe(0);
  });

  it("resumes from current event after playback has advanced", () => {
    expect(getPlaybackStartIndex({
      currentEventIndex: 2,
      currentGameTimeMs: 1500,
      playbackEvents: [event(), event(), event()],
    })).toBe(2);
  });

  it("wraps to start after the end", () => {
    expect(getPlaybackStartIndex({
      currentEventIndex: 3,
      currentGameTimeMs: 1500,
      playbackEvents: [event(), event()],
    })).toBe(0);
  });
});
