import { Note } from "tonal";
import { NOTE_HIT_WINDOW_MS, NOTE_PITCH_TOLERANCE_CENTS } from "./constants";
import type { PlaybackEvent, PlaybackNote, PlaybackTiming } from "./types";

export type ScoringDetectedNote = {
    note: string;
    cents: number;
};

export const getPlayableScoringNotes = (event: PlaybackEvent | undefined): PlaybackNote[] =>
    event?.notes.filter((note) => note.shouldPlay) ?? [];

export const getTargetMidiNumbers = (event: PlaybackEvent | undefined) =>
    new Set(
        getPlayableScoringNotes(event)
            .map((note) => Note.midi(note.name))
            .filter((midi): midi is number => midi !== null)
    );

export const getDetectedPitchHitMidi = ({
    currentGameEvent,
    detectedNotes,
    targetEventIndex,
    toleranceCents = NOTE_PITCH_TOLERANCE_CENTS,
}: {
    currentGameEvent: PlaybackEvent | undefined;
    detectedNotes: readonly ScoringDetectedNote[];
    targetEventIndex: number | null;
    toleranceCents?: number;
}) => {
    if (targetEventIndex === null || detectedNotes.length === 0) return null;

    const targetMidiNumbers = getTargetMidiNumbers(currentGameEvent);
    for (const detectedNote of detectedNotes) {
        const detectedMidi = Note.midi(detectedNote.note);
        if (
            detectedMidi !== null &&
            targetMidiNumbers.has(detectedMidi) &&
            Math.abs(detectedNote.cents) <= toleranceCents
        ) {
            return detectedMidi;
        }
    }

    return null;
};

export const isDetectedPitchHit = (
    options: Parameters<typeof getDetectedPitchHitMidi>[0],
) => getDetectedPitchHitMidi(options) !== null;

export const getMissedEventIndexes = ({
    currentGameTimeMs,
    playbackEvents,
    playbackTimeline,
    scoredEventIndexes,
    hitWindowMs = NOTE_HIT_WINDOW_MS,
}: {
    currentGameTimeMs: number;
    playbackEvents: PlaybackEvent[];
    playbackTimeline: PlaybackTiming[];
    scoredEventIndexes: ReadonlySet<number>;
    hitWindowMs?: number;
}) => {
    const missedIndexes: number[] = [];

    playbackEvents.forEach((event, index) => {
        const timing = playbackTimeline[index];
        if (
            getPlayableScoringNotes(event).length === 0 ||
            !timing ||
            scoredEventIndexes.has(index) ||
            currentGameTimeMs <= timing.endMs + hitWindowMs
        ) {
            return;
        }

        missedIndexes.push(index);
    });

    return missedIndexes;
};
