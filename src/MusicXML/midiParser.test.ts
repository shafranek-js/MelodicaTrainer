import { describe, expect, it } from "vitest";
import {
  buildMidiPlaybackEvents,
  MidiFileError,
  parseMidiFile,
} from "./midiParser";

const encodeVariableLength = (value: number) => {
  const bytes = [value & 0x7f];
  let remaining = value >> 7;
  while (remaining > 0) {
    bytes.unshift((remaining & 0x7f) | 0x80);
    remaining >>= 7;
  }
  return bytes;
};

const int16 = (value: number) => [(value >> 8) & 0xff, value & 0xff];
const int32 = (value: number) => [
  (value >> 24) & 0xff,
  (value >> 16) & 0xff,
  (value >> 8) & 0xff,
  value & 0xff,
];
const text = (value: string) => Array.from(value, (character) => character.charCodeAt(0));

const midiEvent = (delta: number, status: number, ...data: number[]) => [
  ...encodeVariableLength(delta),
  status,
  ...data,
];

const metaEvent = (delta: number, type: number, data: number[]) => [
  ...encodeVariableLength(delta),
  0xff,
  type,
  ...encodeVariableLength(data.length),
  ...data,
];

const trackChunk = (events: number[][]) => {
  const body = [...events.flat(), ...metaEvent(0, 0x2f, [])];
  return [...text("MTrk"), ...int32(body.length), ...body];
};

const midiFile = (format: number, tracks: number[][][], division = 480) =>
  new Uint8Array([
    ...text("MThd"),
    ...int32(6),
    ...int16(format),
    ...int16(tracks.length),
    ...int16(division),
    ...tracks.flatMap(trackChunk),
  ]);

const tempo = (delta: number, microsecondsPerBeat: number) =>
  metaEvent(delta, 0x51, [
    (microsecondsPerBeat >> 16) & 0xff,
    (microsecondsPerBeat >> 8) & 0xff,
    microsecondsPerBeat & 0xff,
  ]);

describe("MIDI parsing", () => {
  const getErrorReason = (callback: () => unknown) => {
    try {
      callback();
      return null;
    } catch (error) {
      return error instanceof MidiFileError ? error.reason : "unexpected-error";
    }
  };

  it("extracts velocity, chords, leading silence, overlaps, and tempo changes", () => {
    const bytes = midiFile(0, [[
      metaEvent(0, 0x03, text("Lead")),
      tempo(0, 500_000),
      midiEvent(240, 0x90, 60, 100),
      midiEvent(0, 0x90, 64, 80),
      midiEvent(240, 0x80, 60, 0),
      midiEvent(0, 0x80, 64, 0),
      tempo(0, 1_000_000),
      midiEvent(480, 0x90, 67, 127),
      midiEvent(240, 0x80, 67, 0),
    ]]);

    const score = parseMidiFile(bytes, "tempo.mid");
    expect(score.initialTempoBpm).toBe(120);
    expect(score.tempoChanges).toHaveLength(2);
    expect(score.parts).toHaveLength(1);
    expect(score.parts[0]).toMatchObject({
      channel: 0,
      name: "Lead",
      noteCount: 3,
      originalMidiNumbers: [60, 64, 67],
    });
    expect(score.parts[0].notes[0]).toMatchObject({
      midi: 60,
      startSeconds: 0.25,
      durationSeconds: 0.25,
      velocity: 100 / 127,
    });
    expect(score.parts[0].notes[2]).toMatchObject({
      midi: 67,
      startSeconds: 1.5,
      durationSeconds: 0.5,
    });

    const events = buildMidiPlaybackEvents(score, "channel-0", 2, 32);
    expect(events).toHaveLength(3);
    expect(events[0]).toMatchObject({ durationSeconds: 0.25, notes: [] });
    expect(events[1].durationSeconds).toBe(1.25);
    expect(events[1].notes.map((note) => note.name)).toEqual(["D4", "Gb4"]);
    expect(events[1].notes[0].durationSeconds).toBe(0.25);
    expect(events[1].notes[0].velocity).toBeCloseTo(100 / 127);
    expect(events[2].durationSeconds).toBe(0.5);
    expect(events[2].tempoBpm).toBe(60);
  });

  it("lists melodic channels as parts and excludes channel 10 drums", () => {
    const bytes = midiFile(1, [
      [tempo(0, 500_000)],
      [
        metaEvent(0, 0x03, text("Melody")),
        midiEvent(0, 0x91, 72, 90),
        midiEvent(480, 0x81, 72, 0),
      ],
      [
        metaEvent(0, 0x03, text("Drums")),
        midiEvent(0, 0x99, 36, 100),
        midiEvent(480, 0x89, 36, 0),
      ],
    ]);

    const score = parseMidiFile(bytes, "parts.mid");
    expect(score.parts).toHaveLength(1);
    expect(score.parts[0]).toMatchObject({
      channel: 1,
      id: "channel-1",
      name: "Melody",
      noteCount: 1,
    });
  });

  it("rejects format 2, invalid files, and drum-only files", () => {
    const typeTwo = midiFile(2, [[
      midiEvent(0, 0x90, 60, 100),
      midiEvent(480, 0x80, 60, 0),
    ]]);
    const drums = midiFile(0, [[
      midiEvent(0, 0x99, 36, 100),
      midiEvent(480, 0x89, 36, 0),
    ]]);

    expect(getErrorReason(() => parseMidiFile(typeTwo))).toBe("unsupported-format");
    expect(getErrorReason(() => parseMidiFile(new Uint8Array([1, 2, 3])))).toBe("invalid-midi");
    expect(getErrorReason(() => parseMidiFile(drums))).toBe("no-melodic-notes");
  });
});
