import * as alphaTab from "@coderline/alphatab";
import { getHarmonicaHoleForNote } from "../utils/utils";
import type { PlaybackEvent, PlaybackNote } from "./types";
import { Note } from "tonal";

export function parseAlphaTabScore(
    score: alphaTab.model.Score, 
    harmonicaKey: string, 
    trackIndex: number = 0, 
    manualTranspose: number = 0
): PlaybackEvent[] {
    const events: PlaybackEvent[] = [];
    
    if (!score.tracks || score.tracks.length === 0) return [];

    const track = score.tracks[trackIndex] || score.tracks[0];
    const staff = track.staves[0] || (track as any).staffs?.[0];
    if (!staff || !staff.bars) return [];

    console.log(`AlphaTab Parser: Extracting track ${trackIndex} (${track.name})`);
    
    const masterBars = score.masterBars;
    const allBeats: any[] = [];

    const getBarLengthTicks = (barIdx: number) => {
        const mb = masterBars[barIdx];
        if (masterBars[barIdx + 1]) {
            return masterBars[barIdx + 1].start - mb.start;
        }
        // Fallback for last bar
        const resolution = score.midiTickResolution || 960;
        return (mb.timeSignatureNumerator / mb.timeSignatureDenominator) * 4 * resolution;
    };

    const collectBeatsFromBar = (barIndex: number, tickOffset: number, originalTickOffset: number) => {
        const bar = staff.bars[barIndex];
        if (!bar || !bar.voices) return;
        
        bar.voices.forEach((voice: any) => {
            if (!voice.beats) return;
            voice.beats.forEach((beat: any) => {
                if (beat.playbackDuration > 0) {
                    // In AlphaTab model, playbackStart is relative to the bar start
                    const relativeStart = beat.playbackStart; 
                    allBeats.push({
                        ...beat,
                        absoluteStart: tickOffset + relativeStart,
                        originalTick: originalTickOffset + relativeStart
                    });
                }
            });
        });
    };

    // 1. Build the playback path (list of bar indices and their absolute tick offsets)
    const playbackPath: { barIndex: number, offset: number, originalOffset: number }[] = [];
    let absoluteTickCursor = 0;
    let repeatStartBarIndex = 0;

    for (let i = 0; i < masterBars.length; i++) {
        const mb = masterBars[i];
        if (mb.isRepeatStart) {
            repeatStartBarIndex = i;
        }

        const barLength = getBarLengthTicks(i);
        
        // Add the first (or only) pass of this bar
        playbackPath.push({ barIndex: i, offset: absoluteTickCursor, originalOffset: mb.start });
        
        if (mb.repeatCount > 1) {
            // This bar marks the end of a repeated section.
            // Calculate the length of the section that will be repeated
            let sectionLength = 0;
            for (let j = repeatStartBarIndex; j <= i; j++) {
                sectionLength += getBarLengthTicks(j);
            }

            // Add additional passes
            for (let r = 1; r < mb.repeatCount; r++) {
                const passStartOffset = absoluteTickCursor + barLength + (r - 1) * sectionLength;
                let innerOffset = 0;
                for (let j = repeatStartBarIndex; j <= i; j++) {
                    playbackPath.push({ 
                        barIndex: j, 
                        offset: passStartOffset + innerOffset, 
                        originalOffset: masterBars[j].start 
                    });
                    innerOffset += getBarLengthTicks(j);
                }
            }
            // Advance cursor by the additional passes
            absoluteTickCursor += (mb.repeatCount - 1) * sectionLength;
        }
        
        absoluteTickCursor += barLength;
    }

    // 2. Collect beats based on the playback path
    playbackPath.forEach(step => {
        collectBeatsFromBar(step.barIndex, step.offset, step.originalOffset);
    });


    if (allBeats.length === 0) return [];

    allBeats.sort((a, b) => a.absoluteStart - b.absoluteStart);

    const groupedBeats: Map<number, any[]> = new Map();
    allBeats.forEach(beat => {
        const start = beat.absoluteStart;
        let found = false;
        for (const [key, group] of groupedBeats.entries()) {
            if (Math.abs(key - start) < 1) {
                group.push(beat);
                found = true;
                break;
            }
        }
        if (!found) groupedBeats.set(start, [beat]);
    });

    const sortedStarts = Array.from(groupedBeats.keys()).sort((a, b) => a - b);
    let currentPlaybackCursor = 0;
    const res = score.midiTickResolution || 960;

    sortedStarts.forEach((start) => {
        const beatsAtTime = groupedBeats.get(start)!;
        const firstBeat = beatsAtTime[0];
        const tempoBpm = firstBeat.playbackTempo || 90;

        // 1. Handle Silent Gaps (Rests)
        if (start > currentPlaybackCursor) {
            const gapTicks = start - currentPlaybackCursor;
            events.push({
                durationBeats: gapTicks / res,
                tempoBpm,
                notes: [],
                tabs: [],
                sourceEventIndex: events.length,
                tick: currentPlaybackCursor,
                originalTick: firstBeat.originalTick - gapTicks 
            });
        }

        // 2. Handle Beats with Notes
        let maxDur = 0;
        const notes: PlaybackNote[] = [];
        
        beatsAtTime.forEach((beat) => {
            if (beat.playbackDuration > maxDur) maxDur = beat.playbackDuration;
            
            const beatNotes = beat.notes || [];
            if (beatNotes.length > 0 && !beat.isRest) {
                beatNotes.forEach((note: any) => {
                    const midi = note.realValue + manualTranspose;
                    if (midi === undefined || midi === 0) return;
                    
                    notes.push({
                        name: Note.fromMidi(midi),
                        durationBeats: beat.playbackDuration / res,
                        velocity: (note.velocity || 100) / 127,
                        articulation: "normal",
                        tieStart: note.isTieStart || false,
                        tieStop: false, 
                        shouldPlay: true
                    });
                });
            }
        });

        const tabs = notes.map(n => getHarmonicaHoleForNote(harmonicaKey, n.name) || "");

        // Ensure we don't create overlapping events in our linear playbackEvents list
        const eventStartTick = Math.max(start, currentPlaybackCursor);
        const eventDurationTicks = Math.max(10, maxDur); // Minimum 10 ticks duration

        events.push({
            durationBeats: eventDurationTicks / res,
            tempoBpm,
            notes,
            tabs,
            sourceEventIndex: events.length,
            tick: eventStartTick,
            originalTick: firstBeat.originalTick
        });

        currentPlaybackCursor = eventStartTick + eventDurationTicks;
    });

    console.log(`AlphaTab Parser: Success! Parsed ${events.length} events.`);
    return events;
}
