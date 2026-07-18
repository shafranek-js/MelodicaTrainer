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
  durationTicks: number;
  durationSeconds: number;
  midi: number;
  startTick: number;
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
  ticks: number;
};

export type MidiTimeSignature = {
  denominator: number;
  numerator: number;
  ticks: number;
};

export type MidiKeySignature = {
  fifths: number;
  mode: "major" | "minor";
  ticks: number;
};

export type ParsedMidiScore = {
  durationSeconds: number;
  fileName: string;
  initialTempoBpm: number;
  keySignatures: MidiKeySignature[];
  parts: MidiPartInfo[];
  tempoChanges: MidiTempoChange[];
  ticksPerQuarter: number;
  timeSignatures: MidiTimeSignature[];
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
      ticks: change.ticks,
    }))
    .filter(
      (change) =>
        Number.isFinite(change.bpm) &&
        change.bpm > 0 &&
        isFiniteNonNegative(change.seconds),
    )
    .sort((a, b) => a.seconds - b.seconds);

  const changes = sortedChanges.reduce<MidiTempoChange[]>((result, change) => {
    const previous = result[result.length - 1];
    if (previous && Math.abs(previous.seconds - change.seconds) < 0.000001) {
      result[result.length - 1] = change;
    } else if (!previous || previous.bpm !== change.bpm) {
      result.push(change);
    }
    return result;
  }, []);
  if (changes.length === 0 || changes[0].ticks > 0) {
    changes.unshift({ bpm: DEFAULT_MIDI_TEMPO_BPM, seconds: 0, ticks: 0 });
  }
  return changes;
};

const getMetaEvents = (midi: BasicMIDI, statusByte: number) =>
  midi.tracks
    .flatMap((track) => Array.from(track.events))
    .filter((event) => event.statusByte === statusByte)
    .sort((left, right) => left.ticks - right.ticks);

const dedupeByTick = <T extends { ticks: number }>(values: T[]) =>
  values.reduce<T[]>((result, value) => {
    const previous = result[result.length - 1];
    if (previous?.ticks === value.ticks) {
      result[result.length - 1] = value;
    } else {
      result.push(value);
    }
    return result;
  }, []);

const getTimeSignatures = (midi: BasicMIDI): MidiTimeSignature[] => {
  const signatures = getMetaEvents(midi, midiMessageTypes.timeSignature)
    .map((event): MidiTimeSignature | null => {
      const numerator = event.data[0];
      const denominatorPower = event.data[1];
      const denominator = 2 ** denominatorPower;
      if (
        !Number.isInteger(numerator) || numerator <= 0 ||
        !Number.isInteger(denominatorPower) || denominatorPower < 0 || denominatorPower > 7
      ) {
        return null;
      }
      return { denominator, numerator, ticks: event.ticks };
    })
    .filter((signature): signature is MidiTimeSignature => signature !== null);

  return dedupeByTick(signatures.length > 0
    ? signatures
    : [{ denominator: 4, numerator: 4, ticks: 0 }]);
};

const toSignedByte = (value: number) => value > 127 ? value - 256 : value;

