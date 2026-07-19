import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { useNoteHighwayScoring } from "./useNoteHighwayScoring";
import type { ScoringDetectedNote } from "./noteHighwayScoring";
import type { PlaybackEvent, PlaybackTiming } from "./types";

const makePlaybackNote = (name: string) => ({
  articulation: "normal" as const,
  durationBeats: 1,
  name,
  shouldPlay: true,
  tieStart: false,
  tieStop: false,
  velocity: 0.7,
});

const playbackEvents: PlaybackEvent[] = [0, 1].map((sourceEventIndex) => ({
  durationBeats: 1,
  notes: sourceEventIndex === 0
    ? [makePlaybackNote("C4")]
    : [makePlaybackNote("C4"), makePlaybackNote("E4")],
  sourceEventIndex,
  tabs: ["1"],
  tempoBpm: 120,
}));

const playbackTimeline: PlaybackTiming[] = [0, 500].map((startMs) => ({
  durationMs: 500,
  endMs: startMs + 500,
  startMs,
}));

let latestHits = 0;

const TestComponent = ({
  detectedNotes,
  targetEventIndex,
}: {
  detectedNotes: readonly ScoringDetectedNote[];
  targetEventIndex: number;
}) => {
  const { gameStats } = useNoteHighwayScoring({
    currentGameEvent: playbackEvents[targetEventIndex],
    currentGameTimeMs: 0,
    detectedNotes,
    playbackEvents,
    playbackTimeline,
    targetEventIndex,
  });
  latestHits = gameStats.hits;
  return null;
};

const render = async (
  root: Root,
  detectedNotes: readonly ScoringDetectedNote[],
  targetEventIndex: number,
) => {
  await act(async () => {
    root.render(createElement(TestComponent, { detectedNotes, targetEventIndex }));
  });
};

describe("useNoteHighwayScoring", () => {
  it("requires a repeated pitch to be released before scoring the next event", async () => {
    const root = createRoot(document.createElement("div"));
    const c4 = [{ cents: 0, note: "C4" }];

    await render(root, c4, 0);
    expect(latestHits).toBe(1);
    await render(root, c4, 1);
    expect(latestHits).toBe(1);

    await render(root, [], 1);
    await render(root, c4, 1);
    expect(latestHits).toBe(2);
    act(() => root.unmount());
  });

  it("scores a newly pressed chord tone while another matching tone stays held", async () => {
    const root = createRoot(document.createElement("div"));
    const c4 = { cents: 0, note: "C4" };

    await render(root, [c4], 0);
    expect(latestHits).toBe(1);
    await render(root, [c4, { cents: 0, note: "E4" }], 1);
    expect(latestHits).toBe(2);
    act(() => root.unmount());
  });
});
