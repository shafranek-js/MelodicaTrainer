import { describe, expect, it } from "vitest";
import { parsePresetSelection } from "./useSoundFontPresets";

describe("parsePresetSelection", () => {
  it("parses bank and program from a persisted preset value", () => {
    expect(parsePresetSelection("0:22")).toEqual({ bank: 0, program: 22 });
  });

  it("rejects malformed preset values", () => {
    expect(parsePresetSelection("22")).toBeNull();
    expect(parsePresetSelection("bank:22")).toBeNull();
    expect(parsePresetSelection("0:program")).toBeNull();
  });
});
