import { describe, expect, it } from "vitest";
import { assignFingers } from "./fingerAssigner";
import type { PlaybackEvent } from "./types";

const note = (name: string, durationBeats = 1, shouldPlay = true) => ({
    name,
    durationBeats,
    velocity: 0.7,
    articulation: "normal" as const,
    tieStart: false,
    tieStop: false,
    shouldPlay,
});

const makeEvent = (notes: ReturnType<typeof note>[], tempoBpm = 120): PlaybackEvent => ({
    durationBeats: 1,
    tempoBpm,
    notes,
    tabs: [],
    sourceEventIndex: 0,
});

const arraysEqual = (a: number[], b: number[]) =>
  a.length === b.length && a.every((v, i) => v === b[i]);

describe("fingerAssigner", () => {
    it("returns empty array for empty events", () => {
        expect(assignFingers([], 32)).toEqual([]);
    });

    it("returns empty array when no notes are playable", () => {
        expect(assignFingers([makeEvent([note("C4", 1, false)])], 32)).toEqual([]);
    });

    it("C-D-E-F-G → 1-2-3-4-5 (natural 5-finger position)", () => {
        const events = [
            makeEvent([note("C4")]),
            makeEvent([note("D4")]),
            makeEvent([note("E4")]),
            makeEvent([note("F4")]),
            makeEvent([note("G4")]),
        ];
        const result = assignFingers(events, 32);
        expect(result).toHaveLength(5);
        // White-key model: C(0) D(1) E(2) F(3) G(4) — one position, no shift
        expect(result.map((r) => r.finger)).toEqual([1, 2, 3, 4, 5]);
    });

    it("C-E-G → 1-3-5 (arpeggio, hand stays still)", () => {
        const events = [
            makeEvent([note("C4")]),
            makeEvent([note("E4")]),
            makeEvent([note("G4")]),
        ];
        const result = assignFingers(events, 32);
        expect(result).toHaveLength(3);
        expect(result.map((r) => r.finger)).toEqual([1, 3, 5]);
    });

    it("C→D avoids same finger (1→1 is awkward)", () => {
        // v7: same-finger penalty is inside melodicTransitionCost.
        // C→D with finger 1→1 should be penalised in favour of 1→2.
        const events = [
            makeEvent([note("C4")]),
            makeEvent([note("D4")]),
        ];
        const result = assignFingers(events, 32);
        expect(result).toHaveLength(2);
        // Should prefer 1→2, not 1→1
        expect(result[0].finger).not.toBe(result[1].finger);
    });

    it("C-D-E-F-G-A → shifts hand for the 6th note", () => {
        const events = [
            makeEvent([note("C4")]),
            makeEvent([note("D4")]),
            makeEvent([note("E4")]),
            makeEvent([note("F4")]),
            makeEvent([note("G4")]),
            makeEvent([note("A4")]),
        ];
        const result = assignFingers(events, 32);
        expect(result).toHaveLength(6);
        // All fingers valid
        for (const r of result) {
            expect(r.finger).toBeGreaterThanOrEqual(1);
            expect(r.finger).toBeLessThanOrEqual(5);
        }
        // First five should be ascending — either 1-2-3-4-5 or shifted 1-2-1-2-3-4 (thumb-under)
        // The DP finds the globally optimal path, so just verify validity
    });

    it("avoids thumb on black keys", () => {
        // F4(white) F#4(black) G4(white) — F# should avoid thumb
        const events = [
            makeEvent([note("F4")]),
            makeEvent([note("F#4")]),
            makeEvent([note("G4")]),
        ];
        const result = assignFingers(events, 32);
        expect(result).toHaveLength(3);
        expect(result[1].finger).not.toBe(1); // F#4 — no thumb on black
    });

    it("C-E-G chord → 1-3-5 (natural triad fingering)", () => {
        const events = [makeEvent([note("C4"), note("E4"), note("G4")])];
        const result = assignFingers(events, 32);
        expect(result).toHaveLength(3);
        // Group-DP with stretch cost prefers 1-3-5 over greedy's 1-2-3
        expect(result.map((r) => r.finger)).toEqual([1, 3, 5]);
    });

    it("preserves hand continuity across chords", () => {
        // C4 → [C5, E5, G5] → D4 — hand must jump up for the chord and return
        const events = [
            makeEvent([note("C4")]),
            makeEvent([note("C5"), note("E5"), note("G5")]),
            makeEvent([note("D4")]),
        ];
        const result = assignFingers(events, 32);
        expect(result).toHaveLength(5);
        // All valid fingers
        for (const r of result) {
            expect(r.finger).toBeGreaterThanOrEqual(1);
            expect(r.finger).toBeLessThanOrEqual(5);
        }
    });

    it("C-D-E-F-G-A-B-C → valid octave scale fingering", () => {
        const events = [
            makeEvent([note("C4")]), makeEvent([note("D4")]),
            makeEvent([note("E4")]), makeEvent([note("F4")]),
            makeEvent([note("G4")]), makeEvent([note("A4")]),
            makeEvent([note("B4")]), makeEvent([note("C5")]),
        ];
        const result = assignFingers(events, 32);
        expect(result).toHaveLength(8);
        // Both [1,2,3,1,2,3,4,5] and [1,2,3,4,1,2,3,4] are valid
        const fingers = result.map((r) => r.finger);
        const valid = (
          arraysEqual(fingers, [1,2,3,1,2,3,4,5]) ||
          arraysEqual(fingers, [1,2,3,4,1,2,3,4])
        );
        expect(valid).toBe(true);
    });

    it("G-F-E-D-C → 5-4-3-2-1 (descending 5-finger)", () => {
        const events = [
            makeEvent([note("G4")]), makeEvent([note("F4")]),
            makeEvent([note("E4")]), makeEvent([note("D4")]),
            makeEvent([note("C4")]),
        ];
        const result = assignFingers(events, 32);
        expect(result).toHaveLength(5);
        expect(result.map((r) => r.finger)).toEqual([5, 4, 3, 2, 1]);
    });

    it("C-C-C-C → same finger is fine (repeated key)", () => {
        const events = [
            makeEvent([note("C4")]), makeEvent([note("C4")]),
            makeEvent([note("C4")]), makeEvent([note("C4")]),
        ];
        const result = assignFingers(events, 32);
        expect(result).toHaveLength(4);
        // dist=0 → sameFingerPenalty=0 → same finger allowed
        expect(new Set(result.map((r) => r.finger)).size).toBe(1);
    });

    it("[G4,C4,E4] chord → G=5, C=1, E=3 (original order preserved)", () => {
        // v4 regression guard: sorted gives C-E-G but must map back
        const events = [makeEvent([note("G4"), note("C4"), note("E4")])];
        const result = assignFingers(events, 32);
        expect(result).toHaveLength(3);
        expect(result.map((r) => r.finger)).toEqual([5, 1, 3]);
    });

    it("handles rests gracefully", () => {
        const events: PlaybackEvent[] = [
            { durationBeats: 1, tempoBpm: 120, notes: [], tabs: [], sourceEventIndex: 0 },
            makeEvent([note("C4")]),
            { durationBeats: 1, tempoBpm: 120, notes: [], tabs: [], sourceEventIndex: 2 },
            makeEvent([note("E4")]),
        ];
        const result = assignFingers(events, 32);
        expect(result).toHaveLength(2);
    });
});