const getKeySignatures = (midi: BasicMIDI): MidiKeySignature[] => {
  const signatures = getMetaEvents(midi, midiMessageTypes.keySignature)
    .map((event): MidiKeySignature | null => {
      const fifths = toSignedByte(event.data[0]);
      const modeByte = event.data[1];
      if (!Number.isInteger(fifths) || fifths < -7 || fifths > 7) return null;
      return {
        fifths,
        mode: modeByte === 1 ? "minor" : "major",
        ticks: event.ticks,
      };
    })
    .filter((signature): signature is MidiKeySignature => signature !== null);

  return dedupeByTick(signatures.length > 0
    ? signatures
    : [{ fifths: 0, mode: "major", ticks: 0 }]);
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

export const getMidiSecondsAtTick = (
  score: Pick<ParsedMidiScore, "tempoChanges" | "ticksPerQuarter">,
  targetTick: number,
) => {
  const normalizedTick = Math.max(0, targetTick);
  const changes = [...score.tempoChanges]
    .filter((change) => change.ticks >= 0 && change.bpm > 0)
    .sort((left, right) => left.ticks - right.ticks);
  let currentTick = 0;
  let currentTempo = DEFAULT_MIDI_TEMPO_BPM;
  let seconds = 0;

  for (const change of changes) {
    if (change.ticks > normalizedTick) break;
    if (change.ticks > currentTick) {
      seconds += (change.ticks - currentTick) * 60 /
        (currentTempo * score.ticksPerQuarter);
      currentTick = change.ticks;
    }
    currentTempo = change.bpm;
  }

  if (normalizedTick > currentTick) {
    seconds += (normalizedTick - currentTick) * 60 /
      (currentTempo * score.ticksPerQuarter);
  }
  return seconds;
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
            durationTicks: Math.max(
              1,
              Math.round(midi.secondsToMIDITicks(note.start + note.length)) -
                Math.round(midi.secondsToMIDITicks(note.start)),
            ),
            durationSeconds: note.length,
            midi: note.midiNote,
            startTick: Math.max(0, Math.round(midi.secondsToMIDITicks(note.start))),
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
  return {
    durationSeconds: Math.max(midi.duration, ...parts.map((part) => part.durationSeconds)),
    fileName,
    initialTempoBpm: getTempoAtSeconds(tempoChanges, 0),
    keySignatures: getKeySignatures(midi),
    parts,
    tempoChanges,
    ticksPerQuarter: midi.timeDivision,
    timeSignatures: getTimeSignatures(midi),
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
  notation?: {
    cursorIndexByTick: ReadonlyMap<number, number>;
    visualBoundaryTicks: readonly number[];
  },
): PlaybackEvent[] => {
  const part = score.parts.find((candidate) => candidate.id === partId);
  if (!part) return [];

  const groups = new Map<number, MidiNoteData[]>();
  part.notes.forEach((note) => {
    const group = groups.get(note.startTick) ?? [];
    group.push(note);
    groups.set(note.startTick, group);
  });

  const boundaryTicks = new Set(groups.keys());
  notation?.visualBoundaryTicks.forEach((tick) => boundaryTicks.add(tick));
  if (Math.min(...groups.keys()) > 0) boundaryTicks.add(0);

  const boundaries = [...boundaryTicks]
    .map((tick) => {
      const notes = groups.get(tick) ?? [];
      const startSeconds = notes.length > 0
        ? Math.min(...notes.map((note) => note.startSeconds))
        : getMidiSecondsAtTick(score, tick);
      return { notes, startSeconds, tick };
    })
    .sort((left, right) =>
      left.startSeconds - right.startSeconds || left.tick - right.tick
    )
    .filter((boundary, index, values) => {
      if (index === 0) return true;
      const previous = values[index - 1];
      return boundary.tick !== previous.tick ||
        Math.round(boundary.startSeconds * MIDI_START_GROUP_PRECISION) !==
          Math.round(previous.startSeconds * MIDI_START_GROUP_PRECISION);
    });
  const events: PlaybackEvent[] = [];

  const pushEvent = (
    startSeconds: number,
    durationSeconds: number,
    notes: PlaybackNote[],
    tick: number,
  ) => {
    const normalizedDuration = Math.max(
      MIN_MIDI_DURATION_SECONDS,
      durationSeconds,
    );
    events.push({
      durationBeats: normalizedDuration,
      durationSeconds: normalizedDuration,
      notes,
      sourceEventIndex: notation?.cursorIndexByTick.get(tick) ?? events.length,
      tabs: notes.map(
        (note) => getMelodicaKeyLabelForNote(keyCount, note.name) || "",
      ),
      tempoBpm: getTempoAtSeconds(score.tempoChanges, startSeconds),
      tick,
    });
  };

  boundaries.forEach((boundary, index) => {
    const notes = boundary.notes
      .map((note) => toPlaybackNote(note, transpose))
      .filter((note): note is PlaybackNote => note !== null);
    const nextStart = boundaries[index + 1]?.startSeconds;
    const lastNoteEnd = boundary.notes.reduce(
      (maximum, note) =>
        Math.max(maximum, note.startSeconds + note.durationSeconds),
      boundary.startSeconds,
    );
    const endSeconds = nextStart ?? lastNoteEnd;
    pushEvent(
      boundary.startSeconds,
      endSeconds - boundary.startSeconds,
      notes,
      boundary.tick,
    );
  });

  return events;
};

export const getMidiFileErrorMessage = (error: unknown) =>
  error instanceof MidiFileError ? error.userMessage : null;
