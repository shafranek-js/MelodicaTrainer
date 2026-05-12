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
    console.log(`AlphaTab Parser: Extracting track ${trackIndex} (${track.name})`);
    
    const allBeats: any[] = [];
    
    // Exhaustive collection with absolute tick calculation
    const staves = track.staves || (track as any).staffs || [];
    staves.forEach((staff: any) => {
        if (!staff.bars) return;
        staff.bars.forEach((bar: any) => {
            const barStart = bar.masterBar?.start || 0;
            if (!bar.voices) return;
            bar.voices.forEach((voice: any) => {
                if (!voice.beats) return;
                voice.beats.forEach((beat: any) => {
                    if (beat.playbackDuration > 0) {
                        allBeats.push({
                            ...beat,
                            absoluteStart: barStart + beat.playbackStart
                        });
                    }
                });
            });
        });
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
    let currentTick = 0;

    sortedStarts.forEach((start) => {
        const beatsAtTime = groupedBeats.get(start)!;
        const firstBeat = beatsAtTime[0];
        const tempoBpm = firstBeat.playbackTempo || 90;

        if (start > currentTick) {
            events.push({
                durationBeats: start - currentTick,
                tempoBpm,
                notes: [],
                tabs: [],
                sourceEventIndex: events.length
            });
        }

        let maxDur = 0;
        const notes: PlaybackNote[] = [];
        
        beatsAtTime.forEach((beat) => {
            if (beat.playbackDuration > maxDur) maxDur = beat.playbackDuration;
            
            const beatNotes = beat.notes || [];
            if (beatNotes.length > 0 && !beat.isRest) {
                beatNotes.forEach((note: any) => {
                    // APPLY MANUAL TRANSPOSE HERE
                    const midi = note.realValue + manualTranspose;
                    if (midi === undefined || midi === 0) return;
                    
                    notes.push({
                        name: Note.fromMidi(midi),
                        durationBeats: beat.playbackDuration,
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

        events.push({
            durationBeats: maxDur,
            tempoBpm,
            notes,
            tabs,
            sourceEventIndex: events.length
        });

        currentTick = start + maxDur;
    });

    console.log(`AlphaTab Parser: Success! Parsed ${events.length} events.`);
    return events;
}
