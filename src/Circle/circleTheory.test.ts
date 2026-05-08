import { Note } from "tonal";
import { describe, expect, it } from "vitest";
import { getCircleOfFifths, getCircleTheory } from "./circleTheory";

const chroma = (note: string) => Note.chroma(note);

describe("getCircleOfFifths", () => {
  it("builds the note ring by transposing C through perfect fifths", () => {
    expect(getCircleOfFifths()).toEqual([
      "C",
      "G",
      "D",
      "A",
      "E",
      "B",
      "F#",
      "C#",
      "G#",
      "D#",
      "A#",
      "F",
    ]);
  });
});

describe("getCircleTheory", () => {
  it("derives the mode tonic, selected mode scale, triads, and colors", () => {
    const theory = getCircleTheory({
      selectedRoot: "C",
      selectedMode: 1,
      selectedScale: "mode",
    });

    expect(theory.modeTonic).toBe("G");
    expect(theory.scaleLabel).toBe("Mixolydian");
    expect(theory.scale).toEqual(["G", "A", "B", "C", "D", "E", "F"]);
    expect(theory.triads).toEqual([
      { root: "G", notes: ["G", "B", "D"], quality: "GM" },
      { root: "A", notes: ["A", "C", "E"], quality: "Am" },
      { root: "B", notes: ["B", "D", "F"], quality: "Bdim" },
      { root: "C", notes: ["C", "E", "G"], quality: "CM" },
      { root: "D", notes: ["D", "F", "A"], quality: "Dm" },
      { root: "E", notes: ["E", "G", "B"], quality: "Em" },
      { root: "F", notes: ["F", "A", "C"], quality: "FM" },
    ]);
    expect(theory.noteColors[chroma("G")]).toBe("GM");
    expect(theory.noteColors[chroma("A")]).toBe("Am");
    expect(theory.noteColors[chroma("B")]).toBe("Bdim");
    expect(theory.noteColors[chroma("C#")]).toBe("none");
  });

  it("uses the mode tonic for alternate scales and skips triads outside seven-note scales", () => {
    const theory = getCircleTheory({
      selectedRoot: "C",
      selectedMode: 1,
      selectedScale: "minor pentatonic",
    });

    expect(theory.modeTonic).toBe("G");
    expect(theory.scaleLabel).toBe("Minor pentatonic");
    expect(theory.scale).toEqual(["G", "Bb", "C", "D", "F"]);
    expect(theory.triads).toEqual([]);
    expect(theory.noteColors[chroma("Bb")]).toBe("scale");
    expect(theory.noteColors[chroma("A")]).toBe("none");
  });
});
