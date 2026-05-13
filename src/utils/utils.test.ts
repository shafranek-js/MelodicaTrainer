import { Note } from "tonal";
import { describe, expect, it } from "vitest";
import {
  freqToNoteAndCents,
  generateLayout,
  getHarmonicaHoleForNote,
  getLayoutMidiNumbers,
  harmonicaLayoutDisplayRows,
  normalizeHarmonicaKey,
} from "./utils";
import type { TonalNote } from "./utils";

const names = (row: (TonalNote | null)[]) =>
  row.map((note) => note?.name ?? null);

const midi = (note: string) => {
  const value = Note.midi(note);
  if (value === null) throw new Error(`Expected MIDI value for ${note}`);
  return value;
};

describe("generateLayout", () => {
  it("normalizes legacy key labels without octaves", () => {
    expect(normalizeHarmonicaKey("C")).toBe("C4");
    expect(normalizeHarmonicaKey("G")).toBe("G3");
    expect(names(generateLayout("C").blow)).toEqual(names(generateLayout("C4").blow));
    expect(names(generateLayout("C").draw)).toEqual(names(generateLayout("C4").draw));
  });

  it("builds the C diatonic harmonica rows with stable hole positions", () => {
    const layout = generateLayout("C4");

    expect(names(layout.blow)).toEqual([
      "C4",
      "E4",
      "G4",
      "C5",
      "E5",
      "G5",
      "C6",
      "E6",
      "G6",
      "C7",
    ]);
    expect(names(layout.draw)).toEqual([
      "D4",
      "G4",
      "B4",
      "D5",
      "F5",
      "A5",
      "B5",
      "D6",
      "F6",
      "A6",
    ]);
    expect(names(layout.HalfStepBlowBend)).toEqual([
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      "D#6",
      "F#6",
      "B6",
    ]);
    expect(names(layout.wholeStepBlowBend)).toEqual([
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      "Bb6",
    ]);
    expect(names(layout.overblow)).toEqual([
      "Eb4",
      null,
      null,
      "Eb5",
      "F#5",
      "Bb5",
      null,
      null,
      null,
      null,
    ]);
    expect(names(layout.overdraw)).toEqual([
      null,
      null,
      null,
      null,
      null,
      null,
      "C#6",
      null,
      "Ab6",
      "C#7",
    ]);
  });
});

describe("getLayoutMidiNumbers", () => {
  it("collects MIDI values from every playable layout row", () => {
    const midiNumbers = getLayoutMidiNumbers(generateLayout("C4"));

    expect(midiNumbers.every(Number.isInteger)).toBe(true);
    expect(midiNumbers).toEqual(
      expect.arrayContaining([
        midi("C4"),
        midi("C#4"),
        midi("Bb6"),
        midi("C#6"),
      ])
    );
  });
});

describe("harmonicaLayoutDisplayRows", () => {
  it("describes the rendered rows in stable top-to-bottom order", () => {
    const layout = generateLayout("C4");

    expect(harmonicaLayoutDisplayRows.map((row) => row.key)).toEqual([
      "wholeStepBlowBend",
      "HalfStepBlowBend",
      "blow",
      "draw",
      "halfStepDrawBendOverdraw",
      "wholeStepDrawBend",
      "oneAndHalfStepDrawBend",
    ]);
    expect(harmonicaLayoutDisplayRows.every((row) => layout[row.key].length === 10)).toBe(
      true
    );
    expect(
      harmonicaLayoutDisplayRows.filter((row) => row.isBend).map((row) => row.key)
    ).toEqual([
      "wholeStepBlowBend",
      "HalfStepBlowBend",
      "halfStepDrawBendOverdraw",
      "wholeStepDrawBend",
      "oneAndHalfStepDrawBend",
    ]);
  });
});

describe("freqToNoteAndCents", () => {
  it("converts a frequency to the nearest note and cents offset", () => {
    const result = freqToNoteAndCents(440);

    expect(result?.note).toBe("A4");
    expect(result?.pitchClass).toBe("A");
    expect(result?.cents).toBeCloseTo(0, 6);
  });
});

describe("getHarmonicaHoleForNote", () => {
  it("maps representative notes to harmonica tab notation", () => {
    expect(getHarmonicaHoleForNote("C4", "C4")).toBe("1");
    expect(getHarmonicaHoleForNote("C4", "D4")).toBe("-1");
    expect(getHarmonicaHoleForNote("C4", "C#4")).toBe("-1'");
    expect(getHarmonicaHoleForNote("C4", "F4")).toBe("-2''");
    expect(getHarmonicaHoleForNote("C4", "G#4")).toBe("-3'''");
    expect(getHarmonicaHoleForNote("C4", "B6")).toBe("10'");
    expect(getHarmonicaHoleForNote("C4", "Bb6")).toBe("10''");
    expect(getHarmonicaHoleForNote("C4", "D#5")).toBe("4o");
    expect(getHarmonicaHoleForNote("C4", "C#6")).toBe("-7o");
  });

  it("returns null when the target note is invalid or unavailable", () => {
    expect(getHarmonicaHoleForNote("C4", "not-a-note")).toBeNull();
    expect(getHarmonicaHoleForNote("C4", "C#8")).toBeNull();
  });
});
