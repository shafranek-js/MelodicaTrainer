import { describe, expect, it } from "vitest";
import {
  ACCOMPANIMENT_CHANNELS,
  alignAccompanimentLeadIn,
  buildAccompanimentSchedule,
  hasAccompanimentChannelOverflow,
  sanitizeAccompanimentVolume,
  transposePlaybackEvents,
  type AccompanimentTrack,
} from "./accompaniment";
import type { PlaybackEvent } from "./types";

const event = (
  name: string | null,
  durationBeats = 1,
  tempoBpm = 120,
): PlaybackEvent => ({
  durationBeats,
  notes: name ? [{
    articulation: "normal",
    durationBeats,
    name,
    shouldPlay: true,
    tieStart: false,
    tieStop: false,
    velocity: 0.8,
  }] : [],
  sourceEventIndex: 0,
  tabs: [],
  tempoBpm,
});

describe("accompaniment tracks", () => {
  it("adds the selected stream count-in to every background track", () => {
    const leadIn = event(null, 4);
    const primaryWithoutLeadIn = [event("C4")];
    const tracks: AccompanimentTrack[] = [{
      events: [event("C3")],
      id: "left",
      label: "Left hand",
    }];

    const aligned = alignAccompanimentLeadIn(
      [leadIn, ...primaryWithoutLeadIn],
      primaryWithoutLeadIn,
      tracks,
    );

    expect(aligned[0].events).toHaveLength(2);
    expect(aligned[0].events[0].notes).toEqual([]);
    expect(aligned[0].events[0].durationBeats).toBe(4);
  });

  it("transposes only the background audio note names", () => {
    const source = [event("C4")];
    expect(transposePlaybackEvents(source, 2)[0].notes[0].name).toBe("D4");
    expect(source[0].notes[0].name).toBe("C4");
  });

  it("builds a sorted score-time schedule on isolated channels", () => {
    const schedule = buildAccompanimentSchedule([
      { id: "left", label: "Left", events: [event(null), event("C3")] },
      { id: "strings", label: "Strings", events: [event("G3", 0.5)] },
    ]);

    expect(schedule.map(({ trackId, channel, startMs }) => ({
      channel,
      startMs,
      trackId,
    }))).toEqual([
      { channel: ACCOMPANIMENT_CHANNELS[1], startMs: 0, trackId: "strings" },
      { channel: ACCOMPANIMENT_CHANNELS[0], startMs: 500, trackId: "left" },
    ]);
  });

  it("reports channel overflow only above the available background channels", () => {
    expect(hasAccompanimentChannelOverflow(ACCOMPANIMENT_CHANNELS.length)).toBe(false);
    expect(hasAccompanimentChannelOverflow(ACCOMPANIMENT_CHANNELS.length + 1)).toBe(true);
  });

  it("sanitizes the persistent group volume", () => {
    expect(sanitizeAccompanimentVolume(-5)).toBe(0);
    expect(sanitizeAccompanimentVolume(10.4)).toBe(10);
    expect(sanitizeAccompanimentVolume(140)).toBe(100);
    expect(sanitizeAccompanimentVolume("10")).toBeUndefined();
  });
});
