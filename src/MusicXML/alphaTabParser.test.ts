import { describe, expect, it } from "vitest";
import type * as alphaTab from "@coderline/alphatab";
import { buildAlphaTabPlaybackSelection, parseAlphaTabScore } from "./alphaTabParser";

type TestBeat = {
    playbackStart: number;
    playbackDuration: number;
    isRest?: boolean;
    notes?: Array<{
        realValue: number;
        isTieOrigin?: boolean;
        isTieDestination?: boolean;
    }>;
};

type TestMasterBar = {
    start: number;
    timeSignatureNumerator: number;
    timeSignatureDenominator: number;
    isRepeatStart: boolean;
    repeatCount: number;
    tempoAutomations: Array<{
        value: number;
        ratioPosition: number;
    }>;
};

const masterBar = (start: number, overrides: Partial<TestMasterBar> = {}): TestMasterBar => ({
    start,
    timeSignatureNumerator: 4,
    timeSignatureDenominator: 4,
    isRepeatStart: false,
    repeatCount: 0,
    tempoAutomations: [],
    ...overrides,
});

const makeScore = (
    bars: Array<{ voices: Array<{ beats: TestBeat[] }> }>,
    masterBars: TestMasterBar[],
    tempo = 90
) => ({
    tempo,
    midiTickResolution: 960,
    masterBars,
    tracks: [
        {
            name: "Test Track",
            staves: [{ bars }],
        },
    ],
}) as unknown as alphaTab.model.Score;

