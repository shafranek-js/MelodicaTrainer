import { Note } from "tonal";
import {
    NOTE_HIT_WINDOW_MS,
    NOTE_TARGET_LINE_PERCENT,
} from "./constants";
import { generateMelodicaLayout, getMelodicaKeyboardGeometry, getSuzukiNoteColor } from "../utils/utils";
import type { MelodicaKeyCount } from "../utils/utils";
import type { PlaybackEvent, PlaybackTiming, VisibleGameEvent } from "./types";

export type NoteHighwayRenderItem = {
    key: string;
    color: string;
    wasHit: boolean;
    isVisible: boolean;
    showClarity: string | false | null;
    clarityValue: number;
    noteName: string;
    isOverblow: boolean;
    bendDepth: number;
    laneIndex: number;
    htmlLeft: number;
    htmlTop: number;
    htmlHeight: number;
    htmlWidth: number;
    isSounding: boolean;
};

type BuildNoteHighwayRenderDataOptions = {
    clarity: string | null;
    containerWidth: number;
    lastHitIndex: number | null;
    keyCount?: MelodicaKeyCount;
    shortestNoteDurationMs: number;
    visibleGameEvents: VisibleGameEvent[];
    visualPlayheadMs: number;
    playbackEvents: PlaybackEvent[];
    playbackTimeline: PlaybackTiming[];
};

const CONTAINER_HEIGHT_PX = 520;

export const getBendDepth = (tab: string) => {
    const bendMatch = tab.match(/('+|"+)$/);
    if (!bendMatch) return 0;

    return bendMatch[1].includes('"') ? 2 : bendMatch[1].length;
};

export const getTargetWidthPct = (tab: string, containerWidthPx: number) => {
    const isOverblow = tab.toLowerCase().endsWith("o");
    const bendDepth = getBendDepth(tab);
    const minWidthPct = containerWidthPx > 0 ? (40 / containerWidthPx) * 100 : 4.0;

    let targetPct = 8.4; // Natural note
    if (isOverblow) targetPct = 11;
    else if (bendDepth === 1) targetPct = 6.5;
    else if (bendDepth === 2) targetPct = 4.8;
    else if (bendDepth >= 3) targetPct = 3.0;

    return Math.max(targetPct, minWidthPct);
};

export const buildNoteHighwayRenderData = ({
    clarity,
    containerWidth,
    lastHitIndex,
    keyCount = 32,
    shortestNoteDurationMs,
    visibleGameEvents,
    visualPlayheadMs,
    playbackEvents,
    playbackTimeline,
}: BuildNoteHighwayRenderDataOptions): NoteHighwayRenderItem[] => {
    const keyboardGeometry = getMelodicaKeyboardGeometry(generateMelodicaLayout(keyCount));
    const geometryByMidi = new Map(
        keyboardGeometry.keys.map((key) => [key.midi, key])
    );

    return visibleGameEvents.flatMap(({ event, index: globalEventIndex, timing }) => {
        return event.notes.map((note, noteIndex) => {
            if (!note.shouldPlay) return null;

            const tab = event.tabs[noteIndex] || event.tabs[0] || "";
            const noteMidi = Note.midi(note.name);
            const melodicaKey = noteMidi === null ? null : geometryByMidi.get(noteMidi);
            if (!melodicaKey) return null;

            const laneIndex = melodicaKey.index - 1;
            const timeToHitMs = timing.startMs - visualPlayheadMs;
            const msPerPx = shortestNoteDurationMs / 40;
            const dynamicLookaheadMs = CONTAINER_HEIGHT_PX * msPerPx;
            const percentPerMs = NOTE_TARGET_LINE_PERCENT / dynamicLookaheadMs;

            const noteDurationRatio = event.durationBeats > 0 ? note.durationBeats / event.durationBeats : 1;
            const noteDurationMs = timing.durationMs * noteDurationRatio;
            const noteEndMs = timing.startMs + noteDurationMs;

            const topPercent = NOTE_TARGET_LINE_PERCENT - timeToHitMs * percentPerMs;
            const heightPercent = noteDurationMs * percentPerMs;

            const minWidthPct = containerWidth > 0 ? (28 / containerWidth) * 100 : 2.8;
            const targetWidth = Math.max(melodicaKey.widthPct * 0.66, minWidthPct);
            let bottomWidth = targetWidth;
            const topWidth = targetWidth;

            let yBottom = topPercent;
            const yTop = topPercent - heightPercent;

            let isScoop = false;

            if (globalEventIndex > 0) {
                const prevTiming = playbackTimeline[globalEventIndex - 1];
                if (prevTiming && Math.abs(prevTiming.endMs - timing.startMs) < 10) {
                    const prevEvent = playbackEvents[globalEventIndex - 1];
                    const prevNoteIndex = prevEvent.notes.findIndex((prevNote) => {
                        const previousMidi = Note.midi(prevNote.name);
                        const previousKey = previousMidi === null ? null : geometryByMidi.get(previousMidi);
                        return previousKey?.index === melodicaKey.index;
                    });
                    if (prevNoteIndex !== -1) {
                        const prevTab = prevEvent.tabs[prevNoteIndex];
                        if (prevTab !== tab) {
                            bottomWidth = targetWidth;
                            isScoop = true;
                        }
                    }
                }
            }

            if (!isScoop) {
                yBottom -= 0.4;
            }

            const isHitWindow = visualPlayheadMs >= timing.startMs - NOTE_HIT_WINDOW_MS && visualPlayheadMs <= noteEndMs + NOTE_HIT_WINDOW_MS;
            const isStrictlyActive = visualPlayheadMs >= timing.startMs && visualPlayheadMs <= noteEndMs;
            const wasHit = lastHitIndex === globalEventIndex && isHitWindow;
            const isSounding = visualPlayheadMs >= timing.startMs && visualPlayheadMs <= noteEndMs;

            let color = "#374151";
            if (wasHit) {
                color = "#34d399";
            } else if (isStrictlyActive) {
                color = getSuzukiNoteColor(note.name);
            } else {
                color = getSuzukiNoteColor(note.name);
            }

            const isOverblow = false;
            const bendDepth = 0;
            const centerX = melodicaKey.centerPct;

            const isVisible = !(yBottom < -10 || yTop > 110);
            const maxHtmlWidth = Math.max(topWidth, bottomWidth);

            return {
                key: `${globalEventIndex}-${note.name}-${noteIndex}`,
                color,
                wasHit,
                isVisible,
                showClarity: isHitWindow && !wasHit && clarity,
                clarityValue: clarity ? parseFloat(clarity) : 0,
                noteName: Note.pitchClass(note.name),
                isOverblow,
                bendDepth,
                laneIndex,
                htmlLeft: centerX - maxHtmlWidth / 2,
                htmlTop: yTop,
                htmlHeight: heightPercent,
                htmlWidth: maxHtmlWidth,
                isSounding,
            };
        }).filter((item): item is NoteHighwayRenderItem => item !== null);
    });
};
