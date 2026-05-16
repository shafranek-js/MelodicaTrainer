import { describe, expect, it } from "vitest";
import { buildNoteHighwayRenderData } from "./noteHighwayLayout";
import type { PlaybackEvent, PlaybackTiming, VisibleGameEvent } from "./types";

const note = (name: string, durationBeats = 1) => ({
    name,
    durationBeats,
    velocity: 0.7,
    articulation: "normal" as const,
    tieStart: false,
    tieStop: false,
    shouldPlay: true,
});

const event = (tabs: string[], durationBeats = 1): PlaybackEvent => ({
    durationBeats,
    tempoBpm: 120,
    notes: tabs.map((tab, index) => note(tab || (index === 0 ? "C4" : "E4"))),
    tabs,
    sourceEventIndex: 0,
});

const timing = (startMs: number, durationMs: number): PlaybackTiming => ({
    startMs,
    durationMs,
    endMs: startMs + durationMs,
});

const build = (
    visibleGameEvents: VisibleGameEvent[],
    visualPlayheadMs = 0
) => buildNoteHighwayRenderData({
    clarity: "0.75",
    containerWidth: 1000,
    lastHitIndex: null,
    shortestNoteDurationMs: 500,
    visibleGameEvents,
    visualPlayheadMs,
});

describe("noteHighwayLayout", () => {
    it("maps melodica notes to keyboard lanes and active colors", () => {
        const currentEvent = event(["C4"]);
        const currentTiming = timing(0, 500);

        const data = build(
            [{ event: currentEvent, index: 0, timing: currentTiming }],
            50
        );

        expect(data).toHaveLength(1);
        expect(data[0]).toMatchObject({
            laneIndex: 7,
            color: "#ff6b6b",
            colorBody: "#e03131",
            noteName: "C",
            isVisible: true,
            sparkleSeed: expect.any(Number) as number,
            isBlack: false,
        });
    });

    it("uses tied note duration when calculating block height", () => {
        const baseEvent = event(["C4"], 1);
        const tiedEvent: PlaybackEvent = {
            ...baseEvent,
            notes: [note("C4", 2)],
        };
        const currentTiming = timing(0, 500);

        const baseData = build(
            [{ event: baseEvent, index: 0, timing: currentTiming }]
        );
        const tiedData = build(
            [{ event: tiedEvent, index: 0, timing: currentTiming }]
        );

        expect(tiedData[0].htmlHeight).toBeGreaterThan(baseData[0].htmlHeight);
    });

    it("keeps connected notes on the same melodica key aligned", () => {
        const currentEvent = event(["C4"]);
        const currentTiming = timing(500, 500);

        const data = build(
            [{ event: currentEvent, index: 1, timing: currentTiming }],
            500
        );

        expect(data).toHaveLength(1);
        expect(data[0].laneIndex).toBe(7);
    });

    it("marks notes as sounding while the playhead is inside their duration", () => {
        const currentEvent = event(["C4"]);
        const currentTiming = timing(0, 500);

        const data = build(
            [{ event: currentEvent, index: 0, timing: currentTiming }],
            250
        );

        expect(data[0].isSounding).toBe(true);
    });
});
