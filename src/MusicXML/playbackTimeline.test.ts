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

  it("deduplicates and sorts lane keys from melodica notes", () => {
    expect(
      getLaneKeys([
        makeEvent(1, 120, ["C4"], "C4"),
        makeEvent(1, 120, ["A4"], "A4"),
        makeEvent(1, 120, ["C4"], "C4"),
      ])
    ).toEqual([8, 17]);
  });

  it("uses exact MIDI seconds without changing beat-based events", () => {
    const midiEvent = {
      ...makeEvent(9, 240),
      durationSeconds: 0.25,
      notes: [{ ...makeEvent(9, 240).notes[0], durationSeconds: 0.5 }],
    };

    expect(createPlaybackTimeline([midiEvent], 1)).toEqual([
      { startMs: 0, durationMs: 250, endMs: 250 },
    ]);
    expect(createPlaybackTimeline([midiEvent], 2)).toEqual([
      { startMs: 0, durationMs: 125, endMs: 125 },
    ]);
  });

  it("keeps an overlapping MIDI note visible until its own duration ends", () => {
    const midiEvent = {
      ...makeEvent(0.1, 120),
      durationSeconds: 0.1,
      notes: [{ ...makeEvent(0.1, 120).notes[0], durationSeconds: 5 }],
    };
    const timeline = createPlaybackTimeline([midiEvent], 1);

    expect(getVisibleGameEvents([midiEvent], timeline, 3000, 250)).toHaveLength(1);
    expect(getVisibleGameEvents([midiEvent], timeline, 7000, 250)).toHaveLength(0);
  });

  it("selects only the closest playable event inside the hit window", () => {
    const events = [makeEvent(1, 120), makeEvent(1, 120), makeEvent(1, 120)];
    const timeline = createPlaybackTimeline(events, 1);
    const visibleEvents = getVisibleGameEvents(events, timeline, 495);

    expect(getTargetEventIndex(visibleEvents, 495)).toBe(1);
    expect(getTargetEventIndex(visibleEvents, 300)).toBe(1);
    expect(getTargetEventIndex(visibleEvents, 299)).toBeNull();
  });
});
