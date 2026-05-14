import { describe, expect, it } from "vitest";
import { addLeadInIfNeeded } from "./playbackLeadIn";
import type { PlaybackEvent } from "./types";

const makeEvent = (durationBeats: number, notes: PlaybackEvent["notes"] = []): PlaybackEvent => ({
  durationBeats,
  tempoBpm: 120,
  notes,
  tabs: [],
  sourceEventIndex: 0,
});

const makeNote = (): PlaybackEvent["notes"][number] => ({
  name: "C4",
  durationBeats: 1,
  velocity: 0.8,
  articulation: "normal",
  tieStart: false,
  tieStop: false,
  shouldPlay: true,
});

describe("addLeadInIfNeeded", () => {
  it("adds a full lead-in when the score starts with a note", () => {
    const events = [makeEvent(1, [makeNote()])];

    const result = addLeadInIfNeeded(events, 4);

    expect(result[0]).toMatchObject({ durationBeats: 4, notes: [] });
    expect(result[1]).toBe(events[0]);
  });

  it("tops up split initial rests to the requested lead-in duration", () => {
    const events = [makeEvent(1), makeEvent(1), makeEvent(1, [makeNote()])];

    const result = addLeadInIfNeeded(events, 4);

    expect(result[0]).toMatchObject({ durationBeats: 2, notes: [] });
    expect(result[1]).toBe(events[0]);
  });

  it("does not add lead-in when split initial rests already cover it", () => {
    const events = [makeEvent(2), makeEvent(2), makeEvent(1, [makeNote()])];

    expect(addLeadInIfNeeded(events, 4)).toBe(events);
  });
});
