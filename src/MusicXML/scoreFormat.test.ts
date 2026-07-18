import { describe, expect, it } from "vitest";
import { getScoreFileFormat, getScoreFormat } from "./scoreFormat";

describe("getScoreFormat", () => {
  it.each([
    ["score.xml", "musicxml"],
    ["score.musicxml", "musicxml"],
    ["score.mxl", "musicxml"],
    ["score.mscz", "musicxml"],
    ["score.gp", "guitar-pro"],
    ["score.gp3", "guitar-pro"],
    ["score.gp4", "guitar-pro"],
    ["score.gp5", "guitar-pro"],
    ["score.gpx", "guitar-pro"],
    ["score.mid", "midi"],
    ["score.midi", "midi"],
  ] as const)("recognizes %s", (fileName, format) => {
    expect(getScoreFormat(fileName)).toBe(format);
  });

  it("rejects unsupported files", () => {
    expect(getScoreFormat("score.pdf")).toBeNull();
  });

  it("keeps MuseScore as a distinct source-file format", () => {
    expect(getScoreFileFormat("score.MSCZ")).toBe("musescore");
    expect(getScoreFormat("score.MSCZ")).toBe("musicxml");
  });
});
