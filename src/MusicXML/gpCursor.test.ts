import { describe, expect, it } from "vitest";
import {
  getGpEventIndexAtOriginalTick,
  getInterpolatedGpCursorTick,
} from "./gpCursor";
import type { PlaybackEvent } from "./types";

const makeEvent = (
  originalTick: number,
  notes: PlaybackEvent["notes"] = [
    {
      name: "C4",
      durationBeats: 1,
      velocity: 0.8,
      articulation: "normal",
      tieStart: false,
      tieStop: false,
      shouldPlay: true,
    },
  ]
): PlaybackEvent => ({
  durationBeats: 1,
  tempoBpm: 120,
  notes,
  tabs: [],
  sourceEventIndex: 0,
  originalTick,
});

const makeLeadInEvent = (): PlaybackEvent => ({
  durationBeats: 4,
  tempoBpm: 120,
  notes: [],
  tabs: [],
  sourceEventIndex: 0,
});

describe("GP cursor interpolation", () => {
  it("interpolates rest events toward the next increasing tick", () => {
    const rest = makeEvent(0, []);
    const firstNote = makeEvent(2880);

    expect(
      getInterpolatedGpCursorTick({
        event: rest,
        nextEvent: firstNote,
        elapsedMs: 900,
        durationMs: 1800,
      })
    ).toBe(1440);
  });

  it("interpolates playable events toward the next increasing tick", () => {
    expect(
      getInterpolatedGpCursorTick({
        event: makeEvent(2880),
        nextEvent: makeEvent(3840),
        elapsedMs: 250,
        durationMs: 500,
      })
    ).toBe(3360);
  });

  it("does not interpolate backwards across repeated sections", () => {
    expect(
      getInterpolatedGpCursorTick({
        event: makeEvent(5760),
        nextEvent: makeEvent(2880),
        elapsedMs: 250,
        durationMs: 500,
      })
    ).toBe(5760);
  });

  it("maps a small tick after the score start to the leading rest", () => {
    const events = [makeEvent(0, []), makeEvent(2880), makeEvent(3840)];

    expect(getGpEventIndexAtOriginalTick(events, 1)).toBe(0);
  });

  it("maps score-start tick to artificial lead-in before the first note", () => {
    const events = [makeLeadInEvent(), makeEvent(0), makeEvent(960)];

    expect(getGpEventIndexAtOriginalTick(events, 0)).toBe(0);
  });

  it("maps an exact note tick to that note event", () => {
    const events = [makeEvent(0, []), makeEvent(2880), makeEvent(3840)];

    expect(getGpEventIndexAtOriginalTick(events, 2880)).toBe(1);
  });
});
