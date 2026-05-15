import * as alphaTab from "@coderline/alphatab";
import { getMelodicaKeyLabelForNote, normalizeMelodicaKeyCount } from "../utils/utils";
import type { MelodicaKeyCount } from "../utils/utils";
import type { PlaybackEvent, PlaybackNote } from "./types";
import { Note } from "tonal";
import { resolveTiedNotes } from "./playbackParser";
import { addLeadInIfNeeded } from "./playbackLeadIn";
import { musicXmlDebugLogger } from "./debugLogger";

type AlphaTabTrackWithStaffs = alphaTab.model.Track & {
    staffs?: alphaTab.model.Staff[];
};

type AlphaTabStaffWithTransposition = alphaTab.model.Staff & {
    transpositionPitch?: number;
};

type AlphaTabPlaybackNote = {
    realValue?: number;
    velocity?: number;
    isTieOrigin?: boolean;
    isTieDestination?: boolean;
};

type AlphaTabPlaybackBeat = {
    absoluteStart: number;
    originalTick: number;
    playbackDuration: number;
    playbackStart: number;
    playbackTempo?: number;
    isRest?: boolean;
    notes?: AlphaTabPlaybackNote[];
};

type AlphaTabTempoAutomation = {
    value?: number;
    ratioPosition?: number;
};

const DEFAULT_GP_TEMPO = 90;

type ParseAlphaTabScoreOptions = {
    addLeadIn?: boolean;
};

const getMidiTickResolution = (score: alphaTab.model.Score) =>
    (score as alphaTab.model.Score & { midiTickResolution?: number }).midiTickResolution ?? 960;

const getValidTempo = (tempo: unknown) =>
    typeof tempo === "number" && Number.isFinite(tempo) && tempo > 0
        ? tempo
        : null;

const getScoreTempo = (score: alphaTab.model.Score) =>
    getValidTempo(score.tempo) ?? DEFAULT_GP_TEMPO;

const getTempoAutomations = (masterBar: alphaTab.model.MasterBar, barLengthTicks: number) =>
    masterBar.tempoAutomations
        .map((automation: AlphaTabTempoAutomation) => {
            const tempo = getValidTempo(automation.value);
            if (tempo === null) return null;

            const ratioPosition = typeof automation.ratioPosition === "number"
                ? Math.min(1, Math.max(0, automation.ratioPosition))
                : 0;

            return {
                tick: ratioPosition * barLengthTicks,
                tempo,
            };
        })
        .filter((automation): automation is { tick: number; tempo: number } => automation !== null)
        .sort((a, b) => a.tick - b.tick);

const getTempoAtTick = (
    relativeTick: number,
    currentTempo: number,
    tempoAutomations: { tick: number; tempo: number }[]
) => {
    let tempo = currentTempo;
    for (const automation of tempoAutomations) {
        if (automation.tick > relativeTick) break;
        tempo = automation.tempo;
    }
    return tempo;
};

