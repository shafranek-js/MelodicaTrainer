import { Note } from "tonal";
import { describe, expect, it } from "vitest";
import { generateMelodicaLayout } from "../utils/utils";
import { getLayoutTargets, getPracticeScale, getPracticeTargets } from "./practiceTargets";
import type { PracticeTarget } from "./practiceTargets";

const midi = (note: string) => {
  const value = Note.midi(note);
  if (value === null) throw new Error(`Expected MIDI value for ${note}`);
  return value;
};

const targetSummary = (targets: PracticeTarget[]) =>
  targets.map((target) => `${target.label}:${target.noteName}`);

describe("getPracticeScale", () => {
  it("derives scale notes from a selected tonic", () => {
    const selection = getPracticeScale({
      tonic: "C",
      scaleValue: "major",
    });

    expect(selection.tonic).toBe("C");
    expect(selection.scaleLabel).toBe("Major");
    expect(selection.scale).toEqual(["C", "D", "E", "F", "G", "A", "B"]);
  });

  it("supports alternate scale choices", () => {
    const selection = getPracticeScale({
      tonic: "D",
      scaleValue: "minor pentatonic",
    });

    expect(selection.scaleLabel).toBe("Minor pentatonic");
    expect(selection.scale).toEqual(["D", "F", "G", "A", "C"]);
  });
});

describe("getPracticeTargets", () => {
  it("returns melodica keys matching the selected scale pitch classes", () => {
    const selection = getPracticeTargets({
      layout: generateMelodicaLayout(32),
      tonic: "C",
      scaleValue: "major",
    });

    expect(selection.practiceTargets).toEqual(
      expect.arrayContaining([
        { label: "Key 8", midi: midi("C4"), noteName: "C4", row: "White key" },
        { label: "Key 17", midi: midi("A4"), noteName: "A4", row: "White key" },
        { label: "Key 27", midi: midi("G5"), noteName: "G5", row: "White key" },
      ])
    );
    expect(
      selection.practiceTargets.every((target) =>
        selection.activePitchClasses.has(Note.chroma(target.noteName))
      )
    ).toBe(true);
  });

  it("keeps targets inside the selected melodica range", () => {
    const selection = getPracticeTargets({
      layout: generateMelodicaLayout(25),
      tonic: "C",
      scaleValue: "major",
    });

    expect(selection.practiceTargets[0].noteName).toBe("F3");
    expect(selection.practiceTargets[selection.practiceTargets.length - 1]?.noteName).toBe("F5");
    expect(selection.practiceTargets.every((target) => target.midi >= midi("F3"))).toBe(
      true
    );
    expect(selection.practiceTargets.every((target) => target.midi <= midi("F5"))).toBe(
      true
    );
  });

  it("can derive chord-tone targets from any pitch-class set", () => {
    const layout = generateMelodicaLayout(32);
    const targets = getLayoutTargets(layout, new Set([Note.chroma("C"), Note.chroma("E"), Note.chroma("G")]));

    expect(targetSummary(targets).slice(0, 4)).toEqual([
      "Key 3:G3",
      "Key 8:C4",
      "Key 12:E4",
      "Key 15:G4",
    ]);
  });
});
