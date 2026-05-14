import { describe, expect, it } from "vitest";
import {
    buildNoteHighwayRenderData,
    getBendDepth,
    getTargetWidthPct,
} from "./noteHighwayLayout";
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
    notes: tabs.map((_, index) => note(index === 0 ? "C4" : "E4")),
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
    playbackEvents: PlaybackEvent[],
    playbackTimeline: PlaybackTiming[],
    visualPlayheadMs = 0
) => buildNoteHighwayRenderData({
    clarity: "0.75",
    containerWidth: 1000,
    lastHitIndex: null,
    shortestNoteDurationMs: 500,
    visibleGameEvents,
    visualPlayheadMs,
    playbackEvents,
    playbackTimeline,
});

describe("noteHighwayLayout", () => {
    it("calculates target widths for natural, bend, deep bend, and overblow tabs", () => {
        expect(getBendDepth("-4")).toBe(0);
        expect(getBendDepth("-4'")).toBe(1);
        expect(getBendDepth("-4''")).toBe(2);
        expect(getBendDepth("-4'''")).toBe(3);

        expect(getTargetWidthPct("-4", 1000)).toBe(8.4);
        expect(getTargetWidthPct("-4'", 1000)).toBe(6.5);
        expect(getTargetWidthPct("-4''", 1000)).toBe(4.8);
        expect(getTargetWidthPct("-4'''", 2000)).toBe(3);
        expect(getTargetWidthPct("6o", 1000)).toBe(11);
    });

    it("maps valid tabs to lanes and active draw colors", () => {
        const currentEvent = event(["-4'"]);
        const currentTiming = timing(0, 500);

        const data = build(
            [{ event: currentEvent, index: 0, timing: currentTiming }],
            [currentEvent],
            [currentTiming]
        );

        expect(data).toHaveLength(1);
        expect(data[0]).toMatchObject({
            laneIndex: 3,
            bendDepth: 1,
            color: "#60a5fa",
            noteName: "C",
            isVisible: true,
        });
    });

    it("uses tied note duration when calculating block height", () => {
        const baseEvent = event(["4"], 1);
        const tiedEvent: PlaybackEvent = {
            ...baseEvent,
            notes: [note("C4", 2)],
        };
        const currentTiming = timing(0, 500);

        const baseData = build(
            [{ event: baseEvent, index: 0, timing: currentTiming }],
            [baseEvent],
            [currentTiming]
        );
        const tiedData = build(
            [{ event: tiedEvent, index: 0, timing: currentTiming }],
            [tiedEvent],
            [currentTiming]
        );

        expect(tiedData[0].htmlHeight).toBeGreaterThan(baseData[0].htmlHeight);
    });

    it("widens connected bend shapes to the previous tab width on the same hole", () => {
        const previousEvent = event(["-4"]);
        const currentEvent = event(["-4'"]);
        const previousTiming = timing(0, 500);
        const currentTiming = timing(500, 500);

        const data = build(
            [{ event: currentEvent, index: 1, timing: currentTiming }],
            [previousEvent, currentEvent],
            [previousTiming, currentTiming],
            500
        );

        expect(data).toHaveLength(1);
        expect(data[0].htmlWidth).toBe(getTargetWidthPct("-4", 1000));
    });
});
