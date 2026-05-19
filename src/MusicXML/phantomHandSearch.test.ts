import { describe, expect, it } from "vitest";
import {
  buildPhantomHandSearchIndex,
  createFingerLookup,
  findPhantomHandMatch,
} from "./phantomHandSearch";
import type { FingerAssignment } from "./fingerAssigner";
import type { PlaybackEvent, PlaybackTiming } from "./types";

const makeEvent = (
  noteName: string,
  durationBeats = 1,
  noteDurationBeats = durationBeats,
): PlaybackEvent => ({
  durationBeats,
  notes: [
    {
      articulation: "normal",
      durationBeats: noteDurationBeats,
      name: noteName,
      shouldPlay: true,
      tieStart: false,
      tieStop: false,
      velocity: 0.7,
    },
  ],
  sourceEventIndex: 0,
  tabs: [],
  tempoBpm: 120,
});

const makeTiming = (
  startMs: number,
  durationMs: number,
): PlaybackTiming => ({
  durationMs,
  endMs: startMs + durationMs,
  startMs,
});

const buildIndex = (
  events: PlaybackEvent[],
  timeline: PlaybackTiming[],
  assignments: FingerAssignment[] = [{ eventIndex: 0, noteIndex: 0, finger: 1 }],
) => buildPhantomHandSearchIndex(events, timeline, createFingerLookup(assignments));

describe("phantom hand search", () => {
  it("returns null for an empty timeline", () => {
    expect(findPhantomHandMatch(buildIndex([], [], []), 100)).toBeNull();
  });

  it("finds an ongoing assigned note as pressing", () => {
    const index = buildIndex([makeEvent("C4")], [makeTiming(0, 1_000)]);

    expect(findPhantomHandMatch(index, 500)).toEqual({ eventIndex: 0, state: "pressing" });
  });

  it("finds the first upcoming assigned note inside the prepare window", () => {
    const index = buildIndex([makeEvent("C4")], [makeTiming(2_000, 500)]);

    expect(findPhantomHandMatch(index, 1_400)).toEqual({ eventIndex: 0, state: "prepare" });
    expect(findPhantomHandMatch(index, 1_300)).toBeNull();
  });

  it("keeps a long sustained note pressing after its event timing ends", () => {
    const events = [
      makeEvent("C4", 1, 3),
      makeEvent("D4"),
      makeEvent("E4"),
    ];
    const timeline = [
      makeTiming(0, 100),
      makeTiming(100, 100),
      makeTiming(200, 100),
    ];
    const assignments = [
      { eventIndex: 0, noteIndex: 0, finger: 1 },
      { eventIndex: 1, noteIndex: 0, finger: 2 },
      { eventIndex: 2, noteIndex: 0, finger: 3 },
    ];

    expect(findPhantomHandMatch(buildIndex(events, timeline, assignments), 250)).toEqual({
      eventIndex: 0,
      state: "pressing",
    });
  });

  it("moves to a later active note after earlier notes have ended", () => {
    const events = [makeEvent("C4"), makeEvent("D4")];
    const timeline = [makeTiming(0, 100), makeTiming(200, 100)];
    const assignments = [
      { eventIndex: 0, noteIndex: 0, finger: 1 },
      { eventIndex: 1, noteIndex: 0, finger: 2 },
    ];

    expect(findPhantomHandMatch(buildIndex(events, timeline, assignments), 250)).toEqual({
      eventIndex: 1,
      state: "pressing",
    });
  });
});
