import { Note } from "tonal";
import {
    NOTE_HIT_WINDOW_MS,
    NOTE_TARGET_LINE_PERCENT,
} from "./constants";
import { getTabHole } from "./playbackParser";
import type { PlaybackEvent, PlaybackTiming, VisibleGameEvent } from "./types";

export type NoteHighwayRenderItem = {
    key: string;
    pathD: string;
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
};

type BuildNoteHighwayRenderDataOptions = {
    clarity: string | null;
    containerWidth: number;
    lastHitIndex: number | null;
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
    shortestNoteDurationMs,
    visibleGameEvents,
    visualPlayheadMs,
    playbackEvents,
    playbackTimeline,
}: BuildNoteHighwayRenderDataOptions): NoteHighwayRenderItem[] => {
    return visibleGameEvents.flatMap(({ event, index: globalEventIndex, timing }) => {
        return event.notes.map((note, noteIndex) => {
            if (!note.shouldPlay) return null;

            const tab = event.tabs[noteIndex] || event.tabs[0] || "";
            const hole = getTabHole(tab);
            if (hole === null || hole < 1 || hole > 10) return null;

            const laneIndex = hole - 1;
            const timeToHitMs = timing.startMs - visualPlayheadMs;
            const msPerPx = shortestNoteDurationMs / 40;
            const dynamicLookaheadMs = CONTAINER_HEIGHT_PX * msPerPx;
            const percentPerMs = NOTE_TARGET_LINE_PERCENT / dynamicLookaheadMs;

            const noteDurationRatio = event.durationBeats > 0 ? note.durationBeats / event.durationBeats : 1;
            const noteDurationMs = timing.durationMs * noteDurationRatio;
            const noteEndMs = timing.startMs + noteDurationMs;

            const topPercent = NOTE_TARGET_LINE_PERCENT - timeToHitMs * percentPerMs;
            const heightPercent = noteDurationMs * percentPerMs;

            const targetWidth = getTargetWidthPct(tab, containerWidth);
            let bottomWidth = targetWidth;
            const topWidth = targetWidth;

            let yBottom = topPercent;
            const yTop = topPercent - heightPercent;

            let isScoop = false;

            if (globalEventIndex > 0) {
                const prevTiming = playbackTimeline[globalEventIndex - 1];
                if (prevTiming && Math.abs(prevTiming.endMs - timing.startMs) < 10) {
                    const prevEvent = playbackEvents[globalEventIndex - 1];
                    const prevNoteIndex = prevEvent.tabs.findIndex(t => getTabHole(t) === hole);
                    if (prevNoteIndex !== -1) {
                        const prevTab = prevEvent.tabs[prevNoteIndex];
                        if (prevTab !== tab) {
                            bottomWidth = getTargetWidthPct(prevTab, containerWidth);
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

            const isDraw = tab.startsWith("-");
            const isBlow = /^\d/.test(tab);

            let color = "#374151";
            if (wasHit) {
                color = "#34d399";
            } else if (isStrictlyActive) {
                color = isDraw ? "#60a5fa" : (isBlow ? "#f87171" : "#22d3ee");
            } else {
                color = isDraw ? "#1e3a8a" : (isBlow ? "#7f1d1d" : "#1f2937");
            }

            const isOverblow = tab.toLowerCase().endsWith("o");
            const bendDepth = getBendDepth(tab);
            const centerX = laneIndex * 10 + 5;

            const tlX = centerX - topWidth / 2;
            const trX = centerX + topWidth / 2;
            const brX = centerX + bottomWidth / 2;
            const blX = centerX - bottomWidth / 2;

            const effContainerWidth = containerWidth > 0 ? containerWidth : 1000;
            const targetRadiusPx = 20;

            const idealRXPercent = (targetRadiusPx / effContainerWidth) * 100;
            const idealRYPercent = (targetRadiusPx / CONTAINER_HEIGHT_PX) * 100;

            const heightPct = Math.max(0, yBottom - yTop);
            const maxRY = heightPct / 2;
            const maxRXTop = topWidth / 2;
            const maxRXBot = bottomWidth / 2;

            let rxTop = idealRXPercent;
            let ryTop = idealRYPercent;
            if (idealRYPercent > maxRY || idealRXPercent > maxRXTop) {
                const scale = Math.min(maxRY / idealRYPercent, maxRXTop / idealRXPercent);
                rxTop = idealRXPercent * scale;
                ryTop = idealRYPercent * scale;
            }

            let rxBot = idealRXPercent;
            let ryBot = idealRYPercent;
            if (idealRYPercent > maxRY || idealRXPercent > maxRXBot) {
                const scale = Math.min(maxRY / idealRYPercent, maxRXBot / idealRXPercent);
                rxBot = idealRXPercent * scale;
                ryBot = idealRYPercent * scale;
            }

            const pathD = `
            M ${tlX + rxTop},${yTop}
            L ${trX - rxTop},${yTop}
            A ${rxTop} ${ryTop} 0 0 1 ${trX},${yTop + ryTop}
            L ${brX},${yBottom - ryBot}
            A ${rxBot} ${ryBot} 0 0 1 ${brX - rxBot},${yBottom}
            L ${blX + rxBot},${yBottom}
            A ${rxBot} ${ryBot} 0 0 1 ${blX},${yBottom - ryBot}
            L ${tlX},${yTop + ryTop}
            A ${rxTop} ${ryTop} 0 0 1 ${tlX + rxTop},${yTop}
            Z
          `;

            const isVisible = !(yBottom < -10 || yTop > 110);
            const maxHtmlWidth = Math.max(topWidth, bottomWidth);

            return {
                key: `${globalEventIndex}-${note.name}-${noteIndex}`,
                pathD,
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
            };
        }).filter((item): item is NoteHighwayRenderItem => item !== null);
    });
};
