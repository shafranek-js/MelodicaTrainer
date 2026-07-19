import { describe, expect, it } from "vitest";
import {
  sanitizeMelodicaKeyCount,
  sanitizeSoundFont,
} from "./appSettings";

describe("shared app settings sanitizers", () => {
  it("normalizes supported ranges and rejects invalid types", () => {
    expect(sanitizeMelodicaKeyCount("44")).toBe(44);
    expect(sanitizeMelodicaKeyCount({})).toBeUndefined();
  });

  it("keeps a known SoundFont and falls back from an unknown string", () => {
    expect(sanitizeSoundFont("melodica.sf2")).toBe("melodica.sf2");
    expect(sanitizeSoundFont("unknown.sf2")).toBe("melodica.sf2");
    expect(sanitizeSoundFont(12)).toBeUndefined();
  });
});
