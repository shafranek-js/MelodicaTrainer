import { Note } from "tonal";
import {
    NOTE_HIT_WINDOW_MS,
} from "./constants";
import { generateMelodicaLayout, getMelodicaKeyboardGeometry, getCandyNoteColor } from "../utils/utils";
import type { MelodicaKeyCount } from "../utils/utils";
import type { VisibleGameEvent } from "./types";

export type NoteHighwayRenderItem = {
    key: string;
    color: string;
    colorBody: string;
    wasHit: boolean;
    isVisible: boolean;
    showClarity: string | false | null;
    clarityValue: number;
    noteName: string;
    laneIndex: number;
    htmlLeft: number;
    htmlTop: number;
    htmlHeight: number;
    htmlWidth: number;
    isSounding: boolean;
    /** Deterministic seed for sparkle placement on this candy block. */
    sparkleSeed: number;
    /** Whether this note is a black key (sharp/flat) — controls corner rounding. */
    isBlack: boolean;
    /** Finger number 1–5, if finger hints are enabled. */
    finger?: number;
};

type BuildNoteHighwayRenderDataOptions = {
    clarity: string | null;
    containerWidth: number;
    lastHitIndex: number | null;
    keyCount?: MelodicaKeyCount;
    shortestNoteDurationMs: number;
    visibleGameEvents: VisibleGameEvent[];
    visualPlayheadMs: number;
    /** Map of "eventIndex-noteIndex" → finger 1–5 */
    fingerAssignments?: Map<string, number>;
    /** Dynamic target-line position (% from top), based on keyboard height. */
    targetLinePercent: number;
};

const CONTAINER_HEIGHT_PX = 520;

export const buildNoteHighwayRenderData = ({
    clarity,
    containerWidth,
    lastHitIndex,
    keyCount = 32,
    shortestNoteDurationMs,
    visibleGameEvents,
    visualPlayheadMs,
    fingerAssignments,
    targetLinePercent,
}: BuildNoteHighwayRenderDataOptions): NoteHighwayRenderItem[] => {
    const keyboardGeometry = getMelodicaKeyboardGeometry(generateMelodicaLayout(keyCount));
    const geometryByMidi = new Map(
        keyboardGeometry.keys.map((key) => [key.midi, key])
    );

    return visibleGameEvents.flatMap(({ event, index: globalEventIndex, timing }) => {
        return event.notes.map((note, noteIndex) => {
            if (!note.shouldPlay) return null;

            const fingerKey = `${globalEventIndex}-${noteIndex}`;
            const finger = fingerAssignments?.get(fingerKey);

            const noteMidi = Note.midi(note.name);
            const melodicaKey = noteMidi === null ? null : geometryByMidi.get(noteMidi);
            if (!melodicaKey) return null;

            const laneIndex = melodicaKey.index - 1;
            const timeToHitMs = timing.startMs - visualPlayheadMs;
            const msPerPx = shortestNoteDurationMs / 40;
            const dynamicLookaheadMs = CONTAINER_HEIGHT_PX * msPerPx;
            const percentPerMs = targetLinePercent / dynamicLookaheadMs;

            const noteDurationRatio = event.durationBeats > 0 ? note.durationBeats / event.durationBeats : 1;
            const noteDurationMs = timing.durationMs * noteDurationRatio;
            const noteEndMs = timing.startMs + noteDurationMs;

            const topPercent = targetLinePercent - timeToHitMs * percentPerMs;
            const heightPercent = noteDurationMs * percentPerMs;

            const minWidthPct = containerWidth > 0 ? (28 / containerWidth) * 100 : 2.8;
            const targetWidth = Math.max(melodicaKey.widthPct * 0.66, minWidthPct);

            const yTop = topPercent - heightPercent;
            const yBottom = topPercent - 0.4;

            const isHitWindow = visualPlayheadMs >= timing.startMs - NOTE_HIT_WINDOW_MS && visualPlayheadMs <= noteEndMs + NOTE_HIT_WINDOW_MS;
            const wasHit = lastHitIndex === globalEventIndex && isHitWindow;
            const isSounding = visualPlayheadMs >= timing.startMs && visualPlayheadMs <= noteEndMs;

            const candy = getCandyNoteColor(note.name);
            let color = candy.shell;
            let colorBody = candy.body;
            if (wasHit) {
                color = "#34d399";
                colorBody = "#059669";
            }

            const centerX = melodicaKey.centerPct;
            const isVisible = !(yBottom < -10 || yTop > 110);

            return {
                key: `${globalEventIndex}-${note.name}-${noteIndex}`,
                color,
                colorBody,
                wasHit,
                isVisible,
                showClarity: isHitWindow && !wasHit && clarity,
                clarityValue: clarity ? parseFloat(clarity) : 0,
                noteName: Note.pitchClass(note.name),
                laneIndex,
                htmlLeft: centerX - targetWidth / 2,
                htmlTop: yTop,
                htmlHeight: heightPercent,
                htmlWidth: targetWidth,
                isSounding,
                sparkleSeed: globalEventIndex * 100 + noteIndex,
                isBlack: melodicaKey.isBlack,
                finger,
            };
        }).filter((item): item is NonNullable<typeof item> => item !== null);
    });
};
