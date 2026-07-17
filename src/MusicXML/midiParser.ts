import { BasicMIDI, midiMessageTypes } from "spessasynth_core";
import { Note } from "tonal";
import { getMelodicaKeyLabelForNote } from "../utils/utils";
import type { MelodicaKeyCount } from "../utils/utils";
import type { PlaybackEvent, PlaybackNote } from "./types";

const DEFAULT_MIDI_TEMPO_BPM = 120;
const MIDI_START_GROUP_PRECISION = 1_000_000;
const MIN_MIDI_DURATION_SECONDS = 0.01;

export type MidiFileErrorReason =
  | "invalid-midi"
  | "unsupported-format"
  | "no-melodic-notes";

const midiFileErrorMessages: Record<MidiFileErrorReason, string> = {
  "invalid-midi": "That MIDI file could not be read.",
  "unsupported-format": "Only MIDI formats 0 and 1 are supported.",
  "no-melodic-notes": "That MIDI file doesn't contain a playable melodic part.",
};

export class MidiFileError extends Error {
  reason: MidiFileErrorReason;
  userMessage: string;

  constructor(reason: MidiFileErrorReason, cause?: unknown) {
    const userMessage = midiFileErrorMessages[reason];
    super(userMessage);
    Object.setPrototypeOf(this, MidiFileError.prototype);
    if (cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = cause;
    }
    this.name = "MidiFileError";
    this.reason = reason;
    this.userMessage = userMessage;
  }
}

export type MidiNoteData = {
  durationSeconds: number;
  midi: number;
  startSeconds: number;
  velocity: number;
};

export type MidiPartInfo = {
  channel: number;
  durationSeconds: number;
  id: string;
  name: string;
  noteCount: number;
  notes: MidiNoteData[];
  originalMidiNumbers: number[];
};

export type MidiTempoChange = {
  bpm: number;
  seconds: number;
};

export type ParsedMidiScore = {
  durationSeconds: number;
  fileName: string;
  initialTempoBpm: number;
  parts: MidiPartInfo[];
  tempoChanges: MidiTempoChange[];
};

const isFiniteNonNegative = (value: number) =>
  Number.isFinite(value) && value >= 0;

const isDrumChannel = (channel: number) => channel % 16 === 9;

const getTrackNamesByChannel = (midi: BasicMIDI) => {
  const names = new Map<number, string>();

  midi.tracks.forEach((track) => {
    const trackNameEvent = track.events.find(
      (event) => event.statusByte === midiMessageTypes.trackName,
    );
    const name = (
      track.name ||
      (trackNameEvent ? new TextDecoder().decode(trackNameEvent.data) : "")
    ).trim();
    if (!name) return;

    track.channels.forEach((channel) => {
      if (!names.has(channel)) names.set(channel, name);
    });
  });

  return names;
};

const getTempoChanges = (midi: BasicMIDI): MidiTempoChange[] => {
  const sortedChanges = midi.tempoChanges
    .map((change) => ({
      bpm: change.tempo,
      seconds: midi.midiTicksToSeconds(change.ticks),
    }))
    .filter(
      (change) =>
        Number.isFinite(change.bpm) &&
        change.bpm > 0 &&
        isFiniteNonNegative(change.seconds),
    )
    .sort((a, b) => a.seconds - b.seconds);

  return sortedChanges.reduce<MidiTempoChange[]>((changes, change) => {
    const previous = changes[changes.length - 1];
    if (previous && Math.abs(previous.seconds - change.seconds) < 0.000001) {
      changes[changes.length - 1] = change;
    } else if (!previous || previous.bpm !== change.bpm) {
      changes.push(change);
    }
    return changes;
  }, []);
};

const getTempoAtSeconds = (
  tempoChanges: MidiTempoChange[],
  seconds: number,
) => {
  let tempo = DEFAULT_MIDI_TEMPO_BPM;
  for (const change of tempoChanges) {
    if (change.seconds > seconds) break;
    tempo = change.bpm;
  }
  return tempo;
};

