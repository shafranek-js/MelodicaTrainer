import { describe, expect, it } from "vitest";
import {
  encodeMidiRecording,
  hasRecordedNotes,
  MidiRecordingSession,
} from "./midiRecording";

const emptySnapshot = {
  activeNotes: [],
  banks: new Map<number, number>(),
  programs: new Map<number, number>(),
  volumes: new Map<number, number>(),
};

describe("MIDI recording", () => {
  it("captures channel state, active notes and closes held notes on finish", () => {
    let now = 1_000;
    const session = new MidiRecordingSession({
      activeNotes: [{ channel: 0, count: 1, midi: 60, velocity: 90 }],
      banks: new Map([[0, 2]]),
      programs: new Map([[0, 21]]),
      volumes: new Map([[0, 100]]),
    }, () => now);
    now += 250;
    const recording = session.finish();

    expect(recording.durationMs).toBe(250);
    expect(recording.events.map((event) => event.kind)).toEqual([
      "control-change",
      "control-change",
      "program-change",
      "note-on",
      "note-off",
    ]);
    expect(hasRecordedNotes(recording)).toBe(true);
  });

  it("encodes a valid format-0 MIDI file with repeated note attacks", () => {
    let now = 0;
    const session = new MidiRecordingSession(emptySnapshot, () => now);
    session.recordNoteOn(0, 60, 100);
    now = 100;
    session.recordNoteOff(0, 60);
    session.recordNoteOn(0, 60, 110);
    now = 220;
    session.recordNoteOff(0, 60);
    const bytes = encodeMidiRecording(session.finish());

    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe("MThd");
    expect(new TextDecoder().decode(bytes.slice(14, 18))).toBe("MTrk");
    expect(Array.from(bytes).filter((byte) => byte === 0x90)).toHaveLength(2);
    expect(Array.from(bytes.slice(-3))).toEqual([0xff, 0x2f, 0x00]);
  });

  it("recognizes an empty recording", () => {
    const session = new MidiRecordingSession(emptySnapshot, () => 0);
    expect(hasRecordedNotes(session.finish())).toBe(false);
  });
});
