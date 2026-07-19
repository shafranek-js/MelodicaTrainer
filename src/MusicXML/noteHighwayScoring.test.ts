import { describe, expect, it } from "vitest";
import {
    getMissedEventIndexes,
    getTargetMidiNumbers,
    isDetectedPitchHit,
} from "./noteHighwayScoring";
import type { PlaybackEvent, PlaybackNote, PlaybackTiming } from "./types";

const note = (name: string, shouldPlay = true): PlaybackNote => ({
    name,
    durationBeats: 1,
    velocity: 0.7,
    articulation: "normal",
    tieStart: false,
    tieStop: false,
    shouldPlay,
});

const event = (notes: PlaybackNote[]): PlaybackEvent => ({
    durationBeats: 1,
    tempoBpm: 120,
    notes,
    tabs: notes.map((_, index) => String(index + 1)),
    sourceEventIndex: 0,
});

const timing = (startMs: number, durationMs: number): PlaybackTiming => ({
    startMs,
    durationMs,
    endMs: startMs + durationMs,
});

describe("noteHighwayScoring", () => {
    it("matches any playable note in a chord within cents tolerance", () => {
        const chord = event([note("C4"), note("E4"), note("G4")]);

        expect(isDetectedPitchHit({
            currentGameEvent: chord,
            detectedNotes: [{ note: "B4", cents: 0 }, { note: "E4", cents: 12 }],
            targetEventIndex: 0,
        })).toBe(true);
        expect(isDetectedPitchHit({
            currentGameEvent: chord,
            detectedNotes: [{ note: "E4", cents: 60 }],
            targetEventIndex: 0,
        })).toBe(false);
    });

    it("ignores tie-stop notes that should not be played", () => {
        const tieStopOnly = event([note("C4", false)]);

        expect(getTargetMidiNumbers(tieStopOnly).size).toBe(0);
        expect(isDetectedPitchHit({
            currentGameEvent: tieStopOnly,
            detectedNotes: [{ note: "C4", cents: 0 }],
            targetEventIndex: 0,
        })).toBe(false);
    });

    it("counts misses for playable notes after the hit window", () => {
        const events = [event([note("C4")]), event([note("D4")])];
        const timeline = [timing(0, 500), timing(500, 0)];

        expect(getMissedEventIndexes({
            currentGameTimeMs: 1000,
            playbackEvents: events,
            playbackTimeline: timeline,
            scoredEventIndexes: new Set([0]),
        })).toEqual([1]);
    });

    it("does not count rests or non-playable repeated tie stops as misses", () => {
        const events = [
            event([]),
            event([note("G4", false)]),
            event([note("A4")]),
        ];
        const timeline = [timing(0, 250), timing(250, 250), timing(500, 250)];

        expect(getMissedEventIndexes({
            currentGameTimeMs: 1000,
            playbackEvents: events,
            playbackTimeline: timeline,
            scoredEventIndexes: new Set(),
        })).toEqual([2]);
    });
});