export const parseMidiFile = (
  bytes: Uint8Array,
  fileName = "score.mid",
): ParsedMidiScore => {
  let midi: BasicMIDI;
  try {
    midi = BasicMIDI.fromArrayBuffer(bytes.slice().buffer, fileName);
  } catch (error) {
    throw new MidiFileError("invalid-midi", error);
  }

  if (Number(midi.format) !== 0 && Number(midi.format) !== 1) {
    throw new MidiFileError("unsupported-format");
  }

  const notesByChannel = midi.getNoteTimes();
  const trackNamesByChannel = getTrackNamesByChannel(midi);
  const parts = notesByChannel
    .map((notes, channel): MidiPartInfo | null => {
      if (isDrumChannel(channel)) return null;

      const normalizedNotes = notes
        .map((note): MidiNoteData | null => {
          if (
            !Number.isInteger(note.midiNote) ||
            note.midiNote < 0 ||
            note.midiNote > 127 ||
            !isFiniteNonNegative(note.start) ||
            !Number.isFinite(note.length) ||
            note.length <= 0
          ) {
            return null;
          }

          return {
            durationSeconds: note.length,
            midi: note.midiNote,
            startSeconds: note.start,
            velocity: Math.min(1, Math.max(0, note.velocity)),
          };
        })
        .filter((note): note is MidiNoteData => note !== null)
        .sort((a, b) => a.startSeconds - b.startSeconds || a.midi - b.midi);

      if (normalizedNotes.length === 0) return null;

      const durationSeconds = normalizedNotes.reduce(
        (maximum, note) =>
          Math.max(maximum, note.startSeconds + note.durationSeconds),
        0,
      );

      return {
        channel,
        durationSeconds,
        id: `channel-${channel}`,
        name: trackNamesByChannel.get(channel) || "MIDI Track",
        noteCount: normalizedNotes.length,
        notes: normalizedNotes,
        originalMidiNumbers: Array.from(
          new Set(normalizedNotes.map((note) => note.midi)),
        ).sort((a, b) => a - b),
      };
    })
    .filter((part): part is MidiPartInfo => part !== null);

  if (parts.length === 0) {
    throw new MidiFileError("no-melodic-notes");
  }

  const tempoChanges = getTempoChanges(midi);
  const firstNoteSeconds = Math.min(...parts.map((part) => part.notes[0].startSeconds));

  return {
    durationSeconds: Math.max(midi.duration, ...parts.map((part) => part.durationSeconds)),
    fileName,
    initialTempoBpm: getTempoAtSeconds(tempoChanges, firstNoteSeconds),
    parts,
    tempoChanges,
  };
};

const toPlaybackNote = (
  note: MidiNoteData,
  transpose: number,
): PlaybackNote | null => {
  const midi = note.midi + transpose;
  if (midi < 0 || midi > 127) return null;

  return {
    articulation: "normal",
    durationBeats: note.durationSeconds,
    durationSeconds: note.durationSeconds,
    name: Note.fromMidi(midi),
    shouldPlay: true,
    tieStart: false,
    tieStop: false,
    velocity: note.velocity,
  };
};

export const buildMidiPlaybackEvents = (
  score: ParsedMidiScore,
  partId: string,
  transpose: number,
  keyCount: MelodicaKeyCount,
): PlaybackEvent[] => {
  const part = score.parts.find((candidate) => candidate.id === partId);
  if (!part) return [];

  const groups = new Map<number, MidiNoteData[]>();
  part.notes.forEach((note) => {
    const key = Math.round(note.startSeconds * MIDI_START_GROUP_PRECISION);
    const group = groups.get(key) ?? [];
    group.push(note);
    groups.set(key, group);
  });

  const starts = Array.from(groups.keys())
    .sort((a, b) => a - b)
    .map((key) => key / MIDI_START_GROUP_PRECISION);
  const events: PlaybackEvent[] = [];

  const pushEvent = (
    startSeconds: number,
    durationSeconds: number,
    notes: PlaybackNote[],
  ) => {
    const normalizedDuration = Math.max(
      MIN_MIDI_DURATION_SECONDS,
      durationSeconds,
    );
    events.push({
      durationBeats: normalizedDuration,
      durationSeconds: normalizedDuration,
      notes,
      sourceEventIndex: events.length,
      tabs: notes.map(
        (note) => getMelodicaKeyLabelForNote(keyCount, note.name) || "",
      ),
      tempoBpm: getTempoAtSeconds(score.tempoChanges, startSeconds),
    });
  };

  if (starts[0] > 0) {
    pushEvent(0, starts[0], []);
  }

  starts.forEach((startSeconds, index) => {
    const sourceNotes = groups.get(
      Math.round(startSeconds * MIDI_START_GROUP_PRECISION),
    ) ?? [];
    const notes = sourceNotes
      .map((note) => toPlaybackNote(note, transpose))
      .filter((note): note is PlaybackNote => note !== null);
    const nextStart = starts[index + 1];
    const lastNoteEnd = sourceNotes.reduce(
      (maximum, note) =>
        Math.max(maximum, note.startSeconds + note.durationSeconds),
      startSeconds,
    );
    const endSeconds = nextStart ?? lastNoteEnd;
    pushEvent(startSeconds, endSeconds - startSeconds, notes);
  });

  return events;
};

export const getMidiFileErrorMessage = (error: unknown) =>
  error instanceof MidiFileError ? error.userMessage : null;
