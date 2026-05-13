import { describe, expect, it } from "vitest";
import { findBestTransposeIntervals } from "../src/MusicXML/musicXmlTransform";

describe("auto transpose constraints", () => {
  it("treats No Bends as a hard constraint when possible", () => {
    const intervals = findBestTransposeIntervals([61], {
      selectedKey: "C4",
      noOverblowOrDraw: false,
      noBend: true,
    });

    expect(intervals).not.toContain(0);
  });

  it("treats No Overblow/Draw as a hard constraint when possible", () => {
    const intervals = findBestTransposeIntervals([75], {
      selectedKey: "C4",
      noOverblowOrDraw: true,
      noBend: false,
    });

    expect(intervals).not.toContain(0);
  });

  it("keeps all clean Ach du lieber Augustin GP variants when both filters are enabled", () => {
    const achDuLieberAugustinMidi = [64, 66, 62, 61, 57, 59, 52];

    const intervals = findBestTransposeIntervals(achDuLieberAugustinMidi, {
      selectedKey: "C4",
      noOverblowOrDraw: true,
      noBend: true,
    });

    expect(intervals).toEqual([15, 22, 27]);
  });

  it("handles legacy harmonica keys without octaves", () => {
    const achDuLieberAugustinMidi = [64, 66, 62, 61, 57, 59, 52];

    const intervals = findBestTransposeIntervals(achDuLieberAugustinMidi, {
      selectedKey: "C",
      noOverblowOrDraw: true,
      noBend: true,
    });

    expect(intervals).toEqual([15, 22, 27]);
  });
});
