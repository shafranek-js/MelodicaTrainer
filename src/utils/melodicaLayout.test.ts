import { describe, expect, it } from "vitest";
import {
  generateMelodicaLayout,
  getMelodicaKeyboardGeometry,
  getMelodicaKeyForNote,
  getMelodicaKeyLabelForNote,
  getMelodicaMidiNumbers,
  normalizeMelodicaKeyCount,
} from "./melodicaLayout";

describe("generateMelodicaLayout", () => {
  it("builds the standard 32-key melodica range from F3 to C6", () => {
    const layout = generateMelodicaLayout(32);

    expect(layout.startNote).toBe("F3");
    expect(layout.endNote).toBe("C6");
    expect(layout.keys).toHaveLength(32);
    expect(layout.keys[0]).toMatchObject({
      index: 1,
      name: "F3",
      midi: 53,
      isBlack: false,
    });
    expect(layout.keys[layout.keys.length - 1]).toMatchObject({
      index: 32,
      name: "C6",
      midi: 84,
      isBlack: false,
    });
  });

  it("supports compact and extended melodica ranges", () => {
    const compact25 = generateMelodicaLayout(25).keys;
    const compact27 = generateMelodicaLayout(27).keys;
    const extended37 = generateMelodicaLayout(37).keys;

    expect(compact25[compact25.length - 1].name).toBe("F5");
    expect(compact27[compact27.length - 1].name).toBe("G5");
    expect(extended37[extended37.length - 1].name).toBe("F6");
  });

  it("marks black keys by sharp pitch class", () => {
    const layout = generateMelodicaLayout(32);

    expect(layout.keys.find((key) => key.name === "F#3")).toMatchObject({
      pitchClass: "F#",
      isBlack: true,
    });
    expect(layout.keys.find((key) => key.name === "G3")).toMatchObject({
      pitchClass: "G",
      isBlack: false,
    });
  });
});

describe("melodica key helpers", () => {
  it("normalizes unsupported key counts to the 32-key standard", () => {
    expect(normalizeMelodicaKeyCount("37")).toBe(37);
    expect(normalizeMelodicaKeyCount(25)).toBe(25);
    expect(normalizeMelodicaKeyCount("12")).toBe(32);
    expect(normalizeMelodicaKeyCount(null)).toBe(32);
  });

  it("maps notes to key objects and labels inside the selected range", () => {
    expect(getMelodicaKeyForNote(32, "F3")).toMatchObject({ index: 1 });
    expect(getMelodicaKeyForNote(32, "C6")).toMatchObject({ index: 32 });
    expect(getMelodicaKeyForNote(32, "C#6")).toBeNull();

    expect(getMelodicaKeyLabelForNote(32, "A4")).toBe("A4");
    expect(getMelodicaKeyLabelForNote(32, "A4", "keyNumber")).toBe("17");
  });

  it("collects MIDI values for pitch filtering", () => {
    expect(getMelodicaMidiNumbers(generateMelodicaLayout(25))).toEqual(
      Array.from({ length: 25 }, (_, index) => 53 + index)
    );
  });
});

describe("getMelodicaKeyboardGeometry", () => {
  it("positions white keys as the physical keyboard base and overlays black keys between them", () => {
    const layout = generateMelodicaLayout(32);
    const geometry = getMelodicaKeyboardGeometry(layout);
    const f3 = geometry.keys.find((key) => key.name === "F3");
    const fSharp3 = geometry.keys.find((key) => key.name === "F#3");
    const g3 = geometry.keys.find((key) => key.name === "G3");
    const e4 = geometry.keys.find((key) => key.name === "E4");
    const f4 = geometry.keys.find((key) => key.name === "F4");

    expect(geometry.whiteKeyCount).toBe(19);
    expect(f3).toMatchObject({
      isBlack: false,
      leftPct: 0,
      widthPct: geometry.whiteKeyWidthPct,
      whiteIndex: 0,
    });
    expect(g3?.whiteIndex).toBe(1);
    expect(fSharp3?.isBlack).toBe(true);
    expect(fSharp3?.centerPct).toBeCloseTo(geometry.whiteKeyWidthPct, 6);
    expect(fSharp3?.widthPct).toBeLessThan(geometry.whiteKeyWidthPct);
    expect(e4?.whiteIndex).toBe(6);
    expect(f4?.whiteIndex).toBe(7);
  });
});