describe("parseAlphaTabScore", () => {
    it("builds hidden GP tracks without duplicating the selected track", () => {
        const bars = [{
            voices: [{
                beats: [{ playbackStart: 0, playbackDuration: 480, notes: [{ realValue: 60 }] }],
            }],
        }];
        const score = {
            tempo: 120,
            midiTickResolution: 960,
            masterBars: [masterBar(0)],
            tracks: [
                { name: "Lead", staves: [{ bars }] },
                { name: "Bass", staves: [{ bars: [{ voices: [{ beats: [{ playbackStart: 0, playbackDuration: 480, notes: [{ realValue: 48 }] }] }] }] }] },
            ],
        } as unknown as alphaTab.model.Score;

        const result = buildAlphaTabPlaybackSelection(score, "C", 0, 0);

        expect(result.events.flatMap((event) => event.notes.map((note) => note.name))).toEqual(["C4"]);
        expect(result.accompanimentTracks.map((track) => track.label)).toEqual(["Bass"]);
        expect(result.accompanimentTracks[0].events[0].notes).toEqual([]);
        expect(result.accompanimentTracks[0].events.flatMap((event) =>
            event.notes.map((note) => note.name),
        )).toEqual(["C3"]);
    });

    it("uses score tempo and applies tempo automations to later beats", () => {
        const score = makeScore(
            [
                {
                    voices: [
                        {
                            beats: [
                                { playbackStart: 0, playbackDuration: 480, notes: [{ realValue: 60 }] },
                                { playbackStart: 480, playbackDuration: 480, notes: [{ realValue: 62 }] },
                            ],
                        },
                    ],
                },
            ],
            [
                masterBar(0, {
                    timeSignatureNumerator: 1,
                    tempoAutomations: [{ value: 120, ratioPosition: 0.5 }],
                }),
            ],
            200
        );

        const result = parseAlphaTabScore(score, "C", 0, 0, { addLeadIn: false });

        expect(result.tempo).toBe(200);
        expect(result.events.map((event) => event.tempoBpm)).toEqual([200, 120]);
        expect(result.events.map((event) => event.notes[0]?.name)).toEqual(["C4", "D4"]);
    });

    it("keeps an initial rest as the first playback event", () => {
        const score = makeScore(
            [
                {
                    voices: [
                        {
                            beats: [
                                { playbackStart: 0, playbackDuration: 960, isRest: true },
                                { playbackStart: 960, playbackDuration: 480, notes: [{ realValue: 64 }] },
                            ],
                        },
                    ],
                },
            ],
            [masterBar(0)],
            100
        );

        const result = parseAlphaTabScore(score, "C", 0, 0, { addLeadIn: false });

        expect(result.events[0]).toMatchObject({
            durationBeats: 1,
            notes: [],
            tick: 0,
        });
        expect(result.events[1]).toMatchObject({
            durationBeats: 0.5,
            tick: 960,
        });
        expect(result.events[1].notes[0]?.name).toBe("E4");
    });

    it("extends tie starts and disables repeated tie-stop playback", () => {
        const score = makeScore(
            [
                {
                    voices: [
                        {
                            beats: [
                                {
                                    playbackStart: 0,
                                    playbackDuration: 480,
                                    notes: [{ realValue: 67, isTieOrigin: true }],
                                },
                                {
                                    playbackStart: 480,
                                    playbackDuration: 480,
                                    notes: [{ realValue: 67, isTieDestination: true }],
                                },
                            ],
                        },
                    ],
                },
            ],
            [masterBar(0)],
            90
        );

        const result = parseAlphaTabScore(score, "C", 0, 0, { addLeadIn: false });

        expect(result.events[0].notes[0]).toMatchObject({
            name: "G4",
            durationBeats: 1,
            shouldPlay: true,
        });
        expect(result.events[1].notes[0]).toMatchObject({
            name: "G4",
            durationBeats: 0.5,
            shouldPlay: false,
        });
    });

    it("reads only the primary voice to avoid duplicate secondary-voice GP material", () => {
        const score = makeScore(
            [
                {
                    voices: [
                        {
                            beats: [
                                { playbackStart: 0, playbackDuration: 480, notes: [{ realValue: 60 }] },
                            ],
                        },
                        {
                            beats: [
                                { playbackStart: 0, playbackDuration: 480, notes: [{ realValue: 76 }] },
                            ],
                        },
                    ],
                },
            ],
            [masterBar(0)],
            90
        );

        const result = parseAlphaTabScore(score, "C", 0, 0, { addLeadIn: false });

        expect(result.events).toHaveLength(1);
        expect(result.events[0].notes.map((note) => note.name)).toEqual(["C4"]);
    });

    it("adds a one-measure lead-in when a GP score starts with a note", () => {
        const score = makeScore(
            [
                {
                    voices: [
                        {
                            beats: [
                                { playbackStart: 0, playbackDuration: 480, notes: [{ realValue: 60 }] },
                            ],
                        },
                    ],
                },
            ],
            [masterBar(0, { timeSignatureNumerator: 3, timeSignatureDenominator: 4 })],
            90
        );

        const result = parseAlphaTabScore(score, "C");

        expect(result.events[0]).toMatchObject({
            durationBeats: 3,
            notes: [],
            tabs: [],
        });
        expect(result.events[1].notes[0]?.name).toBe("C4");
    });

    it("tops up a short initial GP rest to one measure of preparation", () => {
        const score = makeScore(
            [
                {
                    voices: [
                        {
                            beats: [
                                { playbackStart: 0, playbackDuration: 960, isRest: true },
                                { playbackStart: 960, playbackDuration: 480, notes: [{ realValue: 62 }] },
                            ],
                        },
                    ],
                },
            ],
            [masterBar(0)],
            90
        );

        const result = parseAlphaTabScore(score, "C");

        expect(result.events[0]).toMatchObject({
            durationBeats: 3,
            notes: [],
        });
        expect(result.events[1]).toMatchObject({
            durationBeats: 1,
            notes: [],
        });
        expect(result.events[2].notes[0]?.name).toBe("D4");
    });

    it("does not add a lead-in when a GP score already starts with a full-measure rest", () => {
        const score = makeScore(
            [
                {
                    voices: [
                        {
                            beats: [
                                { playbackStart: 0, playbackDuration: 3840, isRest: true },
                                { playbackStart: 3840, playbackDuration: 480, notes: [{ realValue: 62 }] },
                            ],
                        },
                    ],
                },
            ],
            [masterBar(0)],
            90
        );

        const result = parseAlphaTabScore(score, "C");

        expect(result.events[0]).toMatchObject({
            durationBeats: 4,
            notes: [],
        });
        expect(result.events[1].notes[0]?.name).toBe("D4");
    });
});
