import * as alphaTab from "@coderline/alphatab";
import { readFileSync } from "node:fs";
import { Note } from "tonal";
import { describe, expect, it } from "vitest";
import { parseAlphaTabScore } from "../src/MusicXML/alphaTabParser";
import { findBestTransposeIntervals } from "../src/MusicXML/musicXmlTransform";
import { getPlayableMidiNumbers } from "../src/MusicXML/playbackTimeline";

describe("alphaTab parser", () => {
  const loadAugustinScore = () => {
    const data = new Uint8Array(readFileSync("melodies/Ach_du_lieber_augustin.gp"));
    return alphaTab.importer.ScoreLoader.loadScoreFromBytes(data);
  };

  it("uses the score tempo from Guitar Pro files", () => {
    const score = loadAugustinScore();
    const parsed = parseAlphaTabScore(score, "C4");

    expect(parsed.tempo).toBe(200);
    expect(parsed.events[0]?.tempoBpm).toBe(200);
  });

  it("applies manual transposition to Guitar Pro playback events", () => {
    const score = loadAugustinScore();
    const original = parseAlphaTabScore(score, "C4", 0, 0);
    const transposed = parseAlphaTabScore(score, "C4", 0, 2);
    const originalMidi = Note.midi(original.events.find((event) => event.notes.length > 0)?.notes[0]?.name ?? "");
    const transposedMidi = Note.midi(transposed.events.find((event) => event.notes.length > 0)?.notes[0]?.name ?? "");

    expect(originalMidi).not.toBeNull();
    expect(transposedMidi).toBe(originalMidi! + 2);
  });

  it("does not double-apply transposition already applied by alphaTab", () => {
    const score = loadAugustinScore();
    const original = parseAlphaTabScore(score, "C4", 0, 0);
    const track = score.tracks[0];
    const staff = track.staves[0] as alphaTab.model.Staff & { transpositionPitch?: number };
    staff.transpositionPitch = -15;

    const transposed = parseAlphaTabScore(score, "C4", 0, 15);
    const originalMidi = Note.midi(original.events.find((event) => event.notes.length > 0)?.notes[0]?.name ?? "");
    const transposedMidi = Note.midi(transposed.events.find((event) => event.notes.length > 0)?.notes[0]?.name ?? "");

    expect(originalMidi).not.toBeNull();
    expect(transposedMidi).toBe(originalMidi! + 15);
    expect(transposed.events.flatMap((event) => event.tabs)).not.toContain("-1'");
  });

  it("finds all clean auto-transpose variants for Ach du lieber Augustin", () => {
    const score = loadAugustinScore();
    const { events } = parseAlphaTabScore(score, "C4", 0, 0);
    const midiNumbers = Array.from(getPlayableMidiNumbers(events));

    const intervals = findBestTransposeIntervals(midiNumbers, {
      selectedKey: "C4",
      noOverblowOrDraw: true,
      noBend: true,
    });

    expect(intervals).toEqual([15, 22, 27]);
  });
});
