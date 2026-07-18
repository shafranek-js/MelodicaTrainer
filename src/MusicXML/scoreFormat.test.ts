import { describe, expect, it } from "vitest";
import { getScoreFormat } from "./scoreFormat";

describe("getScoreFormat", () => {
  it.each([
    ["score.xml", "musicxml"],
    ["score.musicxml", "musicxml"],
    ["score.mxl", "musicxml"],
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
});
