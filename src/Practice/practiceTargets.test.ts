import { Note } from "tonal";
import { describe, expect, it } from "vitest";
import { generateLayout } from "../utils/utils";
import { getPracticeScale, getPracticeTargets } from "./practiceTargets";
import type { PracticeTarget } from "./practiceTargets";

const midi = (note: string) => {
  const value = Note.midi(note);
  if (value === null) throw new Error(`Expected MIDI value for ${note}`);
  return value;
};

const targetSummary = (targets: PracticeTarget[]) =>
  targets.map((target) => `${target.label}:${target.noteName}`);

describe("getPracticeScale", () => {
  it("derives the selected position mode from the harmonica key", () => {
    const selection = getPracticeScale({
      harmonicaKey: "C4",
      positionIndex: 1,
      scaleValue: "mode",
    });

    expect(selection.position.label).toBe("2nd");
    expect(selection.tonic).toBe("G");
    expect(selection.scaleLabel).toBe("Mixolydian");
    expect(selection.scale).toEqual(["G", "A", "B", "C", "D", "E", "F"]);
  });

  it("uses the position tonic when deriving alternate scale choices", () => {
    const selection = getPracticeScale({
      harmonicaKey: "C4",
      positionIndex: 2,
      scaleValue: "minor pentatonic",
    });

    expect(selection.position.label).toBe("3rd");
    expect(selection.tonic).toBe("D");
    expect(selection.scaleLabel).toBe("Minor pentatonic");
    expect(selection.scale).toEqual(["D", "F", "G", "A", "C"]);
  });
});

describe("getPracticeTargets", () => {
  it("returns playable targets matching the selected scale pitch classes", () => {
    const selection = getPracticeTargets({
      layout: generateLayout("C4"),
      harmonicaKey: "C4",
      positionIndex: 1,
      scaleValue: "blues",
    });

    expect(selection.scale).toEqual(["G", "Bb", "C", "Db", "D", "F"]);
    expect(selection.practiceTargets).toEqual(
      expect.arrayContaining([
        { label: "Blow 1", midi: midi("C4"), noteName: "C4", row: "Blow" },
        { label: "Draw 2", midi: midi("G4"), noteName: "G4", row: "Draw" },
        { label: "Draw bend 1", midi: midi("C#4"), noteName: "C#4", row: "Draw bend" },
      ])
    );
    expect(
      selection.practiceTargets.every((target) =>
        selection.activePitchClasses.has(Note.chroma(target.noteName))
      )
    ).toBe(true);
  });

  it("filters bend practice to bend rows without changing row order", () => {
    const selection = getPracticeTargets({
      layout: generateLayout("C4"),
      harmonicaKey: "C4",
      positionIndex: 1,
      scaleValue: "blues",
    });

    expect(targetSummary(selection.bendTargets)).toEqual([
      "Blow bend 10:Bb6",
      "Draw bend 1:C#4",
      "Draw bend 3:A#4",
      "Draw bend 4:C#5",
      "Draw bend 2:F4",
    ]);
    expect(selection.bendTargets.every((target) => target.row.endsWith("bend"))).toBe(
      true
    );
  });

  it("changes target choices when the selected position and scale change", () => {
    const secondPositionBlues = getPracticeTargets({
      layout: generateLayout("C4"),
      harmonicaKey: "C4",
      positionIndex: 1,
      scaleValue: "blues",
    });
    const thirdPositionMinorPentatonic = getPracticeTargets({
      layout: generateLayout("C4"),
      harmonicaKey: "C4",
      positionIndex: 2,
      scaleValue: "minor pentatonic",
    });

    expect(thirdPositionMinorPentatonic.tonic).toBe("D");
    expect(thirdPositionMinorPentatonic.practiceTargets).toEqual(
      expect.arrayContaining([
        { label: "Draw 1", midi: midi("D4"), noteName: "D4", row: "Draw" },
      ])
    );
    expect(thirdPositionMinorPentatonic.practiceTargets).not.toEqual(
      secondPositionBlues.practiceTargets
    );
  });
});