export function parseAlphaTabScore(
    score: alphaTab.model.Score, 
    keyCountInput: MelodicaKeyCount | string, 
    trackIndex: number = 0, 
    manualTranspose: number = 0,
    options: ParseAlphaTabScoreOptions = {}
): { events: PlaybackEvent[], tempo: number } {
    const events: PlaybackEvent[] = [];
    const keyCount = normalizeMelodicaKeyCount(keyCountInput);
    
    if (!score.tracks || score.tracks.length === 0) return { events: [], tempo: DEFAULT_GP_TEMPO };

    const track = score.tracks[trackIndex] || score.tracks[0];
    const staff = track.staves[0] || (track as AlphaTabTrackWithStaffs).staffs?.[0];
    if (!staff || !staff.bars) return { events: [], tempo: DEFAULT_GP_TEMPO };
    const appliedStaffTranspose = -((staff as AlphaTabStaffWithTransposition).transpositionPitch ?? 0);
    const missingManualTranspose = manualTranspose - appliedStaffTranspose;

    musicXmlDebugLogger.log(`AlphaTab Parser: Extracting track ${trackIndex} (${track.name})`);
    
    const masterBars = score.masterBars;
    const initialTempo = getScoreTempo(score);
    let currentTempo = initialTempo;
    const allBeats: AlphaTabPlaybackBeat[] = [];

    const getBarLengthTicks = (barIdx: number) => {
        const mb = masterBars[barIdx];
        if (masterBars[barIdx + 1]) {
            return masterBars[barIdx + 1].start - mb.start;
        }
        // Fallback for last bar
        const resolution = getMidiTickResolution(score);
        return (mb.timeSignatureNumerator / mb.timeSignatureDenominator) * 4 * resolution;
    };

    const collectBeatsFromBar = (barIndex: number, tickOffset: number, originalTickOffset: number) => {
        const masterBar = masterBars[barIndex];
        const barLengthTicks = getBarLengthTicks(barIndex);
        const tempoAutomations = getTempoAutomations(masterBar, barLengthTicks);
        const bar = staff.bars[barIndex];
        if (!bar || !bar.voices) return;
        
        // To maintain a linear timeline, we only extract the primary voice (Voice 0).
        // GP files often contain rests or chords in other voices that would break 
        // the sequential playback event accumulation.
        const voice = bar.voices[0];
        if (voice && voice.beats) {
            voice.beats.forEach((beat) => {
                const playbackBeat = beat as unknown as AlphaTabPlaybackBeat;
                if (playbackBeat.playbackDuration > 0) {
                    // In AlphaTab model, playbackStart is relative to the bar start
                    const relativeStart = playbackBeat.playbackStart;
                    allBeats.push({
                        ...playbackBeat,
                        absoluteStart: tickOffset + relativeStart,
                        originalTick: originalTickOffset + relativeStart,
                        playbackTempo: getTempoAtTick(relativeStart, currentTempo, tempoAutomations)
                    });
                }
            });
        }

        if (tempoAutomations.length > 0) {
            currentTempo = tempoAutomations[tempoAutomations.length - 1].tempo;
        }
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

    if (allBeats.length === 0) return { events: [], tempo: initialTempo };

    allBeats.sort((a, b) => a.absoluteStart - b.absoluteStart);

    const groupedBeats: Map<number, AlphaTabPlaybackBeat[]> = new Map();
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
    const res = getMidiTickResolution(score);

    sortedStarts.forEach((start) => {
        const beatsAtTime = groupedBeats.get(start)!;
        const firstBeat = beatsAtTime[0];
        const tempoBpm = getValidTempo(firstBeat.playbackTempo) ?? initialTempo;

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
                beatNotes.forEach((playbackNote) => {
                    const note = playbackNote as unknown as alphaTab.model.Note;
                    if (note.realValue === undefined || note.realValue === 0) return;
                    const midi = note.realValue + missingManualTranspose;
                    
                    // Map AlphaTab dynamics to velocity
                    // PPP=0, PP=1, P=2, MP=3, MF=4, F=5, FF=6, FFF=7
                    let velocity = 0.68; // MF default
                    switch (note.dynamics) {
                        case alphaTab.model.DynamicValue.PPP: velocity = 0.25; break;
                        case alphaTab.model.DynamicValue.PP: velocity = 0.32; break;
                        case alphaTab.model.DynamicValue.P: velocity = 0.42; break;
                        case alphaTab.model.DynamicValue.MP: velocity = 0.52; break;
                        case alphaTab.model.DynamicValue.MF: velocity = 0.68; break;
                        // F is usually 5 but the enum is omitted in our brief look, default it around 0.82
                        case alphaTab.model.DynamicValue.FF: velocity = 0.94; break;
                        case alphaTab.model.DynamicValue.FFF: velocity = 1; break;
                        default: 
                            if (note.dynamics === 5) velocity = 0.82; // F
                            break;
                    }

                    // Map articulation
                    let articulation: PlaybackNote["articulation"] = "normal";
                    if (note.isStaccato) {
                        articulation = "staccato";
                    } else if (note.accentuated === alphaTab.model.AccentuationType.Heavy || note.accentuated === alphaTab.model.AccentuationType.Normal) {
                        articulation = "accent";
                    } else if (note.accentuated === alphaTab.model.AccentuationType.Tenuto) {
                        articulation = "tenuto";
                    }
                    
                    notes.push({
                        name: Note.fromMidi(midi),
                        durationBeats: beat.playbackDuration / res,
                        velocity: velocity,
                        articulation: articulation,
                        tieStart: note.isTieOrigin || false,
                        tieStop: note.isTieDestination || false,
                        shouldPlay: true
                    });
                });
            }
        });

        const tabs = notes.map(n => getMelodicaKeyLabelForNote(keyCount, n.name) || "");

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

    const firstMasterBar = masterBars[0];
    const leadInBeats = firstMasterBar
        ? (firstMasterBar.timeSignatureNumerator * 4) / firstMasterBar.timeSignatureDenominator
        : 4;
    const tiedEvents = resolveTiedNotes(events);
    const resolvedEvents = options.addLeadIn === false
        ? tiedEvents
        : addLeadInIfNeeded(tiedEvents, leadInBeats);
    musicXmlDebugLogger.log(`AlphaTab Parser: Success! Parsed ${resolvedEvents.length} events.`);
    return { events: resolvedEvents, tempo: initialTempo };
}
